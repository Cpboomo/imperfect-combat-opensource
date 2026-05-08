// game-logic.js — Coordinates, pathfinding, movement, combat, waves, cards, cultivation

// ==================== Canvas ====================
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// ==================== 坐标系统 ====================
function worldToScreen(wx, wy) { return { x: wx - gameState.camera.x, y: wy - gameState.camera.y }; }
function screenToWorld(sx, sy) { return { x: sx + gameState.camera.x, y: sy + gameState.camera.y }; }
function getCanvasRect() { return canvas.getBoundingClientRect(); }
function worldToGrid(wx, wy) { return { x: Math.floor(wx / CONFIG.GRID_SIZE), y: Math.floor(wy / CONFIG.GRID_SIZE) }; }
function gridToWorld(gx, gy) { return { x: gx * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE/2, y: gy * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE/2 }; }

// ==================== 碰撞检测 ====================
function isWallByGrid(gx, gy) {
    if (gx < 0 || gx >= CONFIG.GRID_COLS || gy < 0 || gy >= CONFIG.GRID_ROWS) return true;
    const cell = gameState.grid[gy]?.[gx];
    return cell && cell.type === 'wall';
}
function canMoveTo(x, y) {
    const hs = CONFIG.PLAYER_SIZE/2, m = 2;
    const pts = [{x:x-hs+m,y:y-hs+m},{x:x+hs-m,y:y-hs+m},{x:x-hs+m,y:y+hs-m},{x:x+hs-m,y:y+hs-m},{x,y}];
    for (let p of pts) { const g = worldToGrid(p.x,p.y); if (isWallByGrid(g.x,g.y)) return false; }
    return true;
}
function isWall(wx, wy) {
    if (!gameState.grid || gameState.grid.length===0) return false;
    const g = worldToGrid(wx,wy);
    return isWallByGrid(g.x,g.y);
}

