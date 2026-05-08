/**
 * game-render.js — 渲染层
 * @module game-render
 * @description All Canvas draw functions: grid, walls, monsters, player, UI bars, particles,
 *   cultivation HUD, AI bot visualization. Pure rendering — no game state mutation.
 *   Depends on: game-data.js, game-logic.js
 */

// game-render.js — All draw functions + cultivation UI + AI bot

// ==================== 渲染系统 ====================
// 传送门动画计时
let _portalAnimTime = 0;

function drawPortal(){
    let pp=worldToScreen(MAP_W/2, 75);
    let px=pp.x, py=pp.y;
    _portalAnimTime = (_portalAnimTime + 0.03) % (Math.PI*2);
    
    // 外圈光环
    for(let r=3;r>=1;r--){
        let alpha=0.15+(Math.sin(_portalAnimTime+r)*0.08);
        ctx.save();
        ctx.globalAlpha=alpha;
        ctx.shadowColor='#a855f7';
        ctx.shadowBlur=20*r;
        ctx.strokeStyle='#a855f7';
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.arc(px,py,22+r*5+Math.sin(_portalAnimTime+r)*3,0,Math.PI*2);
        ctx.stroke();
        ctx.restore();
    }
    
    // 内圈旋转光
    ctx.save();
    ctx.globalAlpha=0.3+Math.sin(_portalAnimTime)*0.1;
    ctx.strokeStyle='#00d4ff';
    ctx.lineWidth=2;
    let rot=_portalAnimTime;
    ctx.beginPath();
    ctx.arc(px,py,18,rot,rot+Math.PI*1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px,py,14,rot+Math.PI,rot+Math.PI*2.5);
    ctx.stroke();
    ctx.restore();
    
    // 中心光晕
    let pulse=0.4+Math.sin(_portalAnimTime*2)*0.15;
    ctx.save();
    ctx.globalAlpha=pulse*0.3;
    ctx.shadowColor='#a855f7';
    ctx.shadowBlur=30;
    ctx.fillStyle='#a855f7';
    ctx.beginPath();
    ctx.arc(px,py,12,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
    
    // 悬浮粒子
    for(let i=0;i<4;i++){
        let angle=_portalAnimTime+i*Math.PI/2;
        let rx=Math.cos(angle)*20, ry=Math.sin(angle)*15;
        ctx.save();
        ctx.globalAlpha=0.5+Math.sin(_portalAnimTime*3+i)*0.3;
        ctx.fillStyle=i%2===0?'#a855f7':'#00d4ff';
        ctx.beginPath();
        ctx.arc(px+rx,py+ry,2+Math.sin(_portalAnimTime*2+i)*0.5,0,Math.PI*2);
        ctx.fill();
        ctx.restore();
    }
}

/** Main render loop. Compositing layer order: grid → walls → items → monsters → player → UI → particles. */
function render() {
    ctx.fillStyle = CONFIG.BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    updateCamera();
    drawPortal();
    drawGrid();
    drawWalls();
    drawPath();
    drawMonsters();
    drawDashEffects();
    drawParticles();
    drawGroundItems();
    drawPlayer();
    drawUI();
}
function drawGrid(){
    ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=1;
    for(let x=0;x<=MAP_W;x+=CONFIG.GRID_SIZE){
        let s=worldToScreen(x,0), e=worldToScreen(x,MAP_H);
        ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(e.x,e.y); ctx.stroke();
    }
    for(let y=0;y<=MAP_H;y+=CONFIG.GRID_SIZE){
        let s=worldToScreen(0,y), e=worldToScreen(MAP_W,y);
        ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(e.x,e.y); ctx.stroke();
    }
}
function drawWalls(){
    if(!gameState.grid) return;
    for(let row of gameState.grid) for(let cell of row){
        if(cell.type==='wall'){
            let p=worldToScreen(cell.x-CONFIG.GRID_SIZE/2,cell.y-CONFIG.GRID_SIZE/2);
            ctx.fillStyle=CONFIG.WALL_COLOR;
            ctx.fillRect(p.x,p.y,CONFIG.GRID_SIZE,CONFIG.GRID_SIZE);
            ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1;
            ctx.strokeRect(p.x,p.y,CONFIG.GRID_SIZE,CONFIG.GRID_SIZE);
        }
    }
}
/** Draw all alive monsters with health bars, status effect indicators, and hit flash. */
function drawMonsters(){
    for(let m of gameState.monsters){
        m.draw(ctx);
    }
}
function drawGroundItems(){
    groundItemRegions.length=0; // 每帧重建
    for(var i=groundItems.length-1;i>=0;i--){
        var gi=groundItems[i];
        if(!gi) continue;
        gi.lifeTimer = (gi.lifeTimer||30000) - 16;
        if(gi.lifeTimer<=0){ groundItems.splice(i,1); continue; }
        var pos=worldToScreen(gi.x,gi.y);
        // 光效
        ctx.shadowColor='#ffd700'; ctx.shadowBlur=12;
        ctx.fillStyle='rgba(255,215,0,0.15)';
        ctx.beginPath(); ctx.arc(pos.x,pos.y,16,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // 道具图标
        ctx.font='18px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(gi.item.icon, pos.x, pos.y-2);
        // 名字
        ctx.fillStyle='rgba(255,215,0,0.8)'; ctx.font='bold 8px Arial'; ctx.textBaseline='alphabetic';
        ctx.fillText(gi.item.name, pos.x, pos.y+14);
        // 保存点击区域到groundItemRegions
        groundItemRegions.push({x:pos.x-18, y:pos.y-20, w:36, h:36, item:gi.item});
        // 闪烁标记（消失前5秒开始闪）
        if(gi.lifeTimer<=5000){
            ctx.globalAlpha=0.5+0.5*Math.sin(Date.now()/200);
            ctx.fillStyle='rgba(255,200,0,0.6)'; ctx.font='7px Arial';
            ctx.fillText('💨', pos.x, pos.y-20);
            ctx.globalAlpha=1;
        }
    }
}
function drawDashEffects(){
    let now=Date.now();
    inputState.dashEffects=inputState.dashEffects.filter(e=>now-e.startTime<e.duration);
    for(let e of inputState.dashEffects){
        let prog=(now-e.startTime)/e.duration, alpha=(1-prog)*0.5;
        let fp=worldToScreen(e.fromX,e.fromY), tp=worldToScreen(e.toX,e.toY);
        ctx.strokeStyle='rgba(255,105,180,'+alpha+')'; ctx.lineWidth=4;
        ctx.setLineDash([8,4]); ctx.beginPath(); ctx.moveTo(fp.x,fp.y); ctx.lineTo(tp.x,tp.y); ctx.stroke(); ctx.setLineDash([]);
    }
}
function drawPath(){
    if(gameState.currentPath.length===0) return;
    ctx.strokeStyle=CONFIG.PATH_LINE_COLOR; ctx.lineWidth=2; ctx.setLineDash([4,4]);
    ctx.beginPath();
    let pp=worldToScreen(gameState.player.x,gameState.player.y);
    ctx.moveTo(pp.x,pp.y);
    for(let i=gameState.currentPathIndex;i<gameState.currentPath.length;i++){
        let p=worldToScreen(gameState.currentPath[i].x,gameState.currentPath[i].y);
        ctx.lineTo(p.x,p.y);
    }
    ctx.stroke(); ctx.setLineDash([]);
}
function drawParticles(){
    for(let p of gameState.particles) if(p&&typeof p.draw==='function') p.draw(ctx);
    for(let t of gameState.floatingTexts) if(t&&typeof t.draw==='function') t.draw(ctx);
    for(let p of gameState.projectiles) if(p&&typeof p.draw==='function') p.draw(ctx);
}
/** Draw player sprite with hero-specific effects (cultivation sword glow, dash trail). */
function drawPlayer(){
    if(!gameState.player) return;
    let p=gameState.player;
    let pos=worldToScreen(p.x-CONFIG.PLAYER_SIZE/2,p.y-CONFIG.PLAYER_SIZE/2);
    let s=CONFIG.PLAYER_SIZE;
    // ===== 修仙模式 - 浮动藏剑挂件（人物背后，先绘制） =====
    var _cult=gameState.cultivation;
    if(_cult && _cult.showHiddenSword && !_cult.hiddenSwordOpen && currentHero==='xian'){
        // 浮动剑位置：人物右后方，随人物移动
        var swordSize = 22;
        var floatOffset = Math.sin(Date.now()/500) * 4; // 上下浮动
        var swordX = pos.x + s + 2; // 人物右侧
        var swordY = pos.y - 8 + floatOffset; // 人物上方浮动

        // 光晕（发光圆）
        var glowAlpha = 0.5 + 0.3 * Math.sin(Date.now()/400);
        ctx.fillStyle='rgba(255,215,0,'+(glowAlpha*0.3)+')';
        ctx.beginPath(); ctx.arc(swordX+swordSize/2, swordY+swordSize/2, swordSize/2+6, 0, Math.PI*2); ctx.fill();

        // 外圈光晕
        ctx.fillStyle='rgba(255,200,0,'+(glowAlpha*0.15)+')';
        ctx.beginPath(); ctx.arc(swordX+swordSize/2, swordY+swordSize/2, swordSize/2+12, 0, Math.PI*2); ctx.fill();

        // 剑身背景框
        ctx.fillStyle='rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.roundRect(swordX, swordY, swordSize, swordSize, 4); ctx.fill();

        // 剑图标
        ctx.font='16px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('🗡️', swordX+swordSize/2, swordY+swordSize/2+1);
        ctx.textBaseline='alphabetic';

        // 存储点击区域
        _cult._floatSword = {x:swordX, y:swordY, w:swordSize, h:swordSize};
    }

    // 光环（攻击范围指示）
    ctx.strokeStyle='rgba(0,212,255,0.15)'; ctx.lineWidth=1; ctx.setLineDash([2,4]);
    ctx.beginPath(); ctx.arc(pos.x+s/2,pos.y+s/2,(gameState.config?.hero?.attackRange || CONFIG.ATTACK_RANGE)+(gameState.player?.extraRange||0),0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    // 主体
    ctx.fillStyle=p.isDashing?CONFIG.PLAYER_DASH_COLOR:CONFIG.PLAYER_COLOR;
    ctx.fillRect(pos.x,pos.y,s,s);
    ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.strokeRect(pos.x,pos.y,s,s);
    // 面部
    ctx.fillStyle='rgba(255,255,255,0.9)';
    ctx.fillRect(pos.x+s*0.18,pos.y+s*0.25,s*0.22,s*0.18);
    ctx.fillRect(pos.x+s*0.6,pos.y+s*0.25,s*0.22,s*0.18);
    // 瞳孔
    ctx.fillStyle='#1a1a2e';
    ctx.fillRect(pos.x+s*0.28,pos.y+s*0.3,s*0.08,s*0.08);
    ctx.fillRect(pos.x+s*0.7,pos.y+s*0.3,s*0.08,s*0.08);
    // 攻击冷却指示器
    if(Date.now()-gameState.attackCooldown<CONFIG.ATTACK_COOLDOWN){
        let cd=(Date.now()-gameState.attackCooldown)/CONFIG.ATTACK_COOLDOWN;
        ctx.fillStyle='rgba(255,255,255,0.3)';
        ctx.fillRect(pos.x,pos.y+s,s*cd,3);
    }
}
function drawResourceBars(){
    if(!gameState.player||gameState.isGameOver) return;
    let p=gameState.player;
    // 左上角面板（头像+等级+职业+血蓝条 全部平铺）
    let px=5, py=58, pw=145, ph=40;
    ctx.fillStyle='rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.moveTo(px+6,py); ctx.lineTo(px+pw-6,py); ctx.quadraticCurveTo(px+pw,py,px+pw,py+6);
    ctx.lineTo(px+pw,py+ph-6); ctx.quadraticCurveTo(px+pw,py+ph,px+pw-6,py+ph);
    ctx.lineTo(px+6,py+ph); ctx.quadraticCurveTo(px,py+ph,px,py+ph-6);
    ctx.lineTo(px,py+6); ctx.quadraticCurveTo(px,py,px+6,py);
    ctx.closePath(); ctx.fill();
    // 头像框（最左） — 使用角色图标
    let aX=px+4, aY=py+3, aW=28, aH=28;
    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(aX,aY,aW,aH);
    ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=1.5; ctx.strokeRect(aX,aY,aW,aH);
    // 角色图标
    var _heroIcon=HERO_CLASSES&&HERO_CLASSES[currentHero]?HERO_CLASSES[currentHero].icon:'🧙';
    ctx.fillStyle='#fff'; ctx.font='20px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(_heroIcon, aX+aW/2, aY+aH/2); ctx.textBaseline='alphabetic';
    ctx.textAlign='left';
    // 等级 + 职业（头像右侧第一行）
    let rX=aX+aW+6;
    ctx.fillStyle='rgba(255,215,0,0.85)'; ctx.font='bold 9px Arial'; ctx.textAlign='left';
    ctx.fillText('Lv.'+(gameState.wave||1), rX, py+11);
    let className=(gameState.config&&gameState.config.hero&&gameState.config.hero.name)?gameState.config.hero.name:'战士';
    ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='bold 8px Arial';
    ctx.fillText(className, rX+38, py+11);
    // HP条（头像右侧，等级下方）
    let hW=pw-rX-px-4, hY=py+17, hH=9;
    ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(rX,hY,hW,hH,4); ctx.stroke();
    ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.roundRect(rX,hY,hW,hH,4); ctx.fill();
    ctx.fillStyle=CONFIG.HP_COLOR; ctx.beginPath(); ctx.roundRect(rX+1,hY+1,Math.max(3,(hW-2)*(p.hp/p.maxHp)),hH-2,3); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='bold 7px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(Math.ceil(p.hp)+'/'+p.maxHp, rX+hW/2, hY+hH/2);
    // MP条（HP下方）
    let mY=hY+hH+3, mH=7;
    ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(rX,mY,hW,mH,3); ctx.stroke();
    ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.roundRect(rX,mY,hW,mH,3); ctx.fill();
    ctx.fillStyle=CONFIG.MP_COLOR; ctx.beginPath(); ctx.roundRect(rX+1,mY+1,Math.max(3,(hW-2)*(p.mp/CONFIG.MAX_MP)),mH-2,2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='bold 7px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(Math.ceil(p.mp)+'/'+CONFIG.MAX_MP, rX+hW/2, mY+mH/2);
    ctx.textBaseline='alphabetic';
}
function drawPlayerBars(){}
/** Draw HUD: HP/MP bars, wave counter, gold, score, skill bar, mini-map. */
function drawUI(){
    if(gameState.isGameOver) return;
    drawResourceBars();
    // 时间静止覆盖层
    var tf=gameState._timeFreeze;
    if(tf&&tf.active){
        ctx.fillStyle='rgba(0,100,200,0.08)';
        ctx.fillRect(0,0,canvas.width,canvas.height);
        // 倒计时
        var left=Math.ceil(tf.timer/1000);
        ctx.fillStyle='rgba(0,212,255,0.5)';
        ctx.font='bold 32px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('⏰ '+left+'s',canvas.width/2,canvas.height/2-40);
        ctx.font='bold 14px Arial'; ctx.fillStyle='rgba(0,212,255,0.3)';
        ctx.fillText('时间静止',canvas.width/2,canvas.height/2-10);
        ctx.textBaseline='alphabetic';
    }
    // 上栏
    ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(0,0,canvas.width,68);
    ctx.textAlign='left';
    // 关卡+难度+角色
    let diffNames={}; for(let k in DIFFICULTY_MULTIPLIERS) diffNames[k]=DIFFICULTY_MULTIPLIERS[k].name;
    ctx.fillStyle='#fff'; ctx.font='bold 12px Arial';
    ctx.textAlign='center';
    var heroName=currentHero?(HERO_CLASSES[currentHero]?HERO_CLASSES[currentHero].icon+' '+HERO_CLASSES[currentHero].name:''):'';
    ctx.fillText(heroName+(heroName?' | ':'')+'⚔ 第'+gameState.wave+'波'+(gameState.wave%5===0?' 💀Boss':'')+' | '+diffNames[currentDifficulty],canvas.width/2,24);
    ctx.textAlign='left';
    // 波次进度条（居中）
    if(!gameState.isBetweenWaves){
        let pw=140, ph=3, px=(canvas.width-pw)/2, py=30, prog=gameState.waveTimer/(gameState.waveTotalTime*1000);
        ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.roundRect(px,py,pw,ph,2); ctx.fill();
        ctx.fillStyle='#ffdd59'; ctx.beginPath(); ctx.roundRect(px,py,pw*Math.min(1,prog),ph,2); ctx.fill();
    }
    // 分数和击杀  
    ctx.fillStyle='#ffdd59'; ctx.textAlign='right'; ctx.font='bold 14px Arial';
    ctx.fillText('🏆 '+gameState.score,canvas.width-14,24);
    ctx.fillStyle='#ff6348'; ctx.fillText('💀 '+gameState.kills,canvas.width-14,40);
    ctx.fillStyle='#00d4ff'; ctx.fillText('👹 '+gameState.monsters.length,canvas.width-14,56);

    // 金币（右上）
    ctx.fillStyle='#ffd700'; ctx.textAlign='right'; ctx.font='bold 14px Arial';
    ctx.fillText('💰 '+gameState.gold,canvas.width-14,72);

    // Boss HP条 & 计时（Boss阶段显示）
    if(gameState.phase === 'boss' && gameState.bossActive){
        let bm = gameState.bossMonster;
        if(bm && bm.hp > 0){
            let bw = 220, bh = 18, bx = (canvas.width-bw)/2, by = 85;
            // 条背景
            ctx.fillStyle='rgba(0,0,0,0.6)';
            ctx.beginPath(); ctx.roundRect(bx-2, by-2, bw+4, bh+4, 6); ctx.fill();
            // Boss名
            let bdef = getBossDef(gameState.wave);
            ctx.fillStyle=bdef?bdef.color:'#dc2626'; ctx.font='bold 10px Arial'; ctx.textAlign='center';
            ctx.fillText((bdef?bdef.icon:'👹')+' '+(bdef?bdef.name:'BOSS'), canvas.width/2, by-4);
            // HP条
            var hpPct = bm.hp/bm.maxHp;
            var hpColor = hpPct>0.5?'#22c55e':(hpPct>0.25?'#eab308':'#ef4444');
            ctx.fillStyle='rgba(255,255,255,0.15)';
            ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 4); ctx.fill();
            ctx.fillStyle=hpColor;
            ctx.beginPath(); ctx.roundRect(bx, by, bw*hpPct, bh, 4); ctx.fill();
            ctx.fillStyle='#fff'; ctx.font='bold 8px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText(Math.ceil(bm.hp)+'/'+bm.maxHp, canvas.width/2, by+bh/2); ctx.textBaseline='alphabetic';
            // 计时（在HP条下方）
            let timerLeft = Math.ceil(gameState.bossTimer/1000);
            ctx.fillStyle=timerLeft<=10?'#ef4444':'#ffd700'; ctx.font='bold 11px Arial'; ctx.textAlign='center';
            ctx.fillText('⏱️ '+timerLeft+'s', canvas.width/2, by+bh+16);
        }
    }

    // 右侧爬塔按钮
    drawBondBtnTR();
    drawTowerButton();
    drawChestIcon();
    drawTimeFreezeBtn();

    // ===== AI Bot 面板 =====
    var aiX=canvas.width-56,aiY=225,aiW=34;
    // AI 开关按钮
    ctx.fillStyle=gameState.aiEnabled?'rgba(0,200,100,0.25)':'rgba(255,255,255,0.08)';
    ctx.strokeStyle=gameState.aiEnabled?'#00c864':'rgba(255,255,255,0.3)';
    ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(aiX,aiY,aiW,aiW,6);ctx.fill();ctx.stroke();
    ctx.font='14px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=gameState.aiEnabled?'#00c864':'rgba(255,255,255,0.5)';
    ctx.fillText('🤖',aiX+aiW/2,aiY+aiW/2);
    // AI 标签
    ctx.font='9px Arial';ctx.textAlign='center';
    ctx.fillStyle='rgba(255,255,255,0.5)';
    ctx.fillText('AI',aiX+aiW/2,aiY+aiW+10);
    // 模式文字（点击切换）
    var modeNames={balanced:'均衡',kite:'风筝',evade:'闪避'};
    ctx.font='9px Arial';ctx.textAlign='center';
    ctx.fillStyle=gameState.aiEnabled?'#22c55e':'rgba(255,255,255,0.3)';
    ctx.fillText(modeNames[gameState.aiMode]||'均衡',aiX+aiW/2,aiY+aiW+24);
    ctx.fillStyle='rgba(255,255,255,0.2)';ctx.font='7px Arial';
    ctx.fillText(gameState.aiEnabled?'● 运行中':'○ 已停止',aiX+aiW/2,aiY+aiW+36);
    ctx.textBaseline='alphabetic';

    // 左侧羁绊进度
    let sc={};
    for(let card of gameState.skillBar||[]){ if(card&&card.type) sc[card.type]=(sc[card.type]||0)+1; }
    let lx=4,ly=122,lg=18;
    let ltypes=['warrior','assassin','mage','ice'];
    let lAct=[],lPen=[];
    for(let t of ltypes){let cfg=CARD_TYPES[t];if(!cfg)continue;let cnt=sc[t]||0,isAct=gameState.synergyActivated&&gameState.synergyActivated[t];if(isAct) lAct.push({t,cnt,cfg});else if(cnt>0) lPen.push({t,cnt,cfg});}
    lAct.sort(function(a,b){return b.cnt-a.cnt;});lPen.sort(function(a,b){return b.cnt-a.cnt;});
    let lAll=lAct.concat(lPen);
    for(let it of lAll){let isAct=gameState.synergyActivated&&gameState.synergyActivated[it.t];ctx.fillStyle=isAct?'#22c55e':'rgba(255,255,255,0.5)';ctx.font=isAct?'bold 10px Arial':'10px Arial';ctx.textAlign='left';ctx.fillText((isAct?'✅ ':'')+it.cfg.icon+(isAct?it.cfg.name:'×'+it.cnt+'/'+(it.cfg.threshold||3)),lx,ly);ly+=lg;}

    // ===== 底部操作栏（抽卡按钮）=====
    let by = canvas.height - 50;
    let cardCost = getCardConfig('refreshCost', SHOP_REFRESH_COST);
    ctx.fillStyle = gameState.gold >= cardCost ? '#f1c40f' : '#666';
    ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
    ctx.beginPath();
    let bx = canvas.width/2, bw = 70, bh = 26;
    ctx.roundRect(bx-bw/2, by-2, bw, bh, 6);
    ctx.fill();
    ctx.fillStyle = gameState.gold >= cardCost ? '#fff' : '#999';
    ctx.fillText('🎴 抽卡 💰'+cardCost, bx, by+14);

    // ===== 浮空技能卡（无技能栏，重叠悬浮）=====
    let sb = gameState.skillBar || [];
    let slotSize = 34, overlap = 8; // 每个卡重叠前一卡8px
    let totalW = slotSize * MAX_SKILL_BAR - overlap * (MAX_SKILL_BAR - 1);
    let baseY = canvas.height - 90;
    let t = Date.now() / 1500; // 浮动画计时

    for(let i=0;i<MAX_SKILL_BAR;i++){
        let sx = (canvas.width - totalW)/2 + i*(slotSize - overlap);
        let floatOffset = Math.sin(t * 1.3 + i * 1.2) * 2.5; // 每张卡独立浮动相位
        let sy = baseY - floatOffset;
        let card = sb[i];
        let bgColor = 'rgba(255,255,255,0.08)';
        let borderColor = 'rgba(255,255,255,0.25)';
        if(card){
            let cfg = CARD_TYPES[card.type];
            if(cfg){ bgColor = cfg.color+'30'; borderColor = cfg.color; }
            // 修仙卡特殊样式
            if(card._cult || card.type==='cult_starter' || card.type==='cult_sub_starter' || card.type==='cult_sword_blue' || card.type==='cult_sword_gold'){
                if(card.type==='cult_sword_gold' || card.rarity==='gold'){
                    borderColor = '#ffd700'; bgColor = 'rgba(255,215,0,0.25)';
                } else if(card.type==='cult_sword_blue' || card.rarity==='blue'){
                    borderColor = '#00d4ff'; bgColor = 'rgba(0,212,255,0.18)';
                } else {
                    borderColor = '#a855f7'; bgColor = 'rgba(168,85,247,0.18)';
                }
            }
        }
        // 卡片阴影
        ctx.shadowColor = card ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = card ? 6 : 3;
        ctx.shadowOffsetY = card ? 2 : 1;
        ctx.fillStyle = bgColor;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = card ? 1.5 : 0.8;
        ctx.beginPath(); ctx.roundRect(sx, sy, slotSize, slotSize, 5); ctx.fill(); ctx.stroke();
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        if(card){
            ctx.font=card._isCultL3 ? 'bold 17px Arial' : '16px Arial';
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText(card.icon||'',sx+slotSize/2,sy+slotSize/2); ctx.textBaseline='alphabetic';
            // L2倒计时
            if(card._cultTimer !== undefined && card._cultTimer > 0){
                let sec = Math.ceil(card._cultTimer/1000);
                ctx.fillStyle='#ffd700'; ctx.font='bold 8px Arial'; ctx.textAlign='center';
                ctx.fillText(sec+'s', sx+slotSize/2, sy+slotSize+11);
            }
            // L3标记
            if(card._isCultL3){
                ctx.fillStyle='rgba(255,215,0,0.7)'; ctx.font='7px Arial'; ctx.textAlign='center';
                ctx.fillText('📖', sx+slotSize/2-1, sy-4);
            }
        }
    }

    // ===== 道具栏（居中，技能栏上方）=====
    var cult=gameState.cultivation;
    var eqSlotSize = 28, eqGap = 6, maxEq = 5;
    var eqTotalW = (eqSlotSize+eqGap)*maxEq - eqGap;
    var eqStartX = (canvas.width - eqTotalW)/2;
    var eqY = baseY - eqSlotSize - 10; // 放在浮空技能卡正上方
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.roundRect(eqStartX-4, eqY-4, eqTotalW+8, eqSlotSize+8, 6); ctx.fill();
    // 标签
    ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.font='8px Arial'; ctx.textAlign='center';
    ctx.fillText('道具', eqStartX+eqTotalW/2, eqY-7);

    // 保存槽位区域用于点击检测
    eqSlotRegions = [];
    // 槽位0: 残剑（修仙系统）
    if(cult && cult.swordBroken){
        var e1x = eqStartX, e1y = eqY;
        ctx.strokeStyle='#ffa500'; ctx.lineWidth=1;
        ctx.fillStyle='rgba(255,165,0,0.1)';
        ctx.beginPath(); ctx.roundRect(e1x, e1y, eqSlotSize, eqSlotSize, 4); ctx.fill(); ctx.stroke();
        ctx.font='16px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('🗡️', e1x+eqSlotSize/2, e1y+eqSlotSize/2); ctx.textBaseline='alphabetic';
        ctx.fillStyle='rgba(255,165,0,0.7)'; ctx.font='7px Arial'; ctx.textAlign='center';
        ctx.fillText('Lv'+(cult.swordLevel||1), e1x+eqSlotSize/2, e1y+eqSlotSize+9);
        eqSlotRegions.push({slotIdx:0, x:e1x, y:eqY, w:eqSlotSize, h:eqSlotSize, label:'残剑Lv'+(cult.swordLevel||1)});
    }
    // 其他槽位：Boss掉落道具
    for(var ei=1; ei<maxEq; ei++){
        var ex = eqStartX + ei*(eqSlotSize+eqGap);
        var eqIdx = ei-1;
        var item = equipSlots[eqIdx];
        if(item){
            ctx.strokeStyle='#ffd700'; ctx.lineWidth=1.5;
            ctx.fillStyle='rgba(255,215,0,0.12)';
            ctx.beginPath(); ctx.roundRect(ex, eqY, eqSlotSize, eqSlotSize, 4); ctx.fill(); ctx.stroke();
            ctx.font='16px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText(item.icon, ex+eqSlotSize/2, eqY+eqSlotSize/2); ctx.textBaseline='alphabetic';
            ctx.fillStyle='rgba(255,215,0,0.6)'; ctx.font='6px Arial'; ctx.textAlign='center';
            ctx.fillText(item.name, ex+eqSlotSize/2, eqY+eqSlotSize+7);
            eqSlotRegions.push({slotIdx:ei, x:ex, y:eqY, w:eqSlotSize, h:eqSlotSize, label:item.name, item:item});
        } else {
            ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=1;
            ctx.fillStyle='rgba(255,255,255,0.03)';
            ctx.beginPath(); ctx.roundRect(ex, eqY, eqSlotSize, eqSlotSize, 4); ctx.fill(); ctx.stroke();
            eqSlotRegions.push({slotIdx:ei, x:ex, y:eqY, w:eqSlotSize, h:eqSlotSize, item:null});
        }
    }

    // 羁绊信息
    let synergyCounts = {};
    for(let card of sb){
        if(card && card.type) synergyCounts[card.type] = (synergyCounts[card.type]||0)+1;
    }
    let hasSynergy = false;
    for(let [type, count] of Object.entries(synergyCounts)){
        var _nd = (CARD_TYPES[type] && CARD_TYPES[type].threshold) || SYNERGY_THRESHOLD; if(count >= _nd){
            let cfg = CARD_TYPES[type];
            if(cfg){
                hasSynergy = true;
                ctx.fillStyle = cfg.color; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'left';
                ctx.fillText('🔗 '+cfg.name+'羁绊 ✓', startX, sy-6);
                break;
            }
        }
    }
    if(!hasSynergy && sb.length > 0){
        // 显示各类型数量
        let infos = [];
        for(let [type, count] of Object.entries(synergyCounts)){
            let cfg = CARD_TYPES[type];
            if(cfg) infos.push(cfg.icon+'×'+count);
        }
        if(infos.length > 0){
            ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '10px Arial'; ctx.textAlign = 'left';
            ctx.fillText(infos.map(function(x){return x;}).join(' | ')+' ', startX, sy-6);
        }
    }

    // 底部提示
    ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font='12px Arial'; ctx.textAlign='center';
    ctx.fillText('点击移动 | 双击闪现 | F时间静止 | 自动攻击',canvas.width/2,canvas.height-32);
    // 版本号
    ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.textAlign='left'; ctx.font='9px Arial';
    ctx.fillText(CONFIG.VERSION,4,canvas.height-32);

    // === 修仙UI ===
    drawCultivationUI();
}

// ==================== 修仙UI绘制 ====================
function drawCultivationUI(){
    var cult = gameState.cultivation;
    if(!cult) return;
    var ctx = canvas.getContext('2d');

    // 修为值显示（stage>=1时）
    if(cult.stage >= 1){
        var cv = cult.cultivationValue || 0;
        ctx.fillStyle='rgba(255,215,0,0.7)'; ctx.font='bold 10px Arial'; ctx.textAlign='left';
        var cvText = '☯ 修为 '+cv+'/'+MAX_CULTIVATION_VALUE;
        ctx.fillText(cvText, canvas.width-100, 42);
        // 修为进度条
        var barW = 80, barH = 4, barX = canvas.width-100, barY = 46;
        ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 2); ctx.fill();
        ctx.fillStyle='#ffd700'; ctx.beginPath(); ctx.roundRect(barX, barY, barW*(cv/MAX_CULTIVATION_VALUE), barH, 2); ctx.fill();
        // 修为等级
        var rank = '凡人';
        if(cv >= 150) rank = '剑神';
        else if(cv >= 120) rank = '飞升';
        else if(cv >= 90) rank = '道师';
        ctx.fillStyle='#ffd700'; ctx.font='bold 9px Arial';
        ctx.fillText(rank, canvas.width-100, 56);
    }

    // 学习次数 + 升级次数显示
    if(cult.stage >= 2){
        ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.font='9px Arial';
        ctx.fillText('📖学习:'+(cult.studyPoints||0)+'  🔨升级:'+(cult.upgradePoints||0), canvas.width-100, 68);
    }

    // 藏剑改为浮动挂件（在drawPlayer中绘制）

    // 藏剑面板（打开时）
    if(cult.hiddenSwordOpen){
        drawHiddenSwordPanel();
    }
}

function drawHiddenSwordPanel(){
    var ctx = canvas.getContext('2d');
    var pw = 260, ph = 220;
    var px = (canvas.width-pw)/2, py = (canvas.height-ph)/2;

    // 面板背景
    ctx.fillStyle='rgba(0,0,0,0.85)';
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 12); ctx.fill();
    ctx.strokeStyle='#ffd700'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 12); ctx.stroke();

    // 标题
    ctx.fillStyle='#ffd700'; ctx.font='bold 16px Arial'; ctx.textAlign='center';
    ctx.fillText('🗡️ 藏剑阁', canvas.width/2, py+28);

    // 残剑信息
    var cult = gameState.cultivation;
    ctx.fillStyle='#fff'; ctx.font='12px Arial'; ctx.textAlign='left';
    ctx.fillText('残剑 Lv.'+(cult.swordLevel||1)+'  |  剑光 '+(cult.swordCount||0)+'道', px+20, py+55);
    ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='11px Arial';
    ctx.fillText('修为 '+Math.floor((cult.cultivationValue||0)/MAX_CULTIVATION_VALUE*100)+'%', px+20, py+72);

    // 按钮 A: 升级残剑
    var aX = px+15, aY = py+85, aW = pw-30, aH = 42;
    var aCost = cult.upgradePoints > 0;
    ctx.fillStyle = aCost ? 'rgba(255,165,0,0.3)' : 'rgba(100,100,100,0.3)';
    ctx.strokeStyle = aCost ? '#ffa500' : '#555';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(aX, aY, aW, aH, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = aCost ? '#ffa500' : '#666';
    ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
    ctx.fillText('A. 升级残剑 (消耗1升级次数)', canvas.width/2, aY+18);
    ctx.font = '10px Arial';
    ctx.fillStyle = aCost ? 'rgba(255,165,0,0.7)' : '#555';
    ctx.fillText(aCost ? '成功率: 低  |  失败不扣次数' : '需要金卡回收获得升级次数', canvas.width/2, aY+34);
    cult._hsBtnA = {x:aX, y:aY, w:aW, h:aH};

    // 按钮 B: 学习技能（回收L3卡）
    var bX = aX, bY = aY + aH + 8, bW = aW, bH = 42;
    var hasStudy = (cult.studyPoints||0) > 0;
    // 找到技能栏中的L3修仙卡
    var sb = gameState.skillBar || [];
    var l3Cards = [];
    for(var i=0; i<sb.length; i++){
        if(sb[i] && (sb[i].type==='cult_sword_blue' || sb[i].type==='cult_sword_gold')){
            l3Cards.push(sb[i]);
        }
    }
    var canLearn = hasStudy && l3Cards.length > 0;

    ctx.fillStyle = canLearn ? 'rgba(0,212,255,0.3)' : 'rgba(100,100,100,0.3)';
    ctx.strokeStyle = canLearn ? '#00d4ff' : '#555';
    ctx.beginPath(); ctx.roundRect(bX, bY, bW, bH, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = canLearn ? '#00d4ff' : '#666';
    ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
    ctx.fillText('B. 学习技能 (消耗1学习次数)', canvas.width/2, bY+18);
    ctx.font = '10px Arial';
    var l3names = l3Cards.map(function(c){return c.name;}).join(', ');
    ctx.fillStyle = canLearn ? 'rgba(0,212,255,0.7)' : '#555';
    ctx.fillText('技能栏: '+(l3names||'无')+'  |  学习次数:'+(cult.studyPoints||0), canvas.width/2, bY+34);
    cult._hsBtnB = {x:bX, y:bY, w:bW, h:bH};

    // 关闭按钮 ×
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '20px Arial'; ctx.textAlign = 'right';
    ctx.fillText('✕', px+pw-10, py+24);
    cult._hsBtnClose = {x:px+pw-30, y:py, w:30, h:30};

    // 剑光显示
    if(cult.swordCount > 0){
        ctx.fillStyle='rgba(255,215,0,0.8)'; ctx.font='bold 11px Arial'; ctx.textAlign='center';
        var ultText = cult.hasUltimate ? '🌟 万剑归宗 已觉醒 !' : cult.swordCount+'/7 剑光收集';
        ctx.fillText(ultText, canvas.width/2, bY+bH+20);
    }
}

// 寻找闪现安全落点：闪到能打到怪又不会被贴身的位置
function findDashSafeSpot(fx,fy,angle){
    var candidates=[];
    for(var mul=0.8;mul<=2.0;mul+=0.2) candidates.push({x:fx+Math.cos(angle)*CONFIG.DASH_DISTANCE*mul,y:fy+Math.sin(angle)*CONFIG.DASH_DISTANCE*mul});
    for(var di=0;di<8;di++){var da=Math.PI*2*di/8;for(var dm=1.0;dm<=1.8;dm+=0.4)candidates.push({x:fx+Math.cos(da)*CONFIG.DASH_DISTANCE*dm,y:fy+Math.sin(da)*CONFIG.DASH_DISTANCE*dm});}
    var best=null,bestScore=-99999;
    var cfg=gameState.config||DEFAULT_GAME_CONFIG;
    var atkRange=(cfg.hero.attackRange||160)+(gameState.player?gameState.player.extraRange||0:0);
    for(var ci=0;ci<candidates.length;ci++){
        var c=candidates[ci];
        if(c.x<25||c.x>MAP_W-25||c.y<25||c.y>MAP_H-25) continue;
        if(!canMoveTo(c.x,c.y)) continue;
        var minD=99999;
        for(var mi=0;mi<gameState.monsters.length;mi++){var m=gameState.monsters[mi];if(!m||m.hp<=0)continue;var d=Math.sqrt((c.x-m.x)*(c.x-m.x)+(c.y-m.y)*(c.y-m.y));if(d<minD)minD=d;}
        // 打分：安全距离合适(30~atkRange)最高分，太远减分，太近也减分
        var score=0;
        if(minD<30) score=-1000;                 // 贴身→不能用
        else if(minD<=atkRange) score=minD;       // 在攻击范围内→越安全越好
        else score=atkRange-(minD-atkRange)*0.5;  // 超出攻击范围→越远越差
        if(score>bestScore){bestScore=score;best=c;}
    }
    if(best) return {x:Math.round(best.x),y:Math.round(best.y)};
    var bx=fx+Math.cos(angle)*CONFIG.DASH_DISTANCE,by=fy+Math.sin(angle)*CONFIG.DASH_DISTANCE;
    if(bx<20||bx>MAP_W-20)bx=MAP_W/2;
    if(by<20||by>MAP_H-20)by=MAP_H/2;
    return {x:Math.round(bx),y:Math.round(by)};
}

// ==================== AI Bot 系统 ====================
/** AI Bot main loop. Autonomous pathfinding, combat, dash evasion, and item pickup. */
function updateAI(){
    if(!gameState.player||gameState.isGameOver){
        // 自动复活 — 保存AI状态并在复活后恢复
        if(gameState.isGameOver&&!gameState._aiRestarting){
            gameState._aiRestarting=true;
            var wasAI=gameState.aiEnabled;
            setTimeout(function(){
                restartGame();
                // 复活后如果之前AI开着，自动恢复AI
                if(wasAI) gameState.aiEnabled=true;
                gameState._aiRestarting=false;
            },2000);
        }
        return;
    }
    if(!gameState.aiEnabled) return;
    var p=gameState.player,now=Date.now();
    if(!gameState._nextAIopTime) gameState._nextAIopTime=now+500+Math.random()*1500;

    // 1. 找最近的怪物（分普通和塔怪分别追踪，塔怪也要算入威胁距离）
    var nearest=null,minDist=99999,nearestThreat=null,threatDist=99999,aliveCount=0;
    for(var mi=0;mi<gameState.monsters.length;mi++){
        var m=gameState.monsters[mi];
        if(!m||m.hp<=0) continue;
        if(!m._isTowerMonster) aliveCount++;
        var d=Math.sqrt((p.x-m.x)*(p.x-m.x)+(p.y-m.y)*(p.y-m.y));
        if(d<threatDist){threatDist=d;nearestThreat=m;}
        if(d<minDist&&!m._isTowerMonster){minDist=d;nearest=m;}
    }

    var cfg=gameState.config||DEFAULT_GAME_CONFIG;
    var attackRange=(cfg.hero.attackRange||160)+(p.extraRange||0);
    var safeDist=attackRange*0.6;
    var idealDist=gameState.aiMode==='kite'?attackRange*0.85:gameState.aiMode==='evade'?attackRange*0.9:attackRange*0.5;
    var dangerDist=30;

    // ===== AI 自动操作（带节奏）= 不依赖移动能力 =====
    if(now>=gameState._nextAIopTime){
        // 自动开塔
        var hasTowerAlive=gameState.monsters.some(function(m){return m&&m.hp>0&&m._isTowerMonster;});
        if(aliveCount<3&&!gameState._towerSpawned&&!hasTowerAlive&&!gameState.isGameOver){
            if(!gameState._lastTowerAutoTime||now-gameState._lastTowerAutoTime>5000){
                spawnTowerMonsters(); gameState._lastTowerAutoTime=now;
                gameState._nextAIopTime=now+300+Math.random()*1200;
            }
        }
        // 自动抽卡（留底30金，不等待移动能力）
        var poolAvail=(gameState.availableCards||CARD_POOL).length;
        if(poolAvail===0&&!gameState.availableCards) poolAvail=CARD_POOL.length;
        var sbLen=(gameState.skillBar||[]).length;
        if(sbLen<MAX_SKILL_BAR&&gameState.gold>=SHOP_REFRESH_COST+30&&poolAvail>0&&!gameState.showingShop){
            var cost=getCardConfig('refreshCost',SHOP_REFRESH_COST);
            if(gameState.gold>=cost+30&&!gameState.showingShop&&refreshCardShop()){
                if(gameState.shopCards&&gameState.shopCards.length>0){
                    var cards=gameState.shopCards;
                    // 没移动优先拿 move 卡
                    if(!gameState.hasMove){
                        for(var ci=0;ci<cards.length;ci++){if(cards[ci].type==='move'){buyCard(ci);ci=-1;break;}}
                        if(ci!==-1) buyCard(0); // 没move卡就买第一张
                    }else{
                        // 没闪避优先拿 dodge
                        if(!gameState.hasDash){
                            for(var ci=0;ci<cards.length;ci++){if(cards[ci].type==='dodge'){buyCard(ci);ci=-1;break;}}
                            if(ci!==-1) buyCard(0);
                        }else{
                            var priorities={shield:0,vamp:1,armor:2,range:3,atk:4,speed:5,crit:6,dodge:7};
                            var bestIdx=0,bestPrio=999;
                            for(var ci=0;ci<cards.length;ci++){var pp=priorities[cards[ci].type];if(pp===undefined)pp=10;if(pp<bestPrio){bestPrio=pp;bestIdx=ci;}}
                            buyCard(bestIdx);
                        }
                    }
                } else { closeShop(); }
                gameState._nextAIopTime=now+500+Math.random()*1500;
            }
        }
        // 自动开宝箱
        if(typeof chestCount!=='undefined'&&chestCount>0){
            var chestOverlay=document.getElementById('chestCard-overlay');
            if(chestOverlay){
                if(chestOverlay.style.display==='flex'){
                    var firstCard=chestOverlay.querySelector('.chestCard-item');
                    if(firstCard&&typeof firstCard.onclick==='function') firstCard.onclick();
                } else { openChestCard(); }
                gameState._nextAIopTime=now+200+Math.random()*600;
            }
        }
    }

    // 4. 无怪物 → 停止（优先用威胁目标存活）
    var hasThreat=nearestThreat&&nearestThreat.hp>0;
    if(!hasThreat){p.isMoving=false;gameState.currentPath=[];return;}
    // 若只有塔怪活着，用nearestThreat替代nearest用于方向计算
    if(!nearest){nearest=nearestThreat;minDist=threatDist;}

    var dx=nearest.x-p.x,dy=nearest.y-p.y;
    var rawAngle=Math.atan2(dy,dx);

    // 取最近威胁（含塔怪）的方向用于闪现
    var threatDx=nearestThreat.x-p.x,threatDy=nearestThreat.y-p.y;
    var threatAngle=Math.atan2(threatDy,threatDx);

    // 5. 紧急闪现：任何怪物贴身（<30px）立刻闪离，包括塔怪
    if(threatDist<30&&canDash()){
        var pos=findDashSafeSpot(p.x,p.y,threatAngle+Math.PI);
        if(performDash(p.x,p.y,pos.x,pos.y)){p.x=pos.x;p.y=pos.y;}
        gameState.aiCooldown=now+800;
        gameState._aiMoveAngle=Math.atan2(pos.y-p.y,pos.x-p.x);
        gameState._aiLastMode='mergency';
        return;
    }
    // 被怪打到才闪（含塔怪），间隔≥0.8s
    if(gameState.aiNeedEvade&&canDash()){
        gameState.aiNeedEvade=false;
        var pos=findDashSafeSpot(p.x,p.y,threatAngle+Math.PI);
        if(performDash(p.x,p.y,pos.x,pos.y)){p.x=pos.x;p.y=pos.y;}
        gameState.aiCooldown=now+800;
        gameState._aiMoveAngle=Math.atan2(pos.y-p.y,pos.x-p.x);
        gameState._aiLastMode='dodge';
        return;
    }
    gameState.aiNeedEvade=false;

    // 6. 还没解锁移动 → 站着打，等抽卡
    if(!gameState.hasMove){p.isMoving=false;return;}

    // ===== 移动决策（带模式锁定+迟滞，防止抖动）=====
    if(now<gameState.aiCooldown) return;

    var spd=CONFIG.PLAYER_SPEED+(p.extraSpd||0);

    // 墙壁回避：靠近边缘(<60px)时强行推离
    var wallUrgency=0;
    var wallPushX=0,wallPushY=0;
    var wl=60,wp=1;
    if(p.x<wl*1){wallPushX+=(wl-p.x)/wl*3;wallUrgency=1;}
    if(p.x>MAP_W-wl*1){wallPushX-=(p.x-(MAP_W-wl))/wl*3;wallUrgency=1;}
    if(p.y<wl*1){wallPushY+=(wl-p.y)/wl*3;wallUrgency=1;}
    if(p.y>MAP_H-wl*1){wallPushY-=(p.y-(MAP_H-wl))/wl*3;wallUrgency=1;}

    var targetAngle;
    if(wallUrgency){
        // 贴墙时：强制朝地图中心移动
        var toCenter=Math.atan2(MAP_H/2-p.y, MAP_W/2-p.x);
        var wallAngle=Math.atan2(wallPushY,wallPushX);
        targetAngle=wallAngle*0.7+toCenter*0.3;
        gameState._aiMoveMode='wall';
    }else if(threatDist<safeDist&&nearestThreat._isTowerMonster){
        // 塔怪近身时后退
        targetAngle=threatAngle+Math.PI;
        gameState._aiMoveMode='towerbk';
    }else if(minDist>idealDist+30){
        // 太远 → 靠近怪物
        targetAngle=rawAngle;
        gameState._aiMoveMode='approach';
    }else if(minDist<safeDist){
        // 太近 → 后退
        // 逃生方向每10帧重算一次防抖动
        if(!gameState._aiEscapeFrame||gameState._aiEscapeFrame%10===0){
            var angleCounts={};
            for(var mi=0;mi<gameState.monsters.length;mi++){
                var m=gameState.monsters[mi]; if(!m||m.hp<=0) continue;
                var seg=Math.round(Math.atan2(m.y-p.y,m.x-p.x)/(Math.PI/4));
                angleCounts[seg]=(angleCounts[seg]||0)+1;
            }
            var bestEscape=0,minCount=999;
            for(var seg=-4;seg<=3;seg++){
                var c=(angleCounts[seg]||0)+(angleCounts[seg+1]||0)+(angleCounts[seg-1]||0);
                if(c<minCount){minCount=c;bestEscape=seg;}
            }
            gameState._aiEscapeAngle=bestEscape*Math.PI/4;
        }
        gameState._aiEscapeFrame=((gameState._aiEscapeFrame||0)+1)%20;
        // 如果已退到攻击范围边缘，停止移动站着打
        if(minDist>=attackRange-20){
            p.isMoving=false;
            gameState._aiMoveMode='attackedge';
            return;
        }else{
            var ba=rawAngle+Math.PI;
            targetAngle=ba*0.5+gameState._aiEscapeAngle*0.5;
            gameState._aiMoveMode='retreat';
        }
    }else{
        // 甜区：停止移动，站着打，不要每帧微调位置
        p.isMoving=false;
        gameState._aiMoveMode='sweet';
        return;
    }

    // 角度惯性平滑
    if(gameState._aiMoveAngle===undefined){
        gameState._aiMoveAngle=targetAngle;
    }else{
        var diff=targetAngle-gameState._aiMoveAngle;
        while(diff>Math.PI) diff-=Math.PI*2;
        while(diff<-Math.PI) diff+=Math.PI*2;
        gameState._aiMoveAngle+=diff*0.65;
    }

    // 沿平滑方向移动 — 卡住时强制找出口
    var nx=p.x+Math.cos(gameState._aiMoveAngle)*spd;
    var ny=p.y+Math.sin(gameState._aiMoveAngle)*spd;
    if(canMoveTo(nx,ny)){p.x=nx;p.y=ny;p.isMoving=true;gameState._aiStuckFrames=0;}
    else{
        // 卡住了！尝试逐步旋转角度直到找到可移动方向（含塔怪，宽角度）
        var found=false;
        for(var tryAngle=0;tryAngle<8;tryAngle++){
            var sign=tryAngle%2===0?1:-1;
            var a=gameState._aiMoveAngle+sign*(Math.floor(tryAngle/2)+1)*0.4;
            var tx=p.x+Math.cos(a)*spd, ty=p.y+Math.sin(a)*spd;
            if(canMoveTo(tx,ty)){p.x=tx;p.y=ty;p.isMoving=true;gameState._aiMoveAngle=a;found=true;break;}
        }
        if(!found){
            // 彻底卡死 → 强制朝地图中心大步走（跳过墙壁检测）
            p.isMoving=false;
            var centerAngle=Math.atan2(MAP_H/2-p.y,MAP_W/2-p.x);
            var cx=p.x+Math.cos(centerAngle)*(spd*3);
            var cy=p.y+Math.sin(centerAngle)*(spd*3);
            // 直接设坐标（强制出墙）
            p.x=Math.max(40,Math.min(MAP_W-40,cx));
            p.y=Math.max(40,Math.min(MAP_H-40,cy));
            gameState._aiMoveAngle=centerAngle;
            gameState._aiStuckFrames=(gameState._aiStuckFrames||0)+1;
            // 实在不行跳到地图中心
            if(gameState._aiStuckFrames>30){
                p.x=MAP_W/2;p.y=MAP_H/2;
                gameState._aiStuckFrames=0;
            }
        }
    }
}




