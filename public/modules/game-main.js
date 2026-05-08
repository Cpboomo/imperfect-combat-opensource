// game-main.js — Game loop, events, init, tower, bonds, chest, time freeze

// ==================== 游戏循环 ====================
let lastFrameTime=0;
function gameLoop(timestamp){
    try {
        let dt=lastFrameTime?Math.min(timestamp-lastFrameTime,50):16;
        lastFrameTime=timestamp;

        if(!gameState.isGameOver&&!gameState.isPaused){
            regenMP();
            updatePlayerMovement();
            updateMonsters();
            attackNearestMonster();
            updateAI();
            checkMonsterContact();
            updateWaveSystem(Date.now());
            // Boss计时器
            if(gameState.phase==='boss' && gameState.bossActive && gameState.bossTimer>0){
                gameState.bossTimer -= dt;
                if(gameState.bossTimer<=0){
                    gameState.bossTimer=0;
                    triggerGameOver();
                }
            }
            // 塔怪超时检测（手动/自动通用）
            var _hasTowerMonster=gameState.monsters.some(function(m){return m&&m._isTowerMonster&&m.hp>0;});
            if(_hasTowerMonster){
                gameState._towerTimer+=dt;
                if(gameState._towerTimer>=30000){
                    // 30秒超时→消失，无奖励无升级
                    gameState._towerAuto=false;
                    gameState._towerTimer=0;
                    gameState._towerSpawned=false;
                    screenText('⏰ 爬塔超时', '#ff4757', 1200, -20);
                    for(let mi=gameState.monsters.length-1;mi>=0;mi--){
                        if(gameState.monsters[mi]&&gameState.monsters[mi]._isTowerMonster){
                            gameState.monsters.splice(mi,1);
                        }
                    }
                }
            }
            // 修仙系统更新
            updateCultivation(dt);
            // 时间静止大招管理
            var tf=gameState._timeFreeze;
            if(tf.cooldown>0) tf.cooldown=Math.max(0,tf.cooldown-dt);
            if(tf.active){
                tf.timer-=dt;
                if(tf.timer<=0){
                    tf.active=false;
                    tf.cooldown=tf.totalCD;
                    screenText('⏳ 时间恢复!', '#00d4ff', 1200, -20);
                    // 释放时粒子爆散
                    for(let p of gameState.projectiles){
                        if(p&&p.alive){
                            for(let i=0;i<3;i++) gameState.particles.push(new Particle(p.x,p.y,p.color||'#ffdd59',300,3,4));
                        }
                    }
                }else{
                    // 时间静止中 — 粒子特效
                    if(Math.random()<0.3){
                        var px=Math.random()*MAP_W, py=Math.random()*MAP_H;
                        gameState.particles.push(new Particle(px,py,'rgba(0,212,255,0.6)',400,2,0.5));
                    }
                }
            }
            // 宝箱+升级检测 — 塔怪在规定时间内全死
            if(gameState._towerSpawned&&!_hasTowerMonster){
                var _floor=gameState._towerSpawnFloor||gameState.towerFloor;
                if(!gameState.towerClaimed[_floor]){
                    gameState.towerClaimed[_floor]=true;
                    chestCount++;
                    chestSaveCount();
                    SFX.chestDrop();
                }
                gameState.towerFloor=Math.min(60,(gameState.towerFloor||1)+1);
                screenText('⬆️ 塔升级 Lv.'+gameState.towerFloor, '#22c55e', 1200, -20);
                gameState._towerSpawned=false;
            }
            // 自动模式：死光 → 出下一层
            if(gameState._towerAuto&&!_hasTowerMonster){
                gameState._towerTimer=0;
                gameState._towerSpawned=false;
                spawnTowerMonsters();
                screenText('🤖 自动塔层 Lv.'+gameState.towerFloor, '#ffdd59', 1200, -20);
            }
            for(let i=gameState.particles.length-1;i>=0;i--){ gameState.particles[i].update(dt); if(!gameState.particles[i].alive) gameState.particles.splice(i,1); }
            for(let i=gameState.floatingTexts.length-1;i>=0;i--){ gameState.floatingTexts[i].update(dt); if(!gameState.floatingTexts[i].alive) gameState.floatingTexts.splice(i,1); }
            for(let i=gameState.projectiles.length-1;i>=0;i--){ gameState.projectiles[i].update(dt); if(!gameState.projectiles[i].alive) gameState.projectiles.splice(i,1); }
        }
        render();
    } catch(e) { console.error('游戏循环异常:', e); }
    // AI自动复活（必须在try块外但请求下一帧前）
    if(gameState.isGameOver&&gameState.aiEnabled&&!gameState._aiRestarting){
        gameState._aiRestarting=true;
        setTimeout(function(){
            restartGame();
            gameState._aiRestarting=false;
        },2000);
    }
    requestAnimationFrame(gameLoop);
}