// ==================== A* 寻路 ====================
class ANode { constructor(x,y){this.x=x;this.y=y;this.g=0;this.h=0;this.f=0;this.parent=null;} }
function heuristic(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
function getNeighbors(node) {
    const ns=[], dirs=[{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}];
    for(let d of dirs){ let nx=node.x+d.x,ny=node.y+d.y;
        if(nx>=0&&nx<CONFIG.GRID_COLS&&ny>=0&&ny<CONFIG.GRID_ROWS&&!isWallByGrid(nx,ny)) ns.push(new ANode(nx,ny));
    } return ns;
}
function findPath(sx,sy,ex,ey) {
    if(isWallByGrid(ex,ey)){ let nr=findNearestWalkable(ex,ey); if(nr){ex=nr.x;ey=nr.y;}else return []; }
    let sn=new ANode(sx,sy), en=new ANode(ex,ey), ol=[sn], cl=[], nm=new Map();
    nm.set(sx+','+sy,sn);
    while(ol.length>0){
        let ci=0; for(let i=1;i<ol.length;i++) if(ol[i].f<ol[ci].f) ci=i;
        let cn=ol[ci];
        if(cn.x===en.x&&cn.y===en.y){ let p=[]; while(cn){p.unshift({x:cn.x,y:cn.y});cn=cn.parent;} return p; }
        ol.splice(ci,1); cl.push(cn);
        for(let nb of getNeighbors(cn)){
            if(cl.some(n=>n.x===nb.x&&n.y===nb.y)) continue;
            let gs=cn.g+1, key=nb.x+','+nb.y, eno=nm.get(key);
            if(!eno||gs<eno.g){ nb.g=gs; nb.h=heuristic(nb,en); nb.f=nb.g+nb.h; nb.parent=cn;
                if(!eno){ol.push(nb);nm.set(key,nb);} }
        }
    } return [];
}
function findNearestWalkable(gx,gy){
    for(let r=1;r<Math.max(CONFIG.GRID_COLS,CONFIG.GRID_ROWS);r++)
        for(let dx=-r;dx<=r;dx++) for(let dy=-r;dy<=r;dy++){
            if(Math.abs(dx)+Math.abs(dy)>r) continue;
            let nx=gx+dx,ny=gy+dy;
            if(nx>=0&&nx<CONFIG.GRID_COLS&&ny>=0&&ny<CONFIG.GRID_ROWS&&!isWallByGrid(nx,ny)) return {x:nx,y:ny};
        }
    return null;
}

// ==================== 矢量移动 ====================
function calculateVector(cx, cy, tx, ty, spd) {
    let dx=tx-cx, dy=ty-cy, dist=Math.sqrt(dx*dx+dy*dy);
    if(dist<0.001) return {x:0,y:0,dist:0,arrived:true};
    let ang=Math.atan2(dy,dx);
    return { x:Math.cos(ang)*spd, y:Math.sin(ang)*spd, dist, angle:ang, arrived:dist<spd||dist<4 };
}

// ==================== 粒子系统 ====================
class Particle {
    constructor(x,y,color,life=400,size=3,speed=2){
        this.x=x; this.y=y; this.color=color; this.life=life; this.maxLife=life;
        this.size=size; this.speed=speed;
        this.angle=Math.random()*Math.PI*2;
        this.vx=Math.cos(this.angle)*speed*(0.5+Math.random());
        this.vy=Math.sin(this.angle)*speed*(0.5+Math.random());
    }
    update(dt){ this.x+=this.vx; this.y+=this.vy; this.life-=dt; this.size*=0.98; }
    draw(ctx){
        let alpha=this.life/this.maxLife, pos=worldToScreen(this.x,this.y);
        ctx.globalAlpha=alpha; ctx.fillStyle=this.color;
        ctx.beginPath(); ctx.arc(pos.x,pos.y,this.size,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=1;
    }
    get alive(){ return this.life>0; }
}
class FloatingText {
    constructor(x,y,text,color='#fff',life=800){
        this.x=x; this.y=y; this.text=text; this.color=color; this.life=life; this.maxLife=life;
    }
    update(dt){ this.y-=0.5; this.life-=dt; }
    draw(ctx){
        let alpha=this.life/this.maxLife, pos=worldToScreen(this.x,this.y);
        ctx.globalAlpha=alpha; ctx.fillStyle=this.color;
        ctx.font='bold 16px Arial'; ctx.textAlign='center';
        ctx.fillText(this.text,pos.x,pos.y);
        ctx.globalAlpha=1;
    }
    get alive(){ return this.life>0; }
}

// ==================== 闪现系统 ====================
function getMP(){ return gameState.player?(gameState.player.mp||0):0; }
function canDash(){ return gameState.hasDash && getMP()>=CONFIG.DASH_COST; }
function regenMP(){
    if(!gameState.player) return;
    let now=Date.now();
    if(now-gameState.lastMpRegen>=CONFIG.MP_REGEN_INTERVAL){
        let amt=(CONFIG.MP_REGEN_RATE*CONFIG.MP_REGEN_INTERVAL)/1000;
        gameState.player.mp=Math.min(CONFIG.MAX_MP, gameState.player.mp+amt);
        gameState.lastMpRegen=now;
    }
}
function findNearestValidPosition(tx,ty,maxR){
    if(canMoveTo(tx,ty)) return {x:tx,y:ty};
    let step=CONFIG.GRID_SIZE/2;
    for(let r=step;r<=maxR;r+=step)
        for(let a=0;a<Math.PI*2;a+=Math.PI/8){
            let px=tx+Math.cos(a)*r, py=ty+Math.sin(a)*r;
            if(canMoveTo(px,py)) return {x:px,y:py};
        }
    return {x:gameState.player.x,y:gameState.player.y};
}
function performDash(fx,fy,tx,ty){
    if(!gameState.player||!canDash()) return false;
    gameState.player.mp-=CONFIG.DASH_COST;
    inputState.dashEffects.push({fromX:fx,fromY:fy,toX:tx,toY:ty,startTime:Date.now(),duration:250});
    gameState.player.isDashing=true;
    setTimeout(()=>{if(gameState.player)gameState.player.isDashing=false;},180);
    SFX.dash();
    for(let i=0;i<8;i++) gameState.particles.push(new Particle(fx+(tx-fx)*Math.random(),fy+(ty-fy)*Math.random(),'#00d4ff',300,2,1.5));
    return true;
}

// ==================== 战斗系统 ====================
function getAttackDamage(){
    let cfg = gameState.config || DEFAULT_GAME_CONFIG;
    let p=gameState.player, base=(cfg.hero.attackMin || 15) + Math.random()*((cfg.hero.attackMax || 25)-(cfg.hero.attackMin || 15));
    let dmg=base+(p.extraAtk||0);
    // 暴击
    if(p.critChance&&Math.random()<p.critChance){ dmg*=2; return dmg; }
    return dmg;
}
function distance(a,b){ return Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2); }

function attackNearestMonster(){
    if(!gameState.player||gameState.isGameOver) return;
    let now=Date.now();
    let p=gameState.player;
    let cfg = gameState.config || DEFAULT_GAME_CONFIG;
    let coolDown=(cfg.hero.attackCooldown||600)/(1+(p.extraAtkSpd||0));
    if(now-gameState.attackCooldown<coolDown) return;

    let nearest=null, nearestDist=(cfg.hero.attackRange||160)+(p.extraRange||0);
    for(let m of gameState.monsters){
        let d=distance(gameState.player,m);
        if(d<nearestDist){ nearestDist=d; nearest=m; }
    }
    if(!nearest) return;

    let dmg=getAttackDamage();
    gameState.attackCooldown=now;
    SFX.attack();
    // 创建弹道
    let projCfg = {
        speed: cfg.hero.projectileSpeed || 800,
        size: cfg.hero.projectileSize || 8,
        color: cfg.hero.projectileColor || '#ffdd59',
        damage: dmg,
        iceEffect: (p.iceCount||0) > 0 ? 800 * (p.iceCount||0) : 0
    };
    // 攻击蓄力火花
    var atkAngle=Math.atan2(nearest.y-p.y,nearest.x-p.x);
    for(var i=0;i<10;i++) gameState.particles.push(
        new Particle(p.x+Math.cos(atkAngle)*CONFIG.PLAYER_SIZE/2,p.y+Math.sin(atkAngle)*CONFIG.PLAYER_SIZE/2,projCfg.color,200,4,3));
    gameState.projectiles.push(new Projectile(p.x, p.y, nearest, projCfg));

    // ===== 职业专属特效 =====
    var heroKey = gameState._selectedHero || 'xian';
    if(heroKey === 'ninja' && Math.random() < 0.2){
        // 忍者：20%概率投掷苦无（额外小弹道）
        var kunaiCfg = Object.assign({}, projCfg);
        kunaiCfg.size = 4;
        kunaiCfg.damage = Math.floor(dmg * 0.5);
        kunaiCfg.color = '#ff4757';
        kunaiCfg.speed = 1000;
        // 找另1个活怪做目标（没有则用同一个）
        var altTarget = null;
        for(var _m of gameState.monsters){ if(_m.hp>0 && _m !== nearest){ altTarget=_m; break; } }
        gameState.projectiles.push(new Projectile(p.x, p.y, altTarget||nearest, kunaiCfg));
        // 忍具火花
        for(var _pi=0;_pi<5;_pi++) gameState.particles.push(
            new Particle(p.x+Math.cos(atkAngle)*CONFIG.PLAYER_SIZE/2,p.y+Math.sin(atkAngle)*CONFIG.PLAYER_SIZE/2,'#ff4757',150,3,2));
    }
    if(heroKey === 'psyker' && Math.random() < 0.25){
        // 超能力者：25%概率念力扩散（弹道分裂出2颗小念力波）
        var splitAngle = atkAngle + (Math.random()-0.5) * 0.6;
        var psycCfg = Object.assign({}, projCfg);
        psycCfg.size = 5;
        psycCfg.damage = Math.floor(dmg * 0.35);
        psycCfg.color = '#a855f7';
        // 找另1~2个活怪
        var altTargets = [];
        for(var _m2 of gameState.monsters){ if(_m2.hp>0 && _m2 !== nearest && altTargets.length<2){ altTargets.push(_m2); } }
        for(var _ti=0; _ti<altTargets.length; _ti++){
            gameState.projectiles.push(new Projectile(p.x, p.y, altTargets[_ti], psycCfg));
            for(var _pj=0;_pj<3;_pj++) gameState.particles.push(
                new Particle(p.x+Math.cos(splitAngle)*CONFIG.PLAYER_SIZE/2,p.y+Math.sin(splitAngle)*CONFIG.PLAYER_SIZE/2,'#a855f7',150,3,2));
        }
    }

    // 剑光触发（修仙系统）
    var cult=gameState.cultivation;
    if(cult && (cult.swordCount>0 || cult.hasUltimate) && cult.stage>=2){
        var swordChance = (p._swordChance||0) + 0.1; // 基础10% + 蓝卡加成
        if(cult.hasUltimate) swordChance += 0.3; // 万剑归宗+30%
        // 每道剑光独立判定
        var totalSwords = cult.hasUltimate ? Math.min(10, (cult.swordCount||0)+3) : Math.min((cult.swordCount||0), 5);
        for(var si=0; si<totalSwords; si++){
            if(Math.random() < swordChance){
                // 射出一道剑光
                var swordDmg = dmg * 0.5 + (p._swordDmg||0) + (cult.swordDmgBonus||0);
                var swordProj = {
                    speed: 1200, size: 6, color: '#ffd700',
                    damage: Math.floor(swordDmg),
                    iceEffect: 0
                };
                // 找最近的活怪（或随机目标）
                var swTarget = nearest;
                for(var sm of gameState.monsters){
                    if(sm.hp > 0 && sm !== nearest && Math.random()<0.3){
                        swTarget = sm; break;
                    }
                }
                gameState.projectiles.push(new Projectile(p.x, p.y, swTarget, swordProj));
            }
        }
    }

    // 枪口火花
    for(let i=0;i<6;i++) gameState.particles.push(
        new Particle(p.x,p.y,projCfg.color,300,5,3));
    // 粒子+浮动文字（伤害由弹道命中后显示）
    for(let i=0;i<5;i++)
        gameState.particles.push(new Particle(nearest.x,nearest.y,'#ffdd59',250,3,3));
}

function killMonster(monster){
    monster.alive=false;
    let idx=gameState.monsters.indexOf(monster);
    if(idx>=0) gameState.monsters.splice(idx,1);
    gameState.kills++;
    gameState.score+=100;
    // 金币奖励
    let goldReward = monster._goldReward || (10 + Math.floor(Math.random()*6) + Math.floor(gameState.wave*2));
    gameState.gold += goldReward;
    SFX.kill();
    // 吸血
    let p=gameState.player;
    if(p&&p.vamp){ p.hp=Math.min(p.maxHp,p.hp+p.vamp); gameState.floatingTexts.push(new FloatingText(p.x,p.y-35,'+'+p.vamp+'HP','#ff6b81',500)); }
    // 死亡粒子 — 果汁飞溅
    let fruitColors=[monster.color,'#ff6b6b','#ffd93d','#6bcb77','#ff9ff3','#ff9f43'];
    for(let i=0;i<25;i++){
        let fc=fruitColors[Math.floor(Math.random()*fruitColors.length)];
        let sp=2+Math.random()*5;
        let ang=Math.random()*Math.PI*2;
        let p=new Particle(monster.x,monster.y,fc,600,3+Math.random()*3,sp);
        p.vx=Math.cos(ang)*sp; p.vy=Math.sin(ang)*sp;
        gameState.particles.push(p);
    }
    gameState.floatingTexts.push(new FloatingText(monster.x,monster.y-15,'+'+goldReward+'💰','#ffdd59',700));

    // Boss死亡 → 结束波次
    if(monster._isBoss && gameState.phase === 'boss'){
        gameState.bossActive = false;
        endWave();
    }
}

function checkMonsterContact(){
    if(!gameState.player||gameState.isGameOver) return;
    let now=Date.now();
    let cfgDef=(gameState.config?.hero?.defense)||0;
    for(let m of gameState.monsters){
        let d=distance(gameState.player,m);
        if(d<CONFIG.PLAYER_SIZE/2+m.size/2){
            let lastHit=gameState.lastMonsterContact[m.id]||0;
            // 碰撞推开：玩家和怪物之间相互排斥
            var pushAngle=Math.atan2(gameState.player.y-m.y,gameState.player.x-m.x);
            var pushForce=1.2;
            gameState.player.x+=Math.cos(pushAngle)*pushForce;
            gameState.player.y+=Math.sin(pushAngle)*pushForce;
            m.x-=Math.cos(pushAngle)*pushForce*0.5;
            m.y-=Math.sin(pushAngle)*pushForce*0.5;
            if(now-lastHit>CONFIG.MONSTER_CONTACT_INTERVAL){
                let dmg=m.contactDmg||CONFIG.MONSTER_CONTACT_DAMAGE;
                let p=gameState.player;
                // 护盾吸收
                if(p.shield&&p.shield>0){
                    let absorbed=Math.min(p.shield,dmg);
                    p.shield-=absorbed; dmg-=absorbed;
                    gameState.floatingTexts.push(new FloatingText(p.x,p.y-35,'🛡️ 吸收'+absorbed,'#70a1ff',500));
                }
                p.hp-=Math.max(1,dmg-cfgDef);
                gameState.lastMonsterContact[m.id]=now;
                // 玩家碰撞击退
                var pkAngle=Math.atan2(p.y-m.y,p.x-m.x);
                p._kbX=(p._kbX||0)+Math.cos(pkAngle)*3;
                p._kbY=(p._kbY||0)+Math.sin(pkAngle)*3;
                // AI 被击中标记：触发紧急闪现
                if(gameState.aiEnabled) gameState.aiNeedEvade=true;
                if(dmg>0) SFX.hurt();
                gameState.floatingTexts.push(new FloatingText(p.x,p.y-20,'-'+dmg,'#ff4444',500));
                for(let i=0;i<4;i++)
                    gameState.particles.push(new Particle(p.x,p.y,'#ff4444',300,2,2));
                if(p.hp<=0){ p.hp=0; triggerGameOver(); return; }
            }
        }
    }
}

// ==================== 波次系统 ====================
// ==================== 波次系统（配置驱动）====================
function getWaveConfig(){
    let cfg = gameState.config || DEFAULT_GAME_CONFIG;
    let waves = cfg.waves || [];
    let idx = gameState.wave - 1;
    if(idx < waves.length) return waves[idx];
    // 超出配置的波次：自动生成
    let base = waves.length > 0 ? waves[waves.length-1] : { monsters: { dog: 8 } };
    let scaled = {};
    for(let [type,count] of Object.entries(base.monsters)){
        scaled[type] = Math.min(Math.round(count * Math.pow(1.15, idx-waves.length+1)), 30);
    }
    return { monsters: scaled };
}
function getWaveSpawnInterval(){
    let base=gameState.spawnInterval;
    for(let i=1;i<gameState.wave;i++) base*=0.9;
    return Math.max(base*0.3, base);
}
function getWaveMonsterCount(){
    let wc = getWaveConfig().monsters || {};
    let total = 0;
    for(let k of Object.keys(wc)) total += wc[k];
    return total || 8;
}

function startWave(){
    gameState.wave++;
    if(gameState.wave>gameState.maxWave) gameState.maxWave=gameState.wave;
    // 重置阶段
    gameState.phase = 'normal';
    gameState.bossActive = false;
    gameState.bossTimer = 0;
    gameState.bossMonster = null;
    gameState.eliteSpawned = false;
    gameState.eliteCount = 0;
    gameState.waveMonstersSpawned=0;
    gameState.waveMonstersTarget=getWaveMonsterCount();
    gameState.waveTimer=0;
    let cfg = gameState.config || DEFAULT_GAME_CONFIG;
    gameState.waveTotalTime=cfg.monsters.waveDuration||25;
    gameState.isBetweenWaves=false;
    gameState.lastSpawnTime=Date.now();
    // 生成此波次的普通怪物队列
    gameState._waveSpawnTypes = [];
    let wc = getWaveConfig().monsters || {};
    let mt = cfg.monsters.types || {};
    for(let [type,count] of Object.entries(wc)){
        let tdef = mt[type] || { hp:50, speed:2, damage:8, size:25, color:'#ff6348', score:100 };
        for(let i=0;i<count;i++) gameState._waveSpawnTypes.push({ type, def:tdef });
    }
    // 打乱顺序
    for(let i=gameState._waveSpawnTypes.length-1;i>0;i--){
        let j=Math.floor(Math.random()*(i+1));
        [gameState._waveSpawnTypes[i],gameState._waveSpawnTypes[j]] = [gameState._waveSpawnTypes[j],gameState._waveSpawnTypes[i]];
    }
    SFX.wave();
    screenText('⚔ 第 '+gameState.wave+' 波 ⚔', '#ffdd59', 1500);
}

function endWave(){
    gameState.isBetweenWaves=true;
    gameState.betweenWaveTimer=0;
    gameState.phase = 'normal';
    // 记录Boss已击败
    gameState.bossDefeated[gameState.wave] = true;
    // Boss掉落道具（前4波 + 每5轮一次）
    let bdef = getBossDef(gameState.wave);
    if(bdef && bdef.itemDrop){
        let item = EQUIPMENT_ITEMS[bdef.itemDrop];
        if(item){
            var itemObj = {key:bdef.itemDrop, name:item.name, icon:item.icon, desc:item.desc, apply:item.apply};
            var _hasSword=(gameState.cultivation&&gameState.cultivation.swordBroken)?1:0;
            var _emptySlots = 5 - _hasSword - equipSlots.length;
            if(_emptySlots > 0){
                equipSlots.push(itemObj);
                if(item.apply && gameState.player) item.apply(gameState.player);
                screenText('🎁 获得道具: '+item.icon+' '+item.name+'!', '#ffd700', 2500);
            } else {
                // 道具栏满了 → 掉到人物脚下
                if(gameState.player){
                    groundItems.push({x:gameState.player.x, y:gameState.player.y, item:itemObj, lifeTimer:30000});
                    screenText('🎁 '+item.icon+' '+item.name+'掉落在了地上!', '#ffd700', 2500);
                }
            }
        }
    }
    // 恢复
    let cfg = gameState.config || DEFAULT_GAME_CONFIG;
    gameState.player.hp=Math.min(gameState.player.maxHp, gameState.player.hp+(cfg.hero.hpRestorePerWave||30));
    gameState.player.mp=Math.min(CONFIG.MAX_MP, gameState.player.mp+(cfg.hero.mpRestorePerWave||50));
    gameState.score+=gameState.wave*80;
    // 判断是否为最后一波（无尽模式波99后通关）
    if(gameState.wave >= MAX_WAVES){
        screenText('🎉 恭喜通关! 不灭魔王已被击败!', '#ffd700', 5000, -40);
        gameState.gameCompleted = true;
        gameState._victoryTimer = 5000;
        triggerVictory();
    } else if(gameState.wave >= 6 && gameState.wave % 5 !== 0){
        screenText('波次完成! 继续挑战!', '#7bed9f', 1500, 30);
    } else if(gameState.wave % 5 === 0){
        screenText('💀 Boss击败! 继续深入!', '#ffd700', 1500, 30);
    } else {
        screenText('波次完成! 下一波即将到来', '#7bed9f', 1500, 30);
    }
    // 波次结束自动弹出商店（非最后一波）
    if(!gameState.gameCompleted){
        setTimeout(function(){
            // 如果商店为空，自动刷新
            if(!gameState.shopCards || gameState.shopCards.length === 0){
                refreshCardShop();
            }
            showCardShopUI();
        }, 500);
    }
    gameState._waveEndTime=Date.now();
}

// ==================== 精英/Boss生成 ====================
function spawnEliteMonsters(){
    let count = 2 + Math.floor(Math.random()*2);
    for(let i=0;i<count;i++){
        let picks = [...ELITE_TYPES];
        let ei = gameState.wave >= 4 ? Math.floor(Math.random()*3) : Math.floor(Math.random()*2);
        let edef = picks[ei];
        let hpMul = 1 + (gameState.wave-1)*0.3;
        let sx = MAP_W/2+(Math.random()-0.5)*60, sy=75;
        let monster = new Monster(sx,sy,{
            hp:Math.round(edef.hp*hpMul), speed:CONFIG.PLAYER_SPEED*edef.speedRatio,
            damage:edef.damage+Math.floor(gameState.wave*2), size:edef.size,
            color:edef.color
        });
        monster._elite = true;
        monster.contactDmg = edef.damage;
        monster._goldReward = edef.gold + gameState.wave*10;
        monster.target = gameState.player;
        for(let j=0;j<15;j++){
            gameState.particles.push(new Particle(sx,sy,'#ffd700',500,5,6));
        }
        screenText('⚡ '+edef.name+'出现!', edef.color, 1200, -40);
        gameState.monsters.push(monster);
    }
    gameState.eliteSpawned = true;
}

function spawnBoss(){
    let bdef = getBossDef(gameState.wave);
    if(!bdef) return;
    let hpMul = currentDifficulty ? (DIFFICULTY_MULTIPLIERS[currentDifficulty]?.hpMul || 1) : 1;
    let sx = MAP_W/2, sy=75;
    let monster = new Monster(sx,sy,{
        hp:Math.round(bdef.hp*hpMul), speed:CONFIG.PLAYER_SPEED*bdef.speedRatio,
        damage:bdef.damage, size:bdef.size, color:bdef.color
    });
    monster._isBoss = true;
    monster.contactDmg = bdef.damage;
    monster._goldReward = bdef.goldReward;
    monster.target = gameState.player;
    // Boss出场特效
    for(let i=0;i<30;i++){
        let c = i%2===0?'#ffd700':'#dc2626';
        gameState.particles.push(new Particle(sx,sy,c,800,6,8));
    }
    screenText('💀 '+bdef.icon+' '+bdef.name+'降临!', '#dc2626', 2000, -60);
    screenText('⏱️ '+Math.floor(BOSS_TIME_LIMIT/1000)+'秒内击败!', '#ffd700', 2000, -20);
    gameState.bossActive = true;
    gameState.bossTimer = BOSS_TIME_LIMIT;
    gameState.bossMonster = monster;
    gameState.monsters.push(monster);
    SFX.wave();
}

// ==================== 道具详情 & 拖拽系统 ====================
function showEqDetailOverlay(item){
    var el=document.getElementById('eq-detail-overlay');
    if(!el) return;
    document.getElementById('eq-detail-icon').textContent = item.icon||'🗡️';
    document.getElementById('eq-detail-name').textContent = item.name||'道具';
    document.getElementById('eq-detail-desc').textContent = item.desc||'';
    el.style.display='flex';
}
function hideEqDetail(){
    var el=document.getElementById('eq-detail-overlay');
    if(el) el.style.display='none';
    showEqDetail=null;
}

// ============================================================
// 统一指针交互：桌面鼠标 + 移动端触屏
// ============================================================
// 深拷贝工具函数（保留函数引用）
function __deepCopy(obj){
    if(typeof obj!=='object'||obj===null) return obj;
    // JSON方式做结构化复制，手动恢复函数
    var r=JSON.parse(JSON.stringify(obj));
    for(var k in obj){
        if(typeof obj[k]==='function') r[k]=obj[k];
    }
    return r;
}
let pointerStart=null, pointerHitType=null, pointerHitData=null;
let viewingGroundIdx=-1;
let groundItemRegions=[];
const DRAG_THRESHOLD=20;

function getCanvasPos(e){
    var rect=canvas.getBoundingClientRect();
    return {x:(e.clientX-rect.left)*(canvas.width/rect.width),y:(e.clientY-rect.top)*(canvas.height/rect.height)};
}
function hitTestAll(x,y){
    for(var i=0;i<eqSlotRegions.length;i++){
        var r=eqSlotRegions[i];
        if(r.item&&x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h) return {type:'eqSlot',index:i,item:r.item,region:r};
    }
    for(var i=0;i<groundItemRegions.length;i++){
        var r=groundItemRegions[i];
        if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h) return {type:'ground',index:i,item:r.item,region:r};
    }
    return null;
}
function updateEqDetailButtons(sourceType){
    var pb=document.getElementById('eq-detail-pickup-btn'), db=document.getElementById('eq-detail-drop-btn');
    if(!pb||!db) return;
    if(sourceType==='ground'){pb.style.display='';db.style.display='none';}
    else{pb.style.display='none';db.style.display='';}
}
// 详情面板"拾取"按钮
function pickupGroundItem(){
    if(viewingGroundIdx<0||viewingGroundIdx>=groundItems.length) return;
    var gi=groundItems[viewingGroundIdx]; if(!gi) return;
    var _totalSlots=5;
    var _hasSword=(gameState.cultivation&&gameState.cultivation.swordBroken)?1:0;
    var _emptySlots=_totalSlots-_hasSword-(equipSlots?equipSlots.length:0);
    if(_emptySlots>0){
        equipSlots.push(__deepCopy(gi.item));
        screenText('📥 '+gi.item.icon+' '+gi.item.name,'#ffd700',1200);
        if(gi.item.apply&&gameState.player) gi.item.apply(gameState.player);
        groundItems.splice(viewingGroundIdx,1); viewingGroundIdx=-1; hideEqDetail();
    } else screenText('❌ 道具栏已满','#ef4444',1000);
}
// 详情面板"丢弃"按钮
function dropEqItem(){
    var item=showEqDetail; if(!item) return;
    var idx=-1;
    if(item._slotIdx!==undefined&&item._slotIdx>0){
        idx=item._slotIdx-1;
        if(idx>=0&&idx<equipSlots.length&&equipSlots[idx]&&equipSlots[idx].key===item.key){
            equipSlots.splice(idx,1);
            var pos=gameState.player?{x:gameState.player.x,y:gameState.player.y}:{x:180,y:460};
            groundItems.push({x:pos.x,y:pos.y,item:__deepCopy(item),lifeTimer:30000});
            screenText('🗑️ '+item.icon+' '+item.name,'#ef4444',1000);
        }
    } else if(item._slotIdx===0) screenText('⚠️ 残剑无法丢弃','#ffa500',1000);
    hideEqDetail();
}
// 主交互入口
function initPointerInteraction(){
    canvas.style.touchAction='none';
    canvas.addEventListener('pointerdown',function(e){
        var pos=getCanvasPos(e);
        var hit=hitTestAll(pos.x,pos.y);
        if(hit){
            try{canvas.setPointerCapture(e.pointerId);}catch(_){}
            pointerStart={x:pos.x,y:pos.y,pointerId:e.pointerId,time:Date.now()};
            pointerHitType=hit.type; pointerHitData=hit;
        } else { pointerStart=null; pointerHitType=null; pointerHitData=null; }
    });
    function endPointer(e){
        if(!pointerStart||e.pointerId!==pointerStart.pointerId) return;
        var pos=getCanvasPos(e);
        var dx=pos.x-pointerStart.x, dy=pos.y-pointerStart.y;
        var dist=Math.sqrt(dx*dx+dy*dy);
        if(dist<DRAG_THRESHOLD&&pointerHitData){
            if(pointerHitType==='ground'){viewingGroundIdx=pointerHitData.index;updateEqDetailButtons('ground');}
            else{viewingGroundIdx=-1;updateEqDetailButtons('eqSlot');}
            showEqDetail=__deepCopy(pointerHitData.item);
            showEqDetail._slotIdx=pointerHitData.region.slotIdx;
            showEqDetailOverlay(showEqDetail);
        }
        pointerStart=null; pointerHitType=null; pointerHitData=null;
        try{canvas.releasePointerCapture(e.pointerId);}catch(_){}
    }
    canvas.addEventListener('pointerup',endPointer);
    canvas.addEventListener('pointercancel',endPointer);
}
// DOM加载后初始化
if(typeof document!=='undefined'){
    if(document.readyState==='complete') initPointerInteraction();
    else document.addEventListener('DOMContentLoaded',initPointerInteraction);
}