function updatePlayerMovement(){
    if(!gameState.player) return;
    let p=gameState.player;
    // 击退衰减
    if(p._kbX||p._kbY){
        p.x+=p._kbX; p.y+=p._kbY;
        p._kbX*=0.8; p._kbY*=0.8;
        if(Math.abs(p._kbX)<0.05) p._kbX=0;
        if(Math.abs(p._kbY)<0.05) p._kbY=0;
    }

    // ===== 高响应惯性移动：快加速 → 定速巡航 → 到达微滑 =====
    let _dt=Math.min(16/1000, 0.033);
    if(!p._vx) p._vx=0;
    if(!p._vy) p._vy=0;
    let baseSpd = CONFIG.PLAYER_SPEED + (p.extraSpd||0);
    let targetSpd = baseSpd * 2.5; // 巡航速度（补偿加减速损失）

    if(p.isMoving && gameState.currentPath.length>0 && gameState.currentPathIndex<gameState.currentPath.length){
        let tn=gameState.currentPath[gameState.currentPathIndex];
        let dx=tn.x-p.x, dy=tn.y-p.y;
        let dist=Math.sqrt(dx*dx+dy*dy);

        // 到达路径点
        if(dist<2){
            gameState.currentPathIndex++;
            if(gameState.currentPathIndex>=gameState.currentPath.length){
                p.isMoving=false; gameState.currentPathIndex=0;
            }
        } else {
            // 目标速度 = 方向单位向量 × 巡航速度
            let nx=dx/dist, ny=dy/dist;
            let tVx = nx * targetSpd;
            let tVy = ny * targetSpd;

            // 快加速/减速到目标速度（lerp 系数大 = 响应快）
            let lerpFactor = 0.15; // 越大越灵敏
            p._vx += (tVx - p._vx) * lerpFactor;
            p._vy += (tVy - p._vy) * lerpFactor;
        }
    }

    // 到达后惯性滑行
    if(!p.isMoving){
        let curSpd = Math.sqrt(p._vx*p._vx + p._vy*p._vy);
        if(curSpd < 0.15){ p._vx=0; p._vy=0; }
        else { p._vx *= 0.85; p._vy *= 0.85; } // 惯性衰减
    }

    // 坐标更新
    let nxPos=p.x+p._vx*_dt, nyPos=p.y+p._vy*_dt;
    if(Math.abs(p._vx*_dt)>0.01||Math.abs(p._vy*_dt)>0.01){
        if(canMoveTo(nxPos,nyPos)){
            p.x=nxPos; p.y=nyPos;
        } else {
            p._vx*=0.4; p._vy*=0.4; // 碰墙减速
            if(canMoveTo(nxPos,p.y)) p.x=nxPos;
            if(canMoveTo(p.x,nyPos)) p.y=nyPos;
        }
    }
}

function updateMonsters(){
    let now=Date.now();
    let tf=gameState._timeFreeze&&gameState._timeFreeze.active;
    for(let i=gameState.monsters.length-1;i>=0;i--){
        let m=gameState.monsters[i];
        if(tf){
            // 时间静止：只更新视觉效果，不移动
            m._hitFlashTimer=m._hitFlashTimer?Math.max(0,m._hitFlashTimer-16):0;
            if(m._kbX||m._kbY){ m._kbX*=0.7; m._kbY*=0.7; if(Math.abs(m._kbX)<0.1&&Math.abs(m._kbY)<0.1){m._kbX=0;m._kbY=0;} }
            if(m._slowTimer&&m._slowTimer>0) m._slowTimer-=16;
            continue;
        }
        m.update(now);
    }
}

// ==================== 事件绑定 ====================
function bindEvents(){
    canvas.addEventListener('click',handleCanvasClick);
    // F键 — 时间静止大招
    document.addEventListener('keydown',function(e){
        if(e.key==='f'||e.key==='F'){
            var tf=gameState._timeFreeze;
            if(tf&&!tf.active&&tf.cooldown<=0&&!gameState.isGameOver) activateTimeFreeze();
        }
    });
}