function triggerVictory(){
    gameState.isGameOver = true;
    gameState.gameCompleted = true;
    gameState.totalPlayTime = Math.floor((Date.now()-gameState.gameStartTime)/1000);
    SFX && SFX.gameover && SFX.gameover();
    updateGameOverPanel(true);
    try{ SFX.win && SFX.win(); }catch(e){}
}

// ==================== 卡牌商店UI ====================
function showCardShopUI(){
    if(!gameState.shopCards || gameState.shopCards.length === 0) return;
    let overlay=document.getElementById('card-overlay');
    if(!overlay) return;
    let container=overlay.querySelector('.card-container');
    container.innerHTML='';
    document.getElementById('card-title').textContent = '🎴 卡牌商店';
    let cost = getCardConfig('refreshCost', SHOP_REFRESH_COST);
    document.getElementById('card-subtitle').textContent = '4选1 · 点击卡牌放入技能栏（💰'+cost+'金/次）';

    // 卡池锁定提示：没拿到疾行+闪现时只出移动/闪避卡
    var lockHint = document.getElementById('card-lock-hint');
    if(!gameState.hasMove || !gameState.hasDash){
        lockHint.style.display = 'block';
        lockHint.textContent = '🔒 拿到「疾行」+「闪现」后解锁攻击卡牌 & 羁绊系统';
    } else {
        lockHint.style.display = 'none';
    }

    gameState.shopCards.forEach((card,i)=>{
        let cfg=CARD_TYPES[card.type];
        let color=cfg?cfg.color:'#00d4ff';
        let el=document.createElement('div');
        el.className='card-item';
        // 修仙卡特殊样式
        if(card._cult){
            if(card.type==='cult_sword_gold' || card.rarity==='gold'){
                color = '#ffd700';
                el.style.setProperty('--card-color','#ffd700');
                el.style.borderColor = '#ffd700';
                el.style.boxShadow = '0 0 12px rgba(255,215,0,0.4)';
            } else if(card.type==='cult_sword_blue' || card.rarity==='blue'){
                color = '#00d4ff';
                el.style.setProperty('--card-color','#00d4ff');
                el.style.borderColor = '#00d4ff';
            } else if(card.type==='cult_starter' || card.type==='cult_sub_starter'){
                color = '#a855f7';
                el.style.setProperty('--card-color','#a855f7');
                el.style.borderColor = '#a855f7';
                el.style.boxShadow = '0 0 12px rgba(168,85,247,0.3)';
            }
            el.innerHTML='<div class="card-icon">'+card.icon+'</div><div class="card-name">'+card.name+'</div><div class="card-desc">'+(card.desc||'')+'</div><div class="card-extra">'+(card.cultivationValue?'修为+'+(card.cultivationValue||0):'')+'</div>';
        } else {
            el.style.setProperty('--card-color',color);
            el.innerHTML='<div class="card-icon">'+card.icon+'</div><div class="card-name">'+card.name+'</div><div class="card-desc">'+(cfg?cfg.desc:'')+'</div>';
        }
        el.addEventListener('click',()=>{ buyCard(i); });
        container.appendChild(el);
    });
    // 刷新按钮
    let abtn = document.getElementById('abandon-btn');
    abtn.style.display = gameState.shopCards && gameState.shopCards.length > 0 ? 'inline-block' : 'none';
    abtn.onclick = function(){
        let cost = getCardConfig('refreshCost', SHOP_REFRESH_COST);
        if(gameState.gold >= cost){
            refreshCardShop();
            showCardShopUI();
        } else {
            screenText('💰 金币不足!', '#ff4757', 800);
        }
    };
    document.getElementById('close-shop-btn').onclick = ()=>hideCardShopUI();
    overlay.classList.add('active');
}
function hideCardShopUI(){
    document.getElementById('card-overlay')?.classList.remove('active');
    closeShop();
}

function updateWaveSystem(now){
    if(gameState.isGameOver) return;

    if(gameState.isBetweenWaves){
        if(gameState._waveEndTime && now-gameState._waveEndTime > 3000){
            gameState.isBetweenWaves=false;
            gameState.wave++;
            if(gameState.wave>gameState.maxWave) gameState.maxWave=gameState.wave;
            gameState.waveMonstersSpawned=0;
            gameState.waveMonstersTarget=getWaveMonsterCount();
            gameState.waveTimer=0;
            gameState.lastSpawnTime=now;
            gameState._waveEndTime=null;
            // 重新生成此波次的怪物队列
            let cfg = gameState.config || DEFAULT_GAME_CONFIG;
            gameState._waveSpawnTypes = [];
            let wc = getWaveConfig().monsters || {};
            let mt = cfg.monsters.types || {};
            for(let [type,count] of Object.entries(wc)){
                let tdef = mt[type] || { hp:50, speed:2, damage:8, size:25, color:'#ff6348', score:100 };
                for(let i=0;i<count;i++) gameState._waveSpawnTypes.push({ type, def:tdef });
            }
            for(let i=gameState._waveSpawnTypes.length-1;i>0;i--){
                let j=Math.floor(Math.random()*(i+1));
                [gameState._waveSpawnTypes[i],gameState._waveSpawnTypes[j]] = [gameState._waveSpawnTypes[j],gameState._waveSpawnTypes[i]];
            }
            initAudio(); SFX.wave();
            screenText('⚔ 第 '+gameState.wave+' 波 ⚔', '#ffdd59', 1500);
        }
        return;
    }

    if(gameState.waveMonstersSpawned<gameState.waveMonstersTarget){
        let interval=getWaveSpawnInterval();
        if(now-gameState.lastSpawnTime>interval){
            let cfg = gameState.config || DEFAULT_GAME_CONFIG;
            let batch = cfg.monsters.spawnCount || 1;
            for(let b=0; b<batch && gameState.waveMonstersSpawned<gameState.waveMonstersTarget; b++){
                spawnWaveMonster();
                gameState.waveMonstersSpawned++;
            }
            gameState.lastSpawnTime=now;
        }
    }

    // ===== 阶段过渡：normal → elite → boss =====
    var aliveCount = gameState.monsters.filter(m=>m&&m.hp>0).length;
    if(gameState.phase === 'normal' && gameState.waveMonstersSpawned >= gameState.waveMonstersTarget && aliveCount === 0){
        // 所有普通怪物已生成且全部死亡 → 进入精英阶段
        gameState.phase = 'elite';
        gameState.eliteSpawned = false;
        gameState.eliteCount = 0;
        spawnEliteMonsters();
        screenText('⚡ 精英来袭!', '#ff9f43', 2000);
    } else if(gameState.phase === 'elite' && aliveCount === 0){
        // 所有精英死亡 → 进入Boss阶段
        gameState.phase = 'boss';
        gameState.bossActive = true;
        gameState.bossTimer = BOSS_TIME_LIMIT;
        spawnBoss();
        screenText('👑 BOSS!', '#dc2626', 2000);
    }

    gameState.waveTimer+=16;
    if(gameState.waveTimer>=gameState.waveTotalTime*1000 && gameState.phase!=='boss'){
        endWave();
    }
}