// ==================== Canvas 适配 ====================
function resizeCanvas(){
    canvas.width=CONFIG.BASE_WIDTH; canvas.height=CONFIG.BASE_HEIGHT;
    // 用min缩放=contain效果，完整显示全部游戏内容
    let scaleX=window.innerWidth/CONFIG.BASE_WIDTH;
    let scaleY=window.innerHeight/CONFIG.BASE_HEIGHT;
    let scale=Math.min(scaleX,scaleY);
    // 居中放置
    canvas.style.transform='translate('+(window.innerWidth-CONFIG.BASE_WIDTH*scale)/2+'px,'+(window.innerHeight-CONFIG.BASE_HEIGHT*scale)/2+'px) scale('+scale+')';
    // 给canvas加自己的背景色，这样边栏看起来是深蓝而非纯黑
    canvas.style.backgroundColor = '#1a1a2e';
}

// ==================== 数据加载 ====================
function getDifficultyFromURL(){
    let p=new URLSearchParams(window.location.search);
    let d=p.get('difficulty');
    if(d&&DIFFICULTY_MULTIPLIERS[d]) return d;
    if(typeof window.SELECTED_DIFFICULTY!=='undefined'&&window.SELECTED_DIFFICULTY) return window.SELECTED_DIFFICULTY;
    return 'n1';
}
function generateDefaultLevelData(){
    let grid=[], walls=[];
    for(let y=0;y<CONFIG.GRID_ROWS;y++){
        grid[y]=[];
        for(let x=0;x<CONFIG.GRID_COLS;x++){
            let cx=x*CONFIG.GRID_SIZE+CONFIG.GRID_SIZE/2;
            let cy=y*CONFIG.GRID_SIZE+CONFIG.GRID_SIZE/2;
            let isWall=Math.random()<0.15;
            grid[y][x]={x:cx,y:cy,type:isWall?'wall':'floor'};
            if(isWall) walls.push({x:cx,y:cy,type:'wall'});
        }
    }
    // 确保玩家起点附近没有墙
    let sgx=Math.floor(180/CONFIG.GRID_SIZE), sgy=Math.floor(460/CONFIG.GRID_SIZE);
    for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++){
        let gx=sgx+dx, gy=sgy+dy;
        if(gx>=0&&gx<CONFIG.GRID_COLS&&gy>=0&&gy<CONFIG.GRID_ROWS){
            grid[gy][gx].type='floor';
            let idx=walls.findIndex(w=>w.x===grid[gy][gx].x&&w.y===grid[gy][gx].y);
            if(idx>=0) walls.splice(idx,1);
        }
    }
    return { grid, walls, player:{x:180,y:460}, levelName:'不完美作战',
        params:{maxHp:100,maxMp:100,dashMpCost:30,mpRegen:5,walkSpeed:1,dashDistance:150} };
}
async function loadLevel(){
    try {
        let difficulty=getDifficultyFromURL();
        if(typeof window.EMBEDDED_LEVEL_DATA!=='undefined'&&window.EMBEDDED_LEVEL_DATA){
            applyLevelData(window.EMBEDDED_LEVEL_DATA,difficulty); return;
        }
        let resp=await fetch('/api/load'), result=await resp.json();
        if(result.status==='success'&&result.data) applyLevelData(result.data,difficulty);
        else applyLevelData(generateDefaultLevelData(),difficulty);
    } catch(e){
        console.error('请求错误,使用默认关卡:',e);
        applyLevelData(generateDefaultLevelData(),getDifficultyFromURL());
    }
}
function setDifficulty(d){
    if(!DIFFICULTY_MULTIPLIERS[d]) d='normal';
    currentDifficulty=d; runtimeMultipliers={...DIFFICULTY_MULTIPLIERS[d]};
}
function applyDifficultyToConfig(bc){
    let a={...bc};
    a.monsterMaxHp=Math.round((bc.monsterMaxHp||50)*runtimeMultipliers.monsterHp);
    a.monsterSpeed=(bc.monsterSpeed||2)*runtimeMultipliers.monsterSpeed;
    a.spawnInterval=Math.round((bc.spawnInterval||3000)*runtimeMultipliers.spawnInterval);
    return a;
}
function applyLevelData(data,difficulty='n1'){
    setDifficulty(difficulty);
    let bp=data.params||{};
    // 加载游戏配置（兼容新老格式）
    let gc = data.gameConfig || DEFAULT_GAME_CONFIG;
    gameState.config = gc;
    
    let sp=applyDifficultyToConfig({
        maxHp:bp.maxHp||gc.hero.maxHp||100,maxMp:bp.maxMp||gc.hero.maxMp||100,
        dashMpCost:bp.dashMpCost||gc.hero.dashMpCost||30,
        mpRegen:bp.mpRegen||gc.hero.mpRegen||5,walkSpeed:bp.walkSpeed||gc.hero.walkSpeed||4,
        dashDistance:bp.dashDistance||gc.hero.dashDistance||150,
        monsterMaxHp:bp.monsterMaxHp||50,monsterSpeed:bp.monsterSpeed||2,spawnInterval:bp.spawnInterval||3000,
    });
    CONFIG.MAX_HP=sp.maxHp; CONFIG.MAX_MP=sp.maxMp; CONFIG.DASH_COST=sp.dashMpCost;
    CONFIG.MP_REGEN_RATE=sp.mpRegen; CONFIG.PLAYER_SPEED=sp.walkSpeed; CONFIG.DASH_DISTANCE=sp.dashDistance;
    gameState.spawnInterval=sp.spawnInterval;
    gameState.player={ x:Math.abs(data.player?.x||180), y:Math.abs(data.player?.y||460),
        isMoving:false, isDashing:false, _kbX:0, _kbY:0, hp:CONFIG.MAX_HP, maxHp:sp.maxHp, mp:CONFIG.MAX_MP, maxMp:CONFIG.MAX_MP };
    gameState._initX=gameState.player.x; gameState._initY=gameState.player.y;
    gameState.grid=data.grid||[]; gameState.walls=data.walls||[];
    gameState.levelName=data.levelName||'初出茅庐';
    gameState.currentPath=[]; gameState.currentPathIndex=0;
    gameState.monsters=[]; gameState.particles=[]; gameState.floatingTexts=[]; gameState.projectiles=[];
    gameState.camera={x:0,y:0}; gameState.lastMpRegen=Date.now();
    gameState.lastSpawnTime=Date.now();
    gameState.gold=gc.hero.initialGold||400;
    gameState.wave=0; gameState.score=0; gameState.kills=0; gameState.maxWave=1;
    gameState.isBetweenWaves=true; gameState.betweenWaveTimer=Date.now();
    gameState.isGameOver=false; gameState.attackCooldown=0; gameState.lastMonsterContact={};
    gameState.gameStartTime=Date.now();
    let le=document.getElementById('loading'); if(le) le.style.display='none';
    startWave();
    window.gameState = gameState;
}