function spawnWaveMonster(){
    let types = gameState._waveSpawnTypes;
    if(!types || types.length === 0) return;
    let pick = types.pop();
    if(!pick) return;
    let tdef = pick.def;
    
    // 出怪口：顶部中央传送门
    let sx=MAP_W/2+(Math.random()-0.5)*60, sy=75;

    let monster=new Monster(sx,sy,{
        hp:tdef.hp||50, speed:CONFIG.PLAYER_SPEED*(tdef.speedRatio||0.5), damage:tdef.damage||8,
        size:tdef.size||25, color:tdef.color||'#ff6348',
    });
    monster.contactDmg = tdef.damage||8;
    monster._goldReward = (tdef.score||100) + Math.floor(Math.random()*6) + Math.floor(gameState.wave*2);
    monster.target=gameState.player;
    // 传送门出怪粒子特效
    for(let i=0;i<12;i++){
        gameState.particles.push(new Particle(sx,sy,'#a855f7',400,4,5));
        gameState.particles.push(new Particle(sx,sy,'#00d4ff',300,3,3));
    }
    gameState.monsters.push(monster);
}

// ==================== 弹道系统 ====================
const FRUITS = ['🍎','🍊','🍋','🍇','🍑','🍓','🍉','🥝'];
class Projectile {
    constructor(fromX, fromY, targetMonster, config={}){
        this.x = fromX; this.y = fromY;
        this.target = targetMonster;
        this.speed = config.speed || 800;
        this.size = config.size || 6;
        this.color = config.color || '#ffdd59';
        this.damage = config.damage || 15;
        this.iceEffect = config.iceEffect || 0;
        this.alive = true;
        this.hitEffect = config.hitEffect !== false;
        this._prevX = fromX; this._prevY = fromY;
        this.fruit = FRUITS[Math.floor(Math.random()*FRUITS.length)];
    }
    update(dt){
        if(!this.alive || !this.target) return;
        // 时间静止 — 不移动子弹
        if(gameState._timeFreeze&&gameState._timeFreeze.active){
            // 只更新拖尾位置（保持尾迹连接）
            this._prevX=this.x; this._prevY=this.y;
            return;
        }
        let dx = this.target.x - this.x;
        let dy = this.target.y - this.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if(this.target.hp<=0||!this.target.alive){this.alive=false;return;}
        if(dist<8){
            // 命中
            this.target.hp -= this.damage;
            // 浮动文字
            gameState.floatingTexts.push(new FloatingText(this.target.x,this.target.y-10,'-'+Math.floor(this.damage),'#ff4757',600));
            // 击退：把怪物向后推
            var kbDir=Math.atan2(this.target.y-gameState.player.y,this.target.x-gameState.player.x);
            this.target._kbX=Math.cos(kbDir)*0.8; this.target._kbY=Math.sin(kbDir)*0.8;
            // 受击闪白
            this.target._hitFlashTimer=150;
            if(this.hitEffect){
                for(let i=0;i<8;i++) gameState.particles.push(
                    new Particle(this.target.x,this.target.y,this.color,300,3,5));
            }
            // 冰霜减速
            if(this.iceEffect > 0 && this.target.hp > 0){
                this.target._slowTimer = (this.target._slowTimer||0) + this.iceEffect;
            }
            // 击杀死掉的怪物
            if(this.target.hp <= 0){
                killMonster(this.target);
            } else {
                SFX.hit();
            }
            this.alive = false;
            return;
        }
        let moveDist = this.speed * (dt/1000);
        // 弹道拖尾粒子（拉长效果）
        var tdx=(dx/dist)*moveDist, tdy=(dy/dist)*moveDist;
        for(var i=0;i<3;i++) gameState.particles.push(new Particle(this.x-tdx*i*0.5,this.y-tdy*i*0.5,this.color,80,this.size*0.5,1.2));
        this._prevX=this.x; this._prevY=this.y;
        this.x += tdx;
        this.y += tdy;
    }
    draw(ctx){
        if(!this.alive) return;
        let pos = worldToScreen(this.x, this.y);
        let r=this.size;
        ctx.save();
        // 弹道拖尾光带
        if(this._prevX!==undefined){
            var pp=worldToScreen(this._prevX,this._prevY);
            ctx.globalAlpha=0.25;
            ctx.strokeStyle=this.color;
            ctx.lineWidth=r*2.5;
            ctx.lineCap='round';
            ctx.beginPath(); ctx.moveTo(pp.x,pp.y); ctx.lineTo(pos.x,pos.y);
            ctx.stroke();
            ctx.globalAlpha=1;
        }
        // 水果粒子
        ctx.font='bold '+(r*5)+'px Arial, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji"';
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        let fruitAngle=this._prevX!==undefined?Math.atan2(pos.y-worldToScreen(this._prevX,this._prevY).y,pos.x-worldToScreen(this._prevX,this._prevY).x):0;
        ctx.translate(pos.x,pos.y);
        ctx.rotate(fruitAngle);
        ctx.fillText(this.fruit,0,0);
        ctx.restore();
    }
}