// ==================== 初始化 ====================
async function init(){
    window.addEventListener('resize',resizeCanvas);
    resizeCanvas();
    bindEvents();
    await loadLevel();
    requestAnimationFrame(gameLoop);
}
window.restartGameWithDifficulty=async function(difficulty){
    // 彻底重置所有状态
    var freshState={
        gold:0,availableCards:CARD_POOL.map(c=>({...c})),
        skillBar:[],shopCards:[],synergyLog:[],synergyActivated:{},
        hasMove:false,hasDash:false,
        towerFloor:1,towerClaimed:{},_towerAuto:false,_towerTimer:0,_towerCD:0,
        showingShop:false,
        aiEnabled:false,aiMode:'balanced',aiCooldown:0,_nextAIopTime:0,_lastTowerAutoTime:0,
        aiNeedEvade:false,_aiMoveLockUntil:0,_aiMoveAngle:undefined,_aiStuckFrames:0,
        _aiEscapeFrame:0,_aiEscapeAngle:0,_aiMoveMode:'',_aiRestarting:false,
        _timeFreeze:{active:false,timer:0,duration:6000,cooldown:0,totalCD:30000},
        monsters:[],particles:[],floatingTexts:[],
        currentPath:[],currentPathIndex:0,
        isBetweenWaves:true,betweenWaveTimer:Date.now(),
        wave:0,score:0,kills:0,maxWave:1,
        isGameOver:false,_waveEndTime:null,
        bossActive:false,bossTimer:0,bossDefeated:{},eliteCount:0,eliteSpawned:false,phase:'normal',bossMonster:null,
        gameCompleted:false,_victoryTimer:0,
        gameStartTime:Date.now(),lastSpawnTime:Date.now(),
        _hasTowerMonster:false,_towerSpawned:false,_towerTimedOut:false,
        _initX:180,_initY:460,
        cultivation:{
            branch:null, stage:0, studyPoints:0, upgradePoints:0,
            cultivationValue:0, swordCount:0, hasUltimate:false,
            swordBroken:false, swordLevel:1, swordDmgBonus:0,
            subStarterActive:false, subStarterTimer:0,
            showHiddenSword:false, hiddenSwordOpen:false,
            lastStudyRoll:0,
        }
    };
    if(gameState.player){
        freshState.player=gameState.player;
        freshState.player.x=Math.abs(freshState._initX);
        freshState.player.y=Math.abs(freshState._initY);
        freshState.player.hp=freshState.player.maxHp;
        freshState.player.mp=CONFIG.MAX_MP;
        freshState.player.extraAtk=0; freshState.player.extraAtkSpd=0;
        freshState.player.extraRange=0; freshState.player.extraSpd=0;
        freshState.player.iceCount=0; freshState.player.vamp=0;
        freshState.player.shield=0; freshState.player.critChance=0;
        freshState.player.isMoving=false;
        freshState.player._studyBoost=0; freshState.player._swordChance=0;
        freshState.player._swordDmg=0;
    }
    // 隐藏游戏结束面板
    var _gop=document.getElementById('gameover-panel');
    if(_gop) _gop.classList.remove('active');
    // 隐藏暂停面板  
    var _pp=document.getElementById('pause-overlay');
    if(_pp) _pp.classList.remove('active');
    Object.assign(gameState,freshState);
    // 全局变量重置（不在gameState上）
    chestCount=0; try{localStorage.removeItem('imp_chest_count');}catch(e){}
    equipSlots=[]; groundItems=[];
    if(typeof window.EMBEDDED_LEVEL_DATA!=='undefined'&&window.EMBEDDED_LEVEL_DATA)
        applyLevelData(window.EMBEDDED_LEVEL_DATA,difficulty);
    else {
        try{ let r=await fetch('/api/load'),d=await r.json();
            if(d.status==='success'&&d.data) applyLevelData(d.data,difficulty);
            else applyLevelData(generateDefaultLevelData(),difficulty); }
        catch(e){ applyLevelData(generateDefaultLevelData(),difficulty); }
    }
    // 应用角色属性
    applyHeroStats(window.SELECTED_HERO||'xian');
};
init();

// ==================== 角色属性应用 ====================
function applyHeroStats(heroKey){
    var hc=HERO_CLASSES[heroKey];
    if(!hc) return;
    currentHero=heroKey;
    var s=hc.stats;
    var cfg=gameState.config||DEFAULT_GAME_CONFIG;
    cfg.hero.maxHp=s.maxHp;
    cfg.hero.maxMp=s.maxMp;
    cfg.hero.mpRegen=s.mpRegen;
    cfg.hero.mpRegenInterval=s.mpRegenInterval;
    cfg.hero.walkSpeed=s.walkSpeed;
    cfg.hero.dashDistance=s.dashDistance;
    cfg.hero.dashMpCost=s.dashMpCost;
    cfg.hero.attackMin=s.attackMin;
    cfg.hero.attackMax=s.attackMax;
    cfg.hero.attackRange=s.attackRange;
    cfg.hero.attackCooldown=s.attackCooldown;
    cfg.hero.projectileSpeed=s.projectileSpeed;
    cfg.hero.projectileSize=s.projectileSize;
    cfg.hero.projectileColor=s.projectileColor;
    cfg.hero.initialGold=s.initialGold;
    cfg.hero.hpRestorePerWave=s.hpRestorePerWave;
    cfg.hero.mpRestorePerWave=s.mpRestorePerWave;
    cfg.hero.defense=s.defense;
    cfg.hero.contactDamage=s.contactDamage;
    cfg.hero.contactInterval=s.contactInterval;
    // 更新全局常量
    CONFIG.PLAYER_SPEED=s.walkSpeed;
    CONFIG.DASH_DISTANCE=s.dashDistance;
    CONFIG.MAX_MP=s.maxMp;
    // 更新玩家属性
    var p=gameState.player;
    if(p){
        p.maxHp=s.maxHp;
        p.hp=s.maxHp;
        p.maxMp=CONFIG.MAX_MP;
        p.mp=CONFIG.MAX_MP;
        // 忍者：基础暴击
        if(heroKey==='ninja') p.critChance=(p.critChance||0)+0.15;
    }
    // 更新初始金币
    gameState.gold=s.initialGold||400;
}