// ==================== 怪物类 ====================
let monsterIdCounter=0;
class Monster {
    constructor(x,y,config={}){
        this.id=++monsterIdCounter;
        this.x=x; this.y=y;
        this.hp=config.hp||50; this.maxHp=this.hp;
        this.alive=true;
        this.speed=config.speed||2;
        this.size=config.size||25;
        this.color=config.color||'#ff6348';
        this.path=[]; this.pathIndex=0; this.target=null;
        this.repathTimer=0;
        this._kbX=0; this._kbY=0; this._hitFlashTimer=0;
    }
    update(now){
        // 受击闪白递减
        if(this._hitFlashTimer>0) this._hitFlashTimer-=16;
        // 击退效果
        if(this._kbX||this._kbY){
            var kspd=4;
            this.x+=this._kbX*kspd; this.y+=this._kbY*kspd;
            this._kbX*=0.7; this._kbY*=0.7;
            if(Math.abs(this._kbX)<0.1&&Math.abs(this._kbY)<0.1){this._kbX=0;this._kbY=0;}
        }
        if(!this.target) return;
        // 每2秒重新寻路
        if(!this.path.length||this.pathIndex>=this.path.length||now-this.repathTimer>2000){
            this.findPathToTarget(); this.repathTimer=now; return;
        }
        let tn=this.path[this.pathIndex];
        // 冰霜减速
        let spdMul=1;
        if(this._slowTimer&&this._slowTimer>0){
            spdMul=0.4; this._slowTimer-=16;
        }
        let mv=calculateVector(this.x,this.y,tn.x,tn.y,this.speed*spdMul);
        if(mv.arrived){ this.pathIndex++; return; }
        let nx=this.x+mv.x, ny=this.y+mv.y;
        if(canMoveTo(nx,ny)){ this.x=nx; this.y=ny; }
        else{ if(canMoveTo(nx,this.y))this.x=nx; if(canMoveTo(this.x,ny))this.y=ny; }
    }
    findPathToTarget(){
        if(!this.target) return;
        let sg=worldToGrid(this.x,this.y), eg=worldToGrid(this.target.x,this.target.y);
        let gp=findPath(sg.x,sg.y,eg.x,eg.y);
        if(gp.length>1){ this.path=gp.slice(1).map(n=>gridToWorld(n.x,n.y)); this.pathIndex=0; }
    }
    draw(ctx){
        let pos=worldToScreen(this.x-this.size/2,this.y-this.size/2);
        let s=this.size;
        // 主体
        ctx.fillStyle=this.color;
        ctx.beginPath();
        ctx.arc(pos.x+s/2,pos.y+s/2,s/2,0,Math.PI*2);
        ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=1.5; ctx.stroke();
        // 受击闪白
        if(this._hitFlashTimer>0){
            ctx.fillStyle='rgba(255,255,255,'+Math.min(0.7,this._hitFlashTimer/120)+')';
            ctx.beginPath(); ctx.arc(pos.x+s/2,pos.y+s/2,s/2,0,Math.PI*2); ctx.fill();
        }
        // 眼睛
        ctx.fillStyle='#fff';
        ctx.beginPath(); ctx.arc(pos.x+s*0.35,pos.y+s*0.4,s*0.18,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(pos.x+s*0.65,pos.y+s*0.4,s*0.18,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#000';
        ctx.beginPath(); ctx.arc(pos.x+s*0.35,pos.y+s*0.38,s*0.08,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(pos.x+s*0.65,pos.y+s*0.38,s*0.08,0,Math.PI*2); ctx.fill();
        // 血条
        let bw=s, bh=3;
        ctx.fillStyle='rgba(0,0,0,0.6)';
        ctx.fillRect(pos.x,pos.y-6,bw,bh);
        ctx.fillStyle='#ff4757';
        ctx.fillRect(pos.x,pos.y-6,bw*(this.hp/this.maxHp),bh);
        // 精英/首领名字标签
        if(this._elite){
            // 精英光圈+边框
            ctx.shadowColor='#ffd700'; ctx.shadowBlur=12;
            ctx.fillStyle='rgba(255,215,0,0.12)';
            ctx.beginPath(); ctx.arc(pos.x+s/2,pos.y+s/2,s/2+5,0,Math.PI*2); ctx.fill();
            ctx.shadowBlur=0;
            ctx.strokeStyle='rgba(255,215,0,0.4)'; ctx.lineWidth=2;
            ctx.beginPath(); ctx.arc(pos.x+s/2,pos.y+s/2,s/2,0,Math.PI*2); ctx.stroke();
            // 精英标记
            ctx.fillStyle='rgba(255,215,0,0.9)'; ctx.font='bold 9px Arial'; ctx.textAlign='center';
            ctx.fillText('⚡ 精英', pos.x+s/2, pos.y-10);
        }
        if(this._isBoss){
            // Boss大光晕
            ctx.shadowColor=this.color; ctx.shadowBlur=30;
            ctx.fillStyle=this.color; ctx.globalAlpha=0.2;
            ctx.beginPath(); ctx.arc(pos.x+s/2,pos.y+s/2,s/2+14,0,Math.PI*2); ctx.fill();
            ctx.globalAlpha=1; ctx.shadowBlur=0;
            // Boss金色边框
            ctx.strokeStyle='rgba(255,215,0,0.5)'; ctx.lineWidth=3;
            ctx.beginPath(); ctx.arc(pos.x+s/2,pos.y+s/2,s/2,0,Math.PI*2); ctx.stroke();
            // Boss王冠标记
            ctx.font='22px Arial'; ctx.textAlign='center';
            ctx.fillText('👑', pos.x+s/2, pos.y-18);
        }
    }
}

// ==================== 游戏结束 ====================
function updateGameOverPanel(isWin){
    let panel = document.getElementById('gameover-panel');
    if(!panel) return;

    // 角色信息
    var hn = currentHero && HERO_CLASSES[currentHero] ? HERO_CLASSES[currentHero] : {icon:'🧘',name:'未知'};
    document.getElementById('go-avatar').textContent = hn.icon || '🧘';
    document.getElementById('go-hero-name').textContent = hn.name || '未知';

    // 胜负徽章
    var badge = document.getElementById('go-badge');
    if(isWin){
        badge.textContent = '🏆 通关';
        badge.style.background = 'rgba(255,215,0,0.15)';
        badge.style.color = '#ffd700';
        badge.style.borderColor = 'rgba(255,215,0,0.25)';
    } else {
        badge.textContent = '💀 阵亡';
        badge.style.background = 'rgba(255,71,87,0.15)';
        badge.style.color = '#ff4757';
        badge.style.borderColor = 'rgba(255,71,87,0.25)';
    }

    // 分数
    document.getElementById('go-score').textContent = gameState.score;

    // 评分等级（基于分数）
    var score = gameState.score;
    var grade, gradeColor;
    if(score >= 200000){ grade='S'; gradeColor='#ffd700'; }
    else if(score >= 120000){ grade='A'; gradeColor='#ff6b4a'; }
    else if(score >= 60000){ grade='B'; gradeColor='#00d4ff'; }
    else { grade='C'; gradeColor='#888'; }
    var gradeEl = document.getElementById('go-grade');
    gradeEl.textContent = grade;
    gradeEl.style.color = gradeColor;
    gradeEl.style.borderColor = gradeColor;
    gradeEl.style.background = 'rgba(255,255,255,0.06)';

    // 统计
    document.getElementById('go-kills').textContent = gameState.kills;
    document.getElementById('go-wave').textContent = (isWin ? gameState.wave : gameState.wave-1)+'波';
    document.getElementById('go-time').textContent = formatTime(gameState.totalPlayTime);
    document.getElementById('go-diff').textContent = runtimeMultipliers ? runtimeMultipliers.name : '难1';

    // 底部详情文字
    var detailText = hn.icon+' '+hn.name+' · '+(isWin ? gameState.wave+'波通关' : '第'+(gameState.wave-1)+'波阵亡');
    document.getElementById('go-detail-text').textContent = detailText;

    panel.classList.add('active');
}

function shareResult(channel){
    var hn = currentHero && HERO_CLASSES[currentHero] ? HERO_CLASSES[currentHero] : {icon:'🧘',name:'未知'};
    var text = '⚔️ 不完美作战 v4.3.1\n' +
        hn.icon+' '+hn.name+' · 得分 '+gameState.score+' · 评级 '+document.getElementById('go-grade').textContent+'\n' +
        '💀'+gameState.kills+'杀 🌊'+gameState.wave+'波 ⏱️'+formatTime(gameState.totalPlayTime)+'\n' +
        '🎮 来挑战：https://cpboomo.github.io/imperfect-combat-opensource/';
    if(channel === 'copy'){
        navigator.clipboard.writeText(text).then(function(){
            screenText('✅ 战绩已复制!', '#2ed573', 1500);
        }).catch(function(){
            screenText('⚠️ 复制失败,请重试', '#ff4757', 1500);
        });
    } else if(channel === 'wechat'){
        // 微信端尝试唤起分享
        if(typeof wx !== 'undefined' && wx){
            try{ wx.showShareMenu({menus:['shareAppMessage','shareTimeline']}); }catch(e){}
        }
        navigator.clipboard.writeText(text).then(function(){
            screenText('✅ 战绩已复制,去微信粘贴吧!', '#2ed573', 2000);
        }).catch(function(){
            screenText('⚠️ 请截屏分享', '#ff4757', 1500);
        });
    }
}

function triggerGameOver(){
    gameState.isGameOver=true;
    gameState.totalPlayTime=Math.floor((Date.now()-gameState.gameStartTime)/1000);
    SFX.gameover();
    updateGameOverPanel(false);
}
function formatTime(s){
    let m=Math.floor(s/60), sec=s%60;
    return m+':'+String(sec).padStart(2,'0');
}
function restartGame(){
    let panel=document.getElementById('gameover-panel');
    if(panel) panel.classList.remove('active');
    // 重置
    gameState.player.hp=gameState.player.maxHp;
    gameState.player.mp=CONFIG.MAX_MP;
    gameState.player.x=Math.abs(gameState._initX||180);
    gameState.player.y=Math.abs(gameState._initY||460);
    gameState.monsters=[];
    gameState.particles=[];
    gameState.floatingTexts=[];
    gameState.currentPath=[]; gameState.currentPathIndex=0;
    if(gameState.player){ gameState.player._vx=0; gameState.player._vy=0; }
    gameState.wave=0; gameState.waveMonstersSpawned=0;
    gameState.score=0; gameState.kills=0; gameState.maxWave=1;
    gameState.isBetweenWaves=true; gameState.betweenWaveTimer=Date.now();
    gameState.isGameOver=false; gameState.isPaused=false;
    gameState.lastSpawnTime=Date.now();
    gameState.attackCooldown=0;
    gameState.lastMonsterContact={};
    gameState.gameStartTime=Date.now();
    gameState.gameCompleted=false;
    gameState._victoryTimer=0;
    // 重置全局变量
    equipSlots=[]; groundItems=[];
    gameState.gold=(gameState.config&&gameState.config.hero&&gameState.config.hero.initialGold)||400;
    gameState.availableCards=CARD_POOL.map(c=>({...c}));
    gameState.skillBar=[];
    gameState.shopCards=[];
    gameState.synergyLog=[];
    gameState.synergyActivated={};
    gameState.hasMove=false;
    gameState.hasDash=false;
    gameState.towerFloor=1;
    gameState.towerClaimed={};
    gameState._towerAuto=false;
    gameState._towerTimer=0;
    gameState._towerCD=0;
    gameState._towerSpawned=false;
    gameState._towerSpawnFloor=0;
    gameState.showingShop=false;
    gameState.aiEnabled=false;
    gameState.aiMode='balanced';
    gameState.aiCooldown=0;
    gameState._nextAIopTime=0;
    gameState._aiStuckFrames=0;
    // 重置宝箱
    chestCount=0;
    chestSaveCount();
    // 重置英雄额外属性
    let _p=gameState.player;
    if(_p){
        _p.extraAtk=0; _p.extraAtkSpd=0; _p.extraRange=0; _p.iceCount=0; _p.vamp=0;
        _p.extraSpd=0; _p.extraAtk=0; _p.extraAtkSpd=0; _p.extraRange=0; _p.iceCount=0; _p.vamp=0; _p.shield=0; _p.critChance=0;
        _p._studyBoost=0; _p._swordChance=0; _p._swordDmg=0;
    }
    // 重置修仙状态
    if(gameState.cultivation){
        gameState.cultivation.branch=null;
        gameState.cultivation.stage=0;
        gameState.cultivation.studyPoints=0;
        gameState.cultivation.upgradePoints=0;
        gameState.cultivation.cultivationValue=0;
        gameState.cultivation.swordCount=0;
        gameState.cultivation.hasUltimate=false;
        gameState.cultivation.swordBroken=false;
        gameState.cultivation.swordLevel=1;
        gameState.cultivation.swordDmgBonus=0;
        gameState.cultivation.subStarterActive=false;
        gameState.cultivation.subStarterTimer=0;
        gameState.cultivation.showHiddenSword=false;
        gameState.cultivation.hiddenSwordOpen=false;
        gameState.cultivation.lastStudyRoll=0;
        delete gameState.cultivation._collectedBlue;
        delete gameState.cultivation._collectedGold;
        delete gameState.cultivation._floatSword;
        delete gameState.cultivation._hsBtnA;
        delete gameState.cultivation._hsBtnB;
        delete gameState.cultivation._hsBtnClose;
    }
    inputState.dashEffects=[];
    startWave();
}

// ==================== 点击处理 ====================
function handleCanvasClick(event){
    if(gameState.isGameOver) return;
    if(inputState.isProcessingClick) return;
    inputState.isProcessingClick=true; setTimeout(()=>{inputState.isProcessingClick=false;},40);

    if(!gameState.player) return;
    initAudio();

    let rect=getCanvasRect();
    let sx=(event.clientX-rect.left)*(canvas.width/rect.width);
    let sy=(event.clientY-rect.top)*(canvas.height/rect.height);
    let now=Date.now();

    // 爬塔按钮 + 自动开关
    let tb2=drawTowerButton();
    if(tb2&&tb2.auto&&sx>=tb2.auto.x&&sx<=tb2.auto.x+tb2.auto.w&&sy>=tb2.auto.y&&sy<=tb2.auto.y+20+28){gameState._towerAuto=!(gameState._towerAuto||false);return;}
    // AI Bot 按钮检测
    var aiX=canvas.width-56,aiY=225,aiW=34;
    if(sx>=aiX&&sx<=aiX+aiW&&sy>=aiY&&sy<=aiY+aiW){
        gameState.aiEnabled=!(gameState.aiEnabled||false);
        if(!gameState.aiEnabled){gameState.currentPath=[];gameState.player.isMoving=false;gameState.player._vx=0;gameState.player._vy=0;}
        return;
    }
    // AI 模式切换
    if(sx>=aiX&&sx<=aiX+aiW&&sy>=aiY+aiW+12&&sy<=aiY+aiW+30){
        var modes=['balanced','kite','evade'];
        var idx=modes.indexOf(gameState.aiMode);
        gameState.aiMode=modes[(idx+1)%modes.length];
        return;
    }

    if(tb2&&tb2.btn&&sx>=tb2.btn.x&&sx<=tb2.btn.x+tb2.btn.w&&sy>=tb2.btn.y&&sy<=tb2.btn.y+tb2.btn.h){
        if(tb2.btn.disabled){screenText('⚠️ 先消灭当前塔层怪物!', '#ff4757', 1200, -20);return;}
        if(spawnTowerMonsters()){screenText('👾 塔层怪物来袭!', '#ffdd59', 1200, -20);}
        // 手动出怪时关闭自动，重置计时
        gameState._towerAuto=false;
        gameState._towerTimer=0;
    return;}
    // 宝箱按钮检测
    if(checkChestClick(sx,sy)) return;
    // 藏剑按钮检测
    handleHiddenSwordClick(sx,sy);
    // 时间静止按钮检测
    if(checkTimeFreezeClick(sx,sy)) return;
    // 羁绊按钮检测（右上角）
    let _bbX=canvas.width-56, _bbY=88;
    if(sx>_bbX&&sx<_bbX+48&&sy>_bbY&&sy<_bbY+18){showBondPanel();return;}
    // 检测底部"抽卡"按钮点击
    let by = canvas.height - 50;
    let bx = canvas.width/2, bw = 70, bh = 26;
    if(sy > by-4 && sy < by-4+bh && sx > bx-bw/2 && sx < bx+bw/2){
        let cardCost = getCardConfig('refreshCost', SHOP_REFRESH_COST);
        if(gameState.gold >= cardCost){
            refreshCardShop();
            showCardShopUI();
        } else {
            screenText('💰 金币不足!', '#ff4757', 800);
        }
        return;
    }

    let wp=screenToWorld(sx,sy);
    let td=now-inputState.lastClickTime;
    let dd=Math.sqrt((sx-inputState.lastClickX)**2+(sy-inputState.lastClickY)**2);
    let isDouble=td<CONFIG.DOUBLE_CLICK_TIME&&dd<CONFIG.DOUBLE_CLICK_DISTANCE;

    if(!gameState.hasMove){
        gameState.floatingTexts.push(new FloatingText(wp.x,wp.y-20,'⚠️ 先抽「疾行」羁绊卡解锁移动','#ff4757',1200));
    } else if(isDouble&&canDash()){
        let p=gameState.player;
        let dx=wp.x-p.x, dy=wp.y-p.y, dist=Math.sqrt(dx*dx+dy*dy);
        if(dist>0){
            let dd2=Math.min(dist,CONFIG.DASH_DISTANCE);
            let dtx=p.x+(dx/dist)*dd2, dty=p.y+(dy/dist)*dd2;
            let vp=findNearestValidPosition(dtx,dty,CONFIG.DASH_DISTANCE);
            if(performDash(p.x,p.y,vp.x,vp.y)){
                p.x=vp.x; p.y=vp.y; gameState.currentPath=[]; p._vx=0; p._vy=0;
                // 闪现时对路径上的怪物造成伤害
                for(let m of gameState.monsters){
                    if(distance({x:vp.x,y:vp.y},m)<CONFIG.PLAYER_SIZE+m.size){
                        m.hp-=30; gameState.floatingTexts.push(new FloatingText(m.x,m.y-10,'-30','#ff69b4',500));
                        if(m.hp<=0) killMonster(m);
                    }
                }
            }
        }
    } else {
        moveToPosition(wp.x,wp.y);
    }
    inputState.lastClickTime=now; inputState.lastClickX=sx; inputState.lastClickY=sy;
}

function moveToPosition(wx,wy){
    if(!gameState.player) return;
    let sg=worldToGrid(gameState.player.x,gameState.player.y);
    let eg=worldToGrid(wx,wy);
    let path=findPath(sg.x,sg.y,eg.x,eg.y);
    if(path.length>1){ gameState.currentPath=path.slice(1).map(n=>gridToWorld(n.x,n.y)); gameState.currentPathIndex=0; gameState.player.isMoving=true; }
    else if(path.length===1){ gameState.currentPath=[gridToWorld(path[0].x,path[0].y)]; gameState.currentPathIndex=0; gameState.player.isMoving=true; }
    else { gameState.currentPath=[]; gameState.currentPathIndex=0; }
}

// ==================== 相机 ====================
// ==================== 修仙系统更新 ====================
function updateCultivation(dt){
    var cult = gameState.cultivation;
    if(!cult || !gameState.player) return;

    // L2 剑仙子引子倒计时
    if(cult.subStarterActive && cult.subStarterTimer > 0){
        cult.subStarterTimer -= dt;
        // 同步更新技能栏中的卡 timer
        var sb = gameState.skillBar || [];
        for(var i=0; i<sb.length; i++){
            if(sb[i] && sb[i]._cultActive && sb[i]._cultTimer !== undefined){
                sb[i]._cultTimer = cult.subStarterTimer;
                break;
            }
        }
        // 倒计时结束
        if(cult.subStarterTimer <= 0){
            cult.subStarterTimer = 0;
            cult.subStarterActive = false;
            cult.stage = 2; // 解锁剑系
            cult.showHiddenSword = true; // 显示藏剑图标
            cult.swordBroken = true; // 获得残剑

            // 从技能栏移除剑仙子引子
            for(var si=sb.length-1; si>=0; si--){
                if(sb[si] && sb[si]._cultActive){
                    screenText('⚔️ 剑仙子引子觉醒 ! 残剑已收入道具栏', '#ffd700', 2000);
                    // 粒子特效
                    for(var pj=0; pj<20; pj++){
                        gameState.particles.push(new Particle(gameState.camera.x+canvas.width/2, gameState.camera.y+canvas.height/2, '#ffd700', 800, 4, 6));
                    }
                    sb.splice(si, 1);
                    break;
                }
            }

            // 记录已收集的卡
            if(!cult._collectedBlue) cult._collectedBlue = [];
            if(!cult._collectedGold) cult._collectedGold = [];
        }
    }

    // 打怪获得学习次数（stage>=2 且剑仙子引子回收后）
    if(cult.stage >= 2){
        // 每帧roll一次，由killMonster触发而非帧循环
    }
}

// 怪物死亡时roll学习次数
function rollStudyPoint(){
    var cult = gameState.cultivation;
    if(!cult || cult.stage < 2) return;
    var p = gameState.player;
    if(!p) return;
    var boost = p._studyBoost || 0;
    var chance = 0.08 + boost; // 基础8% + 蓝卡加成
    if(Math.random() < chance){
        cult.studyPoints = (cult.studyPoints||0) + 1;
        screenText('📖 获得学习次数 +1', '#2ed573', 800, -30);
    }
}

function updateCamera(){
    if(!gameState.player) return;
    var p=gameState.player;
    var tx=p.x-canvas.width/2, ty=p.y-canvas.height/2;
    var mx=Math.max(0,MAP_W-canvas.width), my=Math.max(0,MAP_H-canvas.height);
    var targetX=Math.max(0,Math.min(tx,mx)), targetY=Math.max(0,Math.min(ty,my));
    if(MAP_W<=canvas.width){targetX=-(canvas.width-MAP_W)/2;}
    if(MAP_H<=canvas.height){targetY=-(canvas.height-MAP_H)/2;}
    // 平滑跟随
    gameState.camera.x+=(targetX-gameState.camera.x)*0.12;
    gameState.camera.y+=(targetY-gameState.camera.y)*0.12;
}

// HUD更新（即时反映金币变化等）
function updateHUD(){}