// ==================== 爬塔系统 ====================
function spawnTowerMonsters(){
    let f=gameState.towerFloor||1,ct=Math.min(3+Math.floor(f/10),8);
    gameState._towerSpawned=true;
    gameState._towerSpawnFloor=f;
    for(let i=0;i<ct;i++){
        let t={hp:80+((f-1)*12),sp:CONFIG.PLAYER_SPEED*0.8+(f-1)*0.01,dm:6+((f-1)*0.3),sz:22,cl:'#e056fd'};
        let hs=1+(f-1)*0.1,ds=1+(f-1)*0.04;
        // 从传送门出怪
        let sx=MAP_W/2+(Math.random()-0.5)*40, sy=75;
        let m=new Monster(sx,sy,{hp:Math.floor(t.hp*hs),speed:t.sp,damage:Math.floor(t.dm*ds),size:t.sz,color:t.cl});
        m.contactDmg=Math.floor(t.dm*ds);m._goldReward=Math.floor(50+f*5+Math.random()*10);m._isTowerMonster=true;m.target=gameState.player;
        gameState.monsters.push(m);
        // 传送门粒子
        for(let j=0;j<8;j++){
            gameState.particles.push(new Particle(sx,sy,'#e056fd',400,4,5));
            gameState.particles.push(new Particle(sx,sy,'#ffdd59',300,3,3));
        }
    }
    return true;
}
function drawBondBtnTR(){
    // 右上角图鉴按钮
    let bx=canvas.width-54, by=90;
    ctx.fillStyle='rgba(0,0,0,0.55)';ctx.beginPath();ctx.roundRect(bx-2,by-2,48,18,5);ctx.fill();
    ctx.fillStyle='#00d4ff';ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.fillText('📖 图鉴',bx+22,by+13);
}
window.drawBondBtnTR=drawBondBtnTR;

function drawTowerButton(){
    // 右下区域
    let bx=canvas.width-50,by=canvas.height*2/3+55;
    let hasAlive=gameState.monsters.some(function(m){return m&&m.hp>0&&m._isTowerMonster;});
    ctx.shadowColor='#ffdd59';ctx.shadowBlur=hasAlive?0:8;ctx.fillStyle=hasAlive?'rgba(50,50,50,0.4)':'rgba(0,0,0,0.6)';ctx.beginPath();ctx.roundRect(bx-2,by-2,44,44,8);ctx.fill();ctx.shadowBlur=0;
    ctx.strokeStyle=hasAlive?'#666':'#ffdd59';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(bx-2,by-2,44,44,8);ctx.stroke();
    ctx.fillStyle=hasAlive?'#888':'#ffdd59';ctx.font='22px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('🗼',bx+20,by+21);ctx.textBaseline='alphabetic';
    // 有塔怪存活时显示 30 秒超时倒计时
    if(hasAlive||gameState._towerAuto){
        var leftTD=Math.max(0,Math.ceil((30000-gameState._towerTimer)/1000));
        ctx.fillStyle='rgba(0,0,0,0.7)';ctx.beginPath();ctx.roundRect(bx+26,by-2,20,16,4);ctx.fill();
        ctx.fillStyle=leftTD<=5?'#ff4757':'#ffdd59';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(leftTD+'s',bx+36,by+6);ctx.textBaseline='alphabetic';
    }
    ctx.fillStyle=hasAlive?'#666':'#ffdd59';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText('Lv.'+(gameState.towerFloor||1),bx+20,by+52);
    // 自动开关
    let ay=by+56,ta=gameState._towerAuto||false;
    ctx.fillStyle=ta?'rgba(34,197,94,0.3)':'rgba(100,100,100,0.3)';ctx.strokeStyle=ta?'#22c55e':'#666';ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(bx-2+6,ay-2,32,20,10);ctx.fill();ctx.stroke();ctx.lineWidth=1.5;
    let dx=ta?bx-2+6+18:bx-2+6+4;ctx.fillStyle=ta?'#22c55e':'#888';ctx.beginPath();ctx.arc(dx,ay+8,7,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=ta?'#22c55e':'#666';
    ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText('自动',bx+20,ay+30);
    return {btn:{x:bx-2,y:by-2,w:44,h:44,disabled:hasAlive},auto:{x:bx-2+6,y:ay-2,w:32,h:20}};
}
window.drawTowerButton=drawTowerButton;


// ==================== 羁绊图鉴 ====================
function showBondPanel(){
    let o=document.getElementById('bond-overlay');if(!o)return;
    let l=document.getElementById('bond-list');if(!l)return;
    let sb=gameState.skillBar||[],ct={};
    for(let c2 of sb){if(c2&&c2.type) ct[c2.type]=(ct[c2.type]||0)+1;}
    let at=['warrior','assassin','mage','ice'],act=[],pen=[];
    for(let t of at){let cfg=CARD_TYPES[t];if(!cfg)continue;let cnt=ct[t]||0,nd=cfg.threshold||3,isAct=gameState.synergyActivated&&gameState.synergyActivated[t];
        let ac2=isAct?'activated':'dimmed',h='<div class="bond-type '+ac2+'" onclick="showBondDetail(\''+t+'\')"><div class="bond-type-header"><span class="bond-type-name'+(isAct?'':' dimmed')+'">'+cfg.icon+' '+cfg.name+'</span><span class="bond-type-badge '+(isAct?'activated':'dimmed')+'">'+(isAct?'✅ 已激活':'⏳ '+cnt+'/'+nd)+'</span></div><div class="bond-type-desc'+(isAct?'':' dimmed')+'">'+cfg.desc+'</div></div>';
        (isAct?act:pen).push({type:t,count:cnt,html:h});
    }
    act.sort(function(a,b){return b.count-a.count;});pen.sort(function(a,b){return b.count-a.count;});
    let all=act.concat(pen),ch='';
    for(let i=0;i<all.length;i++) ch+=all[i].html;
    if(all.length===0) ch='<div style="padding:30px 0;color:#666;font-size:13px;">还没有收集到任何卡牌<br>先去 🎴 抽卡获取卡牌吧</div>';
    l.innerHTML='<div class=\"bond-items\">'+ch+'</div>';o.classList.add('active');
}
window.showBondPanel=showBondPanel;
function hideBondPanel(){let o=document.getElementById('bond-overlay');if(o)o.classList.remove('active');hideBondDetail();}
window.hideBondPanel=hideBondPanel;
function showBondDetail(type){
    let cfg=CARD_TYPES[type];if(!cfg)return;
    let sb=gameState.skillBar||[],cnt=0;for(let i=0;i<sb.length;i++){if(sb[i].type===type) cnt++;}
    let act=gameState.synergyActivated&&gameState.synergyActivated[type],nd=cfg.threshold||3;
    let cs=[];for(let i=0;i<CARD_POOL.length;i++){if(CARD_POOL[i].type===type&&type!=='move'&&type!=='dodge') cs.push(CARD_POOL[i]);}
    let d=document.getElementById('bond-detail');if(!d)return;
    let h='<div class="bond-detail-header"><span class="bond-detail-title">'+cfg.icon+' '+cfg.name+'</span><span class="bond-detail-status '+(act?'active':'dimmed')+'">'+(act?'✅ 已激活':'⏳ '+cnt+'/'+nd)+'</span></div>';
    h+='<div class="bond-detail-desc">羁绊效果：'+cfg.desc+'</div><div class="bond-detail-cards">';
    for(let i=0;i<cs.length;i++){let card=cs[i],own=false;for(let j=0;j<sb.length;j++){if(sb[j].name===card.name){own=true;break;}}
        h+='<div class="bond-detail-card'+(own?' owned':'')+'"><div class="bdc-icon">'+(own?card.icon:'❓')+'</div><div class="bdc-info"><div class="bdc-name'+(own?'':' dimmed')+'">'+card.name+'</div><div class="bdc-effect'+(own?'':' dimmed')+'">'+(card.effect||'')+'</div></div><div class="bdc-own">'+(own?'✅':'')+'</div></div>';}
    h+='</div><div class="bond-detail-progress"><div class="bdc-title">收集进度：'+cnt+'/'+nd+'</div>';
    let pct=Math.min(100,(cnt/nd)*100);h+='<div class="bar"><div class="bar-fill" style="width:'+pct+'%;background:'+(act?'#22c55e':cfg.color)+'"></div></div></div>';
    h+='<button class="bond-detail-back" onclick="hideBondDetail()">✖ 返回</button>';d.innerHTML=h;
    document.getElementById('bond-detail-overlay').classList.add('active');
}
function hideBondDetail(){let o=document.getElementById('bond-detail-overlay');if(o)o.classList.remove('active');}
window.showBondDetail=showBondDetail;window.hideBondDetail=hideBondDetail;

// ==================== 宝箱UI (v3.3) ====================
function drawChestIcon(){
    if(chestCount<=0) return;
    var bx=canvas.width-50, by=canvas.height*2/3-5;
    ctx.shadowColor='#ffd700';ctx.shadowBlur=10;
    ctx.fillStyle='rgba(0,0,0,0.65)';ctx.beginPath();ctx.roundRect(bx-2,by-2,44,44,10);ctx.fill();
    ctx.shadowBlur=0;
    ctx.strokeStyle='#ffd700';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(bx-2,by-2,44,44,10);ctx.stroke();
    ctx.font='24px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('📦',bx+20,by+21);ctx.textBaseline='alphabetic';
    if(chestCount>1){
        ctx.fillStyle='rgba(0,0,0,0.7)';ctx.beginPath();ctx.roundRect(bx+24,by-4,18,16,5);ctx.fill();
        ctx.fillStyle='#ff4757';ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('×'+chestCount,bx+33,by+4);ctx.textBaseline='alphabetic';
    }
    ctx.fillStyle='#ffd700';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText('宝箱',bx+20,by+52);
    return {x:bx-2,y:by-2,w:44,h:44};
}
function checkChestClick(sx,sy){
    if(chestCount<=0) return false;
    var bx=canvas.width-50,by=canvas.height*2/3-5;
    if(sx>=bx-2&&sx<=bx+42&&sy>=by-2&&sy<=by+42){
        openChestCard();
        return true;
    }
    return false;
}
// ===== 时间静止大招按钮 =====
function drawTimeFreezeBtn(){
    var tf=gameState._timeFreeze;
    var bx=6,by=canvas.height/2+3,bw=34,bh=34;
    var ready=!tf.active&&tf.cooldown<=0;
    var bg=ready?'rgba(0,212,255,0.12)':'rgba(50,50,50,0.35)';
    var fg=ready?'#00d4ff':(tf.active?'#ff6b6b':'#555');
    ctx.shadowColor=ready?'#00d4ff':'transparent';ctx.shadowBlur=ready?8:0;
    ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(bx,by,bw,bh,6);ctx.fill();ctx.shadowBlur=0;
    ctx.strokeStyle=fg;ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(bx,by,bw,bh,6);ctx.stroke();
    ctx.font='15px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(tf.active?'⏸':'⏰',bx+bw/2,by+bh/2);
    ctx.textBaseline='alphabetic';
    // 冷却指示
    if(!ready&&!tf.active){
        var cdLeft=Math.ceil(tf.cooldown/1000);
        ctx.fillStyle='rgba(0,0,0,0.5)';ctx.beginPath();ctx.roundRect(bx,by,bw,bh,6);ctx.fill();
        ctx.fillStyle='#888';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(cdLeft+'s',bx+bw/2,by+bh/2);ctx.textBaseline='alphabetic';
    }
    // 标签
    ctx.fillStyle=ready?'#00d4ff':'#555';ctx.font='bold 7px Arial';ctx.textAlign='center';
    ctx.fillText('时间',bx+bw/2,by+bh+9);
    ctx.fillText('静止',bx+bw/2,by+bh+17);
    return {x:bx,y:by,w:bw,h:bh};
}
// ==================== 藏剑点击处理 ====================
function handleHiddenSwordClick(sx, sy){
    var cult = gameState.cultivation;
    if(!cult) return;

    // 藏剑面板打开时 → 检测面板按钮
    if(cult.hiddenSwordOpen){
        // 关闭按钮
        if(cult._hsBtnClose && sx>=cult._hsBtnClose.x && sx<=cult._hsBtnClose.x+cult._hsBtnClose.w
            && sy>=cult._hsBtnClose.y && sy<=cult._hsBtnClose.y+cult._hsBtnClose.h){
            cult.hiddenSwordOpen = false;
            return;
        }

        // A: 升级残剑
        if(cult._hsBtnA && sx>=cult._hsBtnA.x && sx<=cult._hsBtnA.x+cult._hsBtnA.w
            && sy>=cult._hsBtnA.y && sy<=cult._hsBtnA.y+cult._hsBtnA.h){
            if((cult.upgradePoints||0) <= 0){
                screenText('⚠️ 需要金卡回收获得升级次数!', '#ff4757', 1200);
                return;
            }
            // 消耗1升级次数，低成功率
            var successRate = 0.3 + (cult.swordLevel||1) * 0.02; // 基础30%，每级+2%
            if(Math.random() < successRate){
                cult.upgradePoints = Math.max(0, (cult.upgradePoints||0) - 1);
                cult.swordLevel = (cult.swordLevel||1) + 1;
                cult.swordDmgBonus = (cult.swordDmgBonus||0) + 5;
                screenText('🔨 残剑升级成功! Lv.'+cult.swordLevel, '#ffa500', 1500);
                for(var pi=0; pi<15; pi++){
                    gameState.particles.push(new Particle(gameState.camera.x+canvas.width/2, gameState.camera.y+canvas.height/2, '#ffa500', 600, 3, 5));
                }
            } else {
                screenText('❌ 升级失败 (次数已消耗)', '#ff4757', 1000);
                cult.upgradePoints = Math.max(0, (cult.upgradePoints||0) - 1);
            }
            return;
        }

        // B: 学习技能（回收L3卡）
        if(cult._hsBtnB && sx>=cult._hsBtnB.x && sx<=cult._hsBtnB.x+cult._hsBtnB.w
            && sy>=cult._hsBtnB.y && sy<=cult._hsBtnB.y+cult._hsBtnB.h){
            if((cult.studyPoints||0) <= 0){
                screenText('⚠️ 学习次数不足! 打怪可获得', '#ff4757', 1200);
                return;
            }
