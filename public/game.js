/**
 * 不完美作战 v4.2.2-codex-beta
 * A*寻路 + 矢量自由移动 + 战斗系统 + 波次 + 爬塔 + 音效 + 粒子 + 宝箱 + 羁绊 + 修仙剑仙
 * v4.2.2 功能：角色选择、难度10档、修仙剑仙体系
 * 适用于微信/抖音直接打开游玩
 */

// ==================== 核心配置 ====================
const CONFIG = {
    VERSION: 'v4.3.1',
    GRID_COLS: 18, GRID_ROWS: 32, GRID_SIZE: 40,
    BASE_WIDTH: 360, BASE_HEIGHT: 640,
    PLAYER_SIZE: 28,
    PLAYER_SPEED: 1,
    DASH_DISTANCE: 150, DASH_COST: 30,
    MP_REGEN_RATE: 5, MP_REGEN_INTERVAL: 200,
    MAX_HP: 150, MAX_MP: 100,
    DOUBLE_CLICK_TIME: 400, DOUBLE_CLICK_DISTANCE: 40,
    // 战斗系统
    ATTACK_RANGE: 80,
    ATTACK_DAMAGE_MIN: 15, ATTACK_DAMAGE_MAX: 25,
    ATTACK_COOLDOWN: 400,
    MONSTER_CONTACT_DAMAGE: 8,
    MONSTER_CONTACT_INTERVAL: 600,
    // 波次系统
    WAVE_DURATION: 25,
    WAVE_MONSTERS_BASE: 3,
    WAVE_MONSTERS_PER_WAVE: 2,
    WAVE_HP_MULTIPLIER: 1.15, WAVE_SPEED_MULTIPLIER: 1.05,
    // 升级系统
    HP_RESTORE_PER_WAVE: 30, MP_RESTORE_PER_WAVE: 50,
    // 卡牌系统
    CARD_SELECT_COUNT: 3,
    // 颜色
    WALL_COLOR: '#3d3d5c', PLAYER_COLOR: '#00d4ff',
    PLAYER_DASH_COLOR: '#ff69b4', HP_COLOR: '#ff4757',
    MP_COLOR: '#5352ed', BG_COLOR: '#1a1a2e',
    PATH_LINE_COLOR: 'rgba(0, 212, 255, 0.25)',
    MONSTER_COLORS: ['#ff6348','#ffa502','#ff4757','#e056fd','#7bed9f'],
};

const MAP_W=CONFIG.GRID_COLS*CONFIG.GRID_SIZE, MAP_H=CONFIG.GRID_ROWS*CONFIG.GRID_SIZE;

// 屏幕居中文本（跟随镜头）
function screenText(text, color, duration, yOff){
    var cx=gameState.camera.x+canvas.width/2, cy=gameState.camera.y+canvas.height/2+(yOff||0);
    gameState.floatingTexts.push(new FloatingText(cx,cy,text,color,duration));
}

// ==================== 游戏配置（数据驱动）====================
// 默认配置 - 当 data.gameConfig 不存在时使用
const DEFAULT_GAME_CONFIG = {
    hero: {
        maxHp: 300, maxMp: 999, mpRegen: 5, mpRegenInterval: 200,
        walkSpeed: 1, dashDistance: 150, dashMpCost: 30,
        attackMin: 15, attackMax: 25, attackRange: 160, attackCooldown: 600,
        projectileSpeed: 800, projectileSize: 8, projectileColor: '#ffdd59',
        initialGold: 400, hpRestorePerWave: 30, mpRestorePerWave: 50,
        defense: 3, contactDamage: 8, contactInterval: 600
    },
    monsters: {
        types: {
            dog:  { name:'小狗', hp:50, speedRatio:0.5, damage:8,  size:25, color:'#ff6348', score:100 },
            wolf: { name:'狼',  hp:80, speedRatio:0.65, damage:12, size:28, color:'#ffa502', score:150 },
            tank: { name:'重甲', hp:150,speedRatio:0.3, damage:18, size:34, color:'#a855f7', score:200 },
            fast: { name:'刺客', hp:35, speedRatio:0.8, damage:10,  size:22, color:'#ff4757', score:120 }
        },
        waveDuration: 25,
        spawnCount: 1,
        defaultScore: 100
    },
    waves: [
        { monsters: { dog: 4 } },
        { monsters: { dog: 3, wolf: 2 } },
        { monsters: { dog: 2, wolf: 2, tank: 1 } },
        { monsters: { wolf: 2, tank: 2, fast: 2 } },
        { monsters: { tank: 2, fast: 3, wolf: 2 } }
    ],
    cards: {
        refreshCost: 30, cardsPerRefresh: 4, maxSkillBar: 8, synergyThreshold: 2,
        synergies: {
            warrior:  { name:'狂战士', icon:'😤', color:'#ff6b4a', desc:'攻击力提高',      apply:['extraAtk',8] },
            assassin: { name:'刺客',   icon:'🗡️', color:'#a855f7', desc:'攻击速度提高',    apply:['extraAtkSpd',0.25] },
            mage:     { name:'法师',   icon:'🔮', color:'#3b82f6', desc:'射程提高',        apply:['extraRange',30] },
            ice:      { name:'冰霜',   icon:'❄️', color:'#06b6d4', desc:'攻击冰冻减速',    apply:['iceCount',1] }
        }
    }
};
// 4种羁绊类型，每类有3张不同的卡
// 函数形式的CARD_TYPES，兼容从配置加载
let CARD_TYPES = {
    warrior: { name:'狂战士', icon:'😤', color:'#ff6b4a', border:'#ff6b4a', desc:'攻击力提高', threshold:2,
               apply:(p)=>{ p.extraAtk=(p.extraAtk||0)+8; } },
    assassin: { name:'刺客', icon:'🗡️', color:'#a855f7', border:'#a855f7', desc:'攻击速度提高', threshold:2,
                apply:(p)=>{ p.extraAtkSpd=(p.extraAtkSpd||0)+0.25; } },
    mage: { name:'法师', icon:'🔮', color:'#3b82f6', border:'#3b82f6', desc:'射程+30', threshold:2,
            apply:(p)=>{ p.extraRange=(p.extraRange||0)+30; } },
    ice: { name:'冰霜', icon:'❄️', color:'#06b6d4', border:'#06b6d4', desc:'攻击冰冻减速', threshold:2,
           apply:(p)=>{ p.iceCount=(p.iceCount||0)+1; } },
    move: { name:'疾行', icon:'👟', color:'#ffdd59', border:'#ffdd59', desc:'解锁移动能力', threshold:2,
            apply:(p)=>{ p.extraSpd=(p.extraSpd||0)+Math.round(CONFIG.PLAYER_SPEED*0.2*10)/10; } },
    dodge: { name:'闪避', icon:'💨', color:'#2ed573', border:'#2ed573', desc:'解锁闪现能力', threshold:2,
             apply:(p)=>{ p.extraAtkSpd=(p.extraAtkSpd||0)+0.1; } },
};
const CARD_TYPE_KEYS = Object.keys(CARD_TYPES);
// 每类3张具体卡片
const CARD_POOL = [
    { type:'warrior', name:'狂怒', icon:'😤' }, { type:'warrior', name:'斩杀', icon:'⚔️' }, { type:'warrior', name:'战吼', icon:'📯' },
    { type:'assassin', name:'背刺', icon:'🗡️' }, { type:'assassin', name:'暗影步', icon:'🌑' }, { type:'assassin', name:'毒刃', icon:'💚' },
    { type:'mage', name:'火球', icon:'🔥' }, { type:'mage', name:'奥术飞弹', icon:'✨' }, { type:'mage', name:'魔法盾', icon:'🛡️' },
    { type:'ice', name:'冰箭', icon:'❄️' }, { type:'ice', name:'冰霜新星', icon:'🧊' }, { type:'ice', name:'寒冰护甲', icon:'💠' },
    { type:'move', name:'冲刺', icon:'💨' }, { type:'move', name:'疾风步', icon:'🌪️' }, { type:'move', name:'神行', icon:'⚡' },
    { type:'dodge', name:'闪避', icon:'🌀' }, { type:'dodge', name:'幻影步', icon:'👻' }, { type:'dodge', name:'瞬移', icon:'✨' },
];
// 羁绊激活阈值（2张同类型触发）
const SYNERGY_THRESHOLD = 3;
const MAX_SKILL_BAR = 8;
const SHOP_REFRESH_COST = 30;  // 刷新卡牌花费
const SHOP_CARD_COUNT = 4;     // 同时展示4张卡

// ==================== 修仙系统（剑仙分支）====================
const CULTIVATION_CARDS = {
    starter: { name:'修仙引子', icon:'☯️', type:'cult_starter', branch:null, desc:'踏入修仙之路', cultivationValue:5 },
    subStarter: { name:'剑仙子引子', icon:'⚔️', type:'cult_sub_starter', branch:'sword', desc:'剑仙一脉的启迪', cultivationValue:10 },
    blue: [
        { name:'充能效率', icon:'⚡', type:'cult_sword_blue', branch:'sword', rarity:'blue', desc:'学习次数获得概率+20%', cultivationValue:12, apply:(p)=>{ p._studyBoost=(p._studyBoost||0)+0.2; } },
        { name:'剑光感应', icon:'✨', type:'cult_sword_blue', branch:'sword', rarity:'blue', desc:'剑光触发概率+15%', cultivationValue:12, apply:(p)=>{ p._swordChance=(p._swordChance||0)+0.15; } },
        { name:'剑意流转', icon:'🌊', type:'cult_sword_blue', branch:'sword', rarity:'blue', desc:'攻击频率+12%', cultivationValue:10, apply:(p)=>{ p.extraAtkSpd=(p.extraAtkSpd||0)+0.12; } },
        { name:'灵剑护体', icon:'🛡️', type:'cult_sword_blue', branch:'sword', rarity:'blue', desc:'防御+3', cultivationValue:10, apply:(p)=>{ p.shield=(p.shield||0)+3; } },
        { name:'剑气纵横', icon:'💫', type:'cult_sword_blue', branch:'sword', rarity:'blue', desc:'攻击范围+20', cultivationValue:11, apply:(p)=>{ p.extraRange=(p.extraRange||0)+20; } },
        { name:'剑心通明', icon:'🧠', type:'cult_sword_blue', branch:'sword', rarity:'blue', desc:'暴击率+5%', cultivationValue:13, apply:(p)=>{ p.critChance=(p.critChance||0)+0.05; } },
    ],
    gold: [
        { name:'破空斩', icon:'🗡️', type:'cult_sword_gold', branch:'sword', rarity:'gold', desc:'1道剑光', cultivationValue:20, apply:(p)=>{ p._swordDmg=(p._swordDmg||0)+15; } },
        { name:'剑雨', icon:'🌧️', type:'cult_sword_gold', branch:'sword', rarity:'gold', desc:'1道剑光', cultivationValue:22, apply:(p)=>{ p._swordDmg=(p._swordDmg||0)+18; } },
        { name:'万剑诀', icon:'🔱', type:'cult_sword_gold', branch:'sword', rarity:'gold', desc:'1道剑光', cultivationValue:25, apply:(p)=>{ p._swordDmg=(p._swordDmg||0)+22; } },
    ]
};
const MAX_CULTIVATION_VALUE = 160;
const CULTIVATION_BRANCHES = { sword: { name:'剑仙', icon:'⚔️', color:'#ffd700' } };

function getCardConfig(key, fallback){
    let cfg = gameState.config || DEFAULT_GAME_CONFIG;
    let cc = cfg.cards || {};
    return cc[key] !== undefined ? cc[key] : fallback;
}
function getRandomCards(count){
    let pool = gameState.availableCards || CARD_POOL;
    if(!gameState.availableCards){
        gameState.availableCards = pool.map(c=>({...c}));
        pool = gameState.availableCards;
    }
    // 没凑齐移动+闪避前只出这两类卡
    if(!gameState.hasMove || !gameState.hasDash){
        let filtered = pool.filter(c => c.type==='move' || c.type==='dodge');
        if(filtered.length>0) pool = filtered;
    }
    let shuffled = [...pool].sort(()=>Math.random()-0.5);
    let cards = shuffled.slice(0, Math.min(count, shuffled.length));
    // 修仙卡：必须移动+闪避都解锁后才出
    if(gameState.cultivation && currentHero==='xian' && gameState.hasMove && gameState.hasDash){
        var cult = gameState.cultivation;
        var cultPool = [];
        // L1 引子只在stage<1时出
        if(cult.stage < 1){
            cultPool.push({...CULTIVATION_CARDS.starter, _cult:true});
        }
        // L2 子引子只在stage>=1且stage<2且未激活时出
        if(cult.stage >= 1 && cult.stage < 2 && !cult.subStarterActive){
            cultPool.push({...CULTIVATION_CARDS.subStarter, _cult:true});
        }
        // L3 蓝卡金卡在stage>=2时持续出
        if(cult.stage >= 2){
            if(!cult._collectedBlue) cult._collectedBlue = [];
            if(!cult._collectedGold) cult._collectedGold = [];
            for(var bc of CULTIVATION_CARDS.blue){
                if(!cult._collectedBlue.includes(bc.name)){
                    cultPool.push({...bc, _cult:true});
                }
            }
            for(var gc of CULTIVATION_CARDS.gold){
                if(!cult._collectedGold.includes(gc.name)){
                    cultPool.push({...gc, _cult:true});
                }
            }
        }
        // 混入修仙卡（替换最后一张普通卡）
        if(cultPool.length > 0 && cards.length > 0){
            var cultCard = cultPool[Math.floor(Math.random()*cultPool.length)];
            // 替换最后一张卡
            cards[cards.length-1] = cultCard;
            // 如果还有更多修仙卡，尝试再加一张（替换第2张）
            if(cultPool.length > 1 && cards.length >= 2){
                var cultCard2 = null;
                for(var c2 of cultPool){ if(c2.name !== cultCard.name){ cultCard2 = c2; break; } }
                if(cultCard2) cards[cards.length-2] = cultCard2;
            }
        }
    }
    return cards;
}

// 检查羁绊（技能栏中同类型≥2张则触发）
function checkSynergy(){
    let sb = gameState.skillBar || [];
    let counts = {};
    for(let card of sb){
        if(card && card.type) counts[card.type] = (counts[card.type]||0) + 1;
    }
    let triggered = false;
    for(let [type, count] of Object.entries(counts)){
        let cfg = CARD_TYPES[type];
        if(!cfg) continue;
        let need = cfg.threshold || getCardConfig('synergyThreshold', SYNERGY_THRESHOLD);
        if(count >= need){
            // 回收同类型所有卡，并记录位置做飞入特效
            let cardPositions = [];
            for(let i=sb.length-1; i>=0; i--){
                if(sb[i] && sb[i].type === type){
                    let sx=(canvas.width-((30+4)*8-4))/2+i*(30+4)+19;
                    cardPositions.push({x:sx,y:canvas.height-76});
                    sb.splice(i,1);
                }
            }
            if(!gameState.synergyActivated) gameState.synergyActivated={};
            gameState.synergyActivated[type]=true;
            if(type==='move') gameState.hasMove=true;
            if(type==='dodge') gameState.hasDash=true;
            if(gameState.player){
                cfg.apply(gameState.player);
                gameState.synergyLog = gameState.synergyLog || [];
                gameState.synergyLog.push(type);
                triggered = true;
                screenText('🔗 '+cfg.name+'羁绊激活! '+cfg.desc, cfg.color, 1800, -20);
                // 羁绊图标飞入右上角图鉴特效
                let _blTx=canvas.width-32, _blTy=101;
                for(let cp of cardPositions){
                    for(var _f=0;_f<6;_f++){
                        let flyP = {
                            x:cp.x-8+Math.random()*16, y:cp.y-8+Math.random()*16,
                            tx:_blTx+Math.random()*16-8, ty:_blTy+Math.random()*8-4,
                            icon:cfg.icon, life:600, maxLife:600,
                            color:cfg.color, size:10+Math.random()*4,
                            alive:true,
                            update:function(dt){
                                var spd=dt;
                                var adx=this.tx-this.x, ady=this.ty-this.y, ad=Math.sqrt(adx*adx+ady*ady);
                                if(ad<2){this.life=0;this.alive=false;return;}
                                this.x+=adx/ad*spd; this.y+=ady/ad*spd;
                                this.life-=dt; if(this.life<=0) this.alive=false;
                            },
                            draw:function(ctx2){
                                var a=Math.min(1,this.life/this.maxLife*2);
                                ctx2.save(); ctx2.globalAlpha=a;
                                ctx2.font=this.size+'px Arial'; ctx2.textAlign='center'; ctx2.textBaseline='middle';
                                ctx2.shadowColor=this.color; ctx2.shadowBlur=8;
                                ctx2.fillText(cfg.icon, this.x, this.y);
                                ctx2.restore();
                            }
                        };
                        gameState.particles.push(flyP);
                    }
                }
                for(var _i=0;_i<15;_i++){
                    gameState.particles.push(new Particle(gameState.camera.x+canvas.width/2, gameState.camera.y+canvas.height/2, cfg.color, 600, 3, 4));
                }
            }
        }
    }
    if(triggered) checkSynergy();
    return triggered;
}

// 刷新卡牌商店
function refreshCardShop(){
    let cost = getCardConfig('refreshCost', SHOP_REFRESH_COST);
    if(gameState.gold < cost) return false;
    gameState.gold -= cost;
    gameState.shopCards = getRandomCards(getCardConfig('cardsPerRefresh', SHOP_CARD_COUNT));
    gameState.showingShop = true;
    updateHUD();
    return true;
}

// 购买某张卡牌
function buyCard(index){
    let cards = gameState.shopCards || [];
    let maxBar = getCardConfig('maxSkillBar', MAX_SKILL_BAR);
    if(index < 0 || index >= cards.length) return false;
    if(!gameState.player) return false;
    let card = cards[index];
    if(!card) return false;

    initAudio(); playSound(400,'triangle',0.12,0.15,300);

    // === 修仙卡特殊处理 ===
    if(card._cult){
        let cult = gameState.cultivation;
        if(!cult) return false;

        // L1: 修仙引子 → 立刻自动回收，解锁子引子池
        if(card.type === 'cult_starter'){
            cult.cultivationValue = Math.min(MAX_CULTIVATION_VALUE, (cult.cultivationValue||0) + (card.cultivationValue||5));
            cult.stage = 1;
            // 从商店移除
            cards.splice(index, 1);
            gameState.shopCards = cards;
            hideCardShopUI();
            screenText('☯️ 修仙引子已融入 ! 解锁剑仙子引子', '#ffd700', 1500);
            updateHUD();
            return true;
        }

        // L2: 剑仙子引子 → 放入技能栏，启动10秒倒计时
        if(card.type === 'cult_sub_starter'){
            // 检查技能栏是否已满
            if((gameState.skillBar||[]).length >= maxBar){
                screenText('⚠️ 技能栏已满!', '#ff4757', 1000);
                return false;
            }
            gameState.skillBar = gameState.skillBar || [];
            card._cultTimer = 10000; // 10秒倒计时
            card._cultActive = true;
            gameState.skillBar.push({...card});
            cult.subStarterActive = true;
            cult.subStarterTimer = 10000;
            // 从商店移除
            cards.splice(index, 1);
            gameState.shopCards = cards;
            hideCardShopUI();
            screenText('⚔️ 剑仙子引子已放入技能栏 (10秒后觉醒)', '#ffd700', 1500);
            updateHUD();
            return true;
        }

        // L3: 蓝卡/金卡 → 放入技能栏，不会自动回收
        if(card.type === 'cult_sword_blue' || card.type === 'cult_sword_gold'){
            // 检查技能栏是否已满 → 满了强制替换最后一格
            if((gameState.skillBar||[]).length >= maxBar){
                // 顶掉最后一个非修仙卡（修仙卡不自动回收，不能顶修仙卡）
                let replaced = false;
                let sb = gameState.skillBar;
                for(let i=sb.length-1; i>=0; i--){
                    if(sb[i] && !sb[i]._cult && !sb[i]._cultTimer){
                        screenText('⚠️ '+sb[i].name+' 被顶替丢失!', '#ff4757', 1000);
                        sb.splice(i,1);
                        replaced = true;
                        break;
                    }
                }
                if(!replaced){
                    screenText('⚠️ 技能栏已满!', '#ff4757', 1000);
                    return false;
                }
            }
            gameState.skillBar = gameState.skillBar || [];
            card._isCultL3 = true; // 标记为L3卡，不会自动回收
            gameState.skillBar.push({...card});
            // 从商店移除
            cards.splice(index, 1);
            gameState.shopCards = cards;
            hideCardShopUI();
            screenText('✅ '+card.name+' 已收入技能栏 (需手动学习)', '#ffd700', 1000);
            updateHUD();
            return true;
        }
    }

    // === 普通卡 ===
    // 检查技能栏是否已满
    if((gameState.skillBar||[]).length >= maxBar){
        screenText('⚠️ 技能栏已满!', '#ff4757', 1000);
        return false;
    }
    initAudio(); playSound(400,'triangle',0.12,0.15,300);

    // 加入技能栏
    gameState.skillBar = gameState.skillBar || [];
    gameState.skillBar.push({...card});

    // 从商店移除该卡
    cards.splice(index, 1);
    gameState.shopCards = cards;

    // 从可用卡池移除
    if(gameState.availableCards){
        gameState.availableCards = gameState.availableCards.filter(function(ac){ return ac.name!==card.name; });
    }

    // 检查羁绊
    checkSynergy();

    // 卡池抽空后清理技能栏中多余普通卡
    var pool = gameState.availableCards || [];
    if(pool.length===0 && (gameState.skillBar||[]).length>0){
        var newSB = gameState.skillBar.filter(function(c){ return c._cult || c._isCultL3; });
        // 对已激活羁绊的卡也清除（因为触发的瞬间已经回收了所有同类型卡）
        gameState.skillBar = newSB;
    }

    updateHUD();
    // 4选1：选完即关闭商店
    hideCardShopUI();
    screenText('✅ '+card.name+' 已收入技能栏', '#2ed573', 1000);
    return true;
}

// 关闭商店
function closeShop(){
    gameState.showingShop = false;
    gameState.shopCards = [];
}

// ==================== 难度倍率系统 ====================
const DIFFICULTY_MULTIPLIERS = {
    n1:{name:'难1',monsterHp:0.5,spawnInterval:1.5,monsterSpeed:0.6},
    n2:{name:'难2',monsterHp:0.6,spawnInterval:1.4,monsterSpeed:0.7},
    n3:{name:'难3',monsterHp:0.75,spawnInterval:1.2,monsterSpeed:0.8},
    n4:{name:'难4',monsterHp:0.9,spawnInterval:1.1,monsterSpeed:0.9},
    n5:{name:'难5',monsterHp:1.0,spawnInterval:1.0,monsterSpeed:1.0},
    n6:{name:'难6',monsterHp:1.2,spawnInterval:0.9,monsterSpeed:1.1},
    n7:{name:'难7',monsterHp:1.5,spawnInterval:0.75,monsterSpeed:1.2},
    n8:{name:'难8',monsterHp:1.8,spawnInterval:0.6,monsterSpeed:1.3},
    n9:{name:'难9',monsterHp:2.2,spawnInterval:0.5,monsterSpeed:1.4},
    n10:{name:'难10',monsterHp:2.5,spawnInterval:0.4,monsterSpeed:1.5},
};
let currentDifficulty = 'n1';
let runtimeMultipliers = { ...DIFFICULTY_MULTIPLIERS.n1 };
let currentHero = null;

// ==================== 角色系统 ====================
const HERO_CLASSES = {
    xian: {
        name:'修仙大仙', icon:'🧙', desc:'远程法系 · 飞剑追击',
        color:'#00d4ff',
        stats:{
            maxHp:250, maxMp:200, mpRegen:4, mpRegenInterval:200,
            walkSpeed:1, dashDistance:150, dashMpCost:30,
            attackMin:12, attackMax:20, attackRange:190, attackCooldown:550,
            projectileSpeed:900, projectileSize:9, projectileColor:'#00d4ff',
            initialGold:400, hpRestorePerWave:30, mpRestorePerWave:60,
            defense:2, contactDamage:8, contactInterval:600
        },
        bonus:'飞剑追击: 攻击有30%概率额外射出一枚自动追踪飞剑'
    },
    ninja: {
        name:'忍术忍者', icon:'🗡️', desc:'近战刺客 · 闪现强化',
        color:'#ff4757',
        stats:{
            maxHp:200, maxMp:120, mpRegen:5, mpRegenInterval:200,
            walkSpeed:1.2, dashDistance:200, dashMpCost:25,
            attackMin:18, attackMax:28, attackRange:140, attackCooldown:500,
            projectileSpeed:1000, projectileSize:7, projectileColor:'#ff4757',
            initialGold:400, hpRestorePerWave:25, mpRestorePerWave:40,
            defense:1, contactDamage:10, contactInterval:500
        },
        bonus:'忍术精通: 基础暴击+15% · 闪现距离更远·消耗更低'
    },
    psyker: {
        name:'超能力者', icon:'🔮', desc:'念力控场 · 大范围',
        color:'#a855f7',
        stats:{
            maxHp:220, maxMp:250, mpRegen:6, mpRegenInterval:150,
            walkSpeed:0.9, dashDistance:130, dashMpCost:35,
            attackMin:10, attackMax:16, attackRange:220, attackCooldown:650,
            projectileSpeed:700, projectileSize:11, projectileColor:'#a855f7',
            initialGold:400, hpRestorePerWave:35, mpRestorePerWave:70,
            defense:3, contactDamage:7, contactInterval:600
        },
        bonus:'念力风暴: 攻击扩散·MP回复更快·攻击范围最远'
    }
};

// ==================== 音效引擎 (Web Audio API) ====================
let audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
}
function playSound(freq, type, duration, vol = 0.15, slide = 0) {
    if (!audioCtx || !window._soundEnabled) return;
    try { if (audioCtx.state === 'suspended') audioCtx.resume(); } catch(e) {}
    try {
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, t);
        if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, t + duration);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(t); osc.stop(t + duration);
    } catch(e) {}
}
window._soundEnabled = true;
const SFX = {
    attack: ()=>playSound(400,'square',0.1,0.12,-200),
    hit:    ()=>playSound(200,'sawtooth',0.12,0.06),
    kill:   ()=>playSound(600,'square',0.08,0.15,-400),
    dash:   ()=>playSound(800,'sine',0.15,0.1,-500),
    hurt:   ()=>playSound(120,'sawtooth',0.2,0.08),
    wave:   ()=>playSound(500,'triangle',0.15,0.2,300),
    gameover:()=>{ playSound(300,'sawtooth',0.3,0.3,-200); setTimeout(()=>playSound(150,'sawtooth',0.3,0.5,-100),300); },
    chestOpen:()=>{ playSound(600,'sine',0.15,0.1,400); setTimeout(()=>playSound(800,'sine',0.15,0.12,600),150); },
    chestDrop:()=>{ playSound(400,'triangle',0.12,0.08); setTimeout(()=>playSound(600,'triangle',0.12,0.1),200); },
};

// ==================== 宝箱增益卡池 ====================
const CHEST_CARDS = [
    { name:'生命上限', icon:'❤️', desc:'生命上限 +20', apply:function(p){ p.maxHp+=20; p.hp=Math.min(p.hp+20,p.maxHp); } },
    { name:'攻击力', icon:'⚔️', desc:'攻击力 +3', apply:function(p){ p.minDmg=(p.minDmg||15)+3; p.maxDmg=(p.maxDmg||25)+3; } },
    { name:'移动速度', icon:'💨', desc:'速度 +0.3', apply:function(p){ p.speed=(p.speed||4)+0.3; } },
    { name:'魔力上限', icon:'💎', desc:'魔力上限 +20', apply:function(p){ p.maxMp+=20; p.mp=Math.min(p.mp+20,p.maxMp); } },
    { name:'攻击范围', icon:'🎯', desc:'攻击范围 +15', apply:function(p){ p.attackRange=(p.attackRange||80)+15; } },
    { name:'生命恢复', icon:'🩹', desc:'每秒恢复 +1 HP', apply:function(p){ p.hpRegen=(p.hpRegen||0)+1; } },
    { name:'暴击率', icon:'💥', desc:'暴击率 +3%', apply:function(p){ p.critRate=(p.critRate||0)+0.03; } },
    { name:'防御', icon:'🛡️', desc:'伤害减免 +3%', apply:function(p){ p.dmgReduction=(p.dmgReduction||0)+0.03; } },
    { name:'魔力恢复', icon:'🔮', desc:'魔回 +2/秒', apply:function(p){ p.mpRegen=(p.mpRegen||5)+2; p._mpRegenBonus=(p._mpRegenBonus||0)+2; } },
];
var chestCount = 0;
function chestLoadCount(){
    try{ var d=localStorage.getItem('imp_chest_count'); if(d) chestCount=parseInt(d)||0; else chestCount=0; }catch(e){ chestCount=0; }
}
function chestSaveCount(){
    try{ localStorage.setItem('imp_chest_count', chestCount.toString()); }catch(e){}
}
chestLoadCount();

// ==================== Boss & 精英 & 装备系统 ====================
const MAX_WAVES = 99; // 总波数（无尽模式，波5/10/15/20...出Boss）
const BOSS_TYPES = {
    1: { name:'山贼头目', icon:'👹', hp:500, speedRatio:0.4, damage:20, size:70, color:'#ff6b4a', score:800,
         desc:'挥舞巨斧的头领', goldReward:200, itemDrop:'铁甲' },
    2: { name:'暗影刺客', icon:'🗡️', hp:700, speedRatio:0.7, damage:28, size:65, color:'#a855f7', score:1200,
         desc:'来无影去无踪', goldReward:300, itemDrop:'匕首' },
    3: { name:'铁甲将军', icon:'🛡️', hp:1000, speedRatio:0.35, damage:35, size:80, color:'#475569', score:1800,
         desc:'身披重铠的统帅', goldReward:400, itemDrop:'护盾' },
    4: { name:'冰霜女巫', icon:'❄️', hp:1400, speedRatio:0.55, damage:30, size:72, color:'#06b6d4', score:2500,
         desc:'操控极寒之力的女巫', goldReward:500, itemDrop:'冰晶' },
    5: { name:'不灭魔王', icon:'😈', hp:2500, speedRatio:0.6, damage:45, size:90, color:'#dc2626', score:5000,
         desc:'最终Boss·不灭的暗影之王', goldReward:1000, itemDrop:null }
};
const ELITE_TYPES = [
    { name:'精英战士', icon:'⚔️', hp:200, speedRatio:0.45, damage:15, size:32, color:'#ff9f43', score:300, gold:50 },
    { name:'精英射手', icon:'🏹', hp:150, speedRatio:0.6, damage:18, size:28, color:'#00cec9', score:350, gold:60 },
    { name:'精英巫师', icon:'🔮', hp:180, speedRatio:0.5, damage:22, size:30, color:'#a29bfe', score:400, gold:70 }
];
// Boss战斗时限（毫秒）
const BOSS_TIME_LIMIT = 30000;
// 动态Boss生成（无尽模式：波5/10/15/20...）
function getBossDef(wave){
    // 静态Boss（波1~5）
    if(wave <= 5) return BOSS_TYPES[wave] || null;
    // 每5波出一个Boss
    if(wave % 5 !== 0) return null;
    let cycles = Math.floor(wave / 5) - 1; // cycles=1 → 波10, cycles=2 → 波15
    let baseDef = BOSS_TYPES[5]; // 以不灭魔王为基准
    let scaleMul = Math.pow(1.5, cycles); // 每5波血量×1.5, 伤害×1.3
    let dmgScale = Math.pow(1.3, cycles);
    let bossNames = ['深渊守卫', '暗影领主', '混沌破坏者', '虚空吞噬者', '终焉之龙'];
    let bossIcons = ['🦍', '👾', '🐉', '👁️', '🔥'];
    let idx = cycles - 1;
    return {
        name: bossNames[idx % bossNames.length] + (cycles > 5 ? '·Lv'+cycles : ''),
        icon: bossIcons[idx % bossIcons.length],
        hp: Math.round(baseDef.hp * scaleMul),
        speedRatio: Math.min(baseDef.speedRatio * Math.pow(1.05, cycles), 1.0),
        damage: Math.round(baseDef.damage * dmgScale),
        size: Math.min(baseDef.size + cycles * 5, 130),
        color: cycles % 2 === 0 ? '#dc2626' : '#7c3aed',
        score: Math.round(baseDef.score * scaleMul),
        goldReward: Math.round(baseDef.goldReward * scaleMul),
        itemDrop: null
    };
}
// 装备道具（Boss掉落）
const EQUIPMENT_ITEMS = {
    '铁甲': { name:'铁甲', icon:'🦺', desc:'减伤+10%', apply:(p)=>p.dmgReduction=(p.dmgReduction||0)+0.1 },
    '匕首': { name:'匕首', icon:'🗡️', desc:'攻击+8', apply:(p)=>{ p.minDmg=(p.minDmg||15)+8; p.maxDmg=(p.maxDmg||25)+8; } },
    '护盾': { name:'护盾', icon:'🛡️', desc:'生命上限+60', apply:(p)=>{ p.maxHp+=60; p.hp=Math.min(p.hp+60,p.maxHp); } },
    '冰晶': { name:'冰晶', icon:'💎', desc:'冰冻+1.5s', apply:(p)=>p.iceBonus=(p.iceBonus||0)+1.5 },
};
// Boss阶段产出道具（存到equipSlots中）
let equipSlots = []; // 可装备道具列表
let groundItems = []; // 掉落在地上的道具（{x,y,item,lifeTimer}）
let eqSlotRegions = []; // 保存每帧道具栏各槽位区域用于点击检测
let showEqDetail = null; // 道具详情: {item, slotIdx} 或 null

// ==================== 游戏状态 ====================
let gameState = {
    player: null, grid: [], walls: [],
    camera: { x: 0, y: 0 }, levelName: '',
    lastTime: 0, lastMpRegen: 0,
    currentPath: [], currentPathIndex: 0,
    monsters: [], lastSpawnTime: 0, spawnInterval: 3000,
    // 新增：战斗/波次系统
    wave: 1, waveTimer: 0, waveTotalTime: 0, waveMonstersSpawned: 0,
    waveMonstersTarget: 0, isBetweenWaves: true, betweenWaveTimer: 0,
    score: 0, kills: 0, maxWave: 1,
    gold: 0,
    attackCooldown: 0, lastMonsterContact: {},
    particles: [], floatingTexts: [], projectiles: [],
    isGameOver: false, isPaused: false,
    gameStartTime: 0, totalPlayTime: 0,
    // 卡牌/羁绊系统
    hasMove: false, hasDash: false,
    skillBar: [], shopCards: [], showingShop: false,
    synergyLog: [],
    // Boss & 精英系统
    bossActive: false, bossTimer: 0, bossDefeated: {}, // bossDefeated记录已击败的波数
    eliteCount: 0, eliteSpawned: false, phase: 'normal', // normal→elite→boss
    // AI Bot 系统
    aiEnabled: false,
    aiMode: 'balanced', // balanced|kite|evade
    // 时间静止大招
    _timeFreeze: { active: false, timer: 0, duration: 6000, cooldown: 0, totalCD: 30000 },
    aiCooldown: 0,
    aiTarget: null,
};

// ==================== 交互状态 ====================
let inputState = {
    lastClickTime: 0, lastClickX: 0, lastClickY: 0,
    dashEffects: [], isProcessingClick: false,
};

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
        if(!gameState.aiEnabled){gameState.currentPath=[];gameState.player.isMoving=false;}
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
                p.x=vp.x; p.y=vp.y; gameState.currentPath=[];
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
    if(!p.isMoving) return;
    let spd=CONFIG.PLAYER_SPEED+(p.extraSpd||0);
    if(gameState.currentPath.length===0||gameState.currentPathIndex>=gameState.currentPath.length){ p.isMoving=false; return; }
    let tn=gameState.currentPath[gameState.currentPathIndex];
    let mv=calculateVector(p.x,p.y,tn.x,tn.y,spd);
    if(mv.arrived){ gameState.currentPathIndex++; if(gameState.currentPathIndex>=gameState.currentPath.length){p.isMoving=false;gameState.currentPathIndex=0;} return; }
    let nx=p.x+mv.x, ny=p.y+mv.y;
    if(canMoveTo(nx,ny)){ p.x=nx; p.y=ny; }
    else{ if(canMoveTo(nx,p.y))p.x=nx; if(canMoveTo(p.x,ny))p.y=ny; }
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
            // 找技能栏中第一张L3修仙卡
            var sb = gameState.skillBar || [];
            var targetIdx = -1, targetCard = null;
            for(var si=0; si<sb.length; si++){
                if(sb[si] && (sb[si].type==='cult_sword_blue' || sb[si].type==='cult_sword_gold')){
                    targetIdx = si;
                    targetCard = sb[si];
                    break;
                }
            }
            if(!targetCard){
                screenText('⚠️ 技能栏中没有可学习的剑卡!', '#ff4757', 1000);
                return;
            }

            // 学习成功率：蓝卡高(70%)，金卡低(40%)
            var successRate = targetCard.rarity === 'gold' ? 0.40 : 0.70;
            cult.studyPoints = Math.max(0, (cult.studyPoints||0) - 1);
            if(Math.random() < successRate){
                // 成功：回收卡片，属性加到主角
                var p = gameState.player;
                if(targetCard.rarity === 'gold'){
                    // 金卡：+1升级次数，+1剑光
                    cult.upgradePoints = (cult.upgradePoints||0) + 1;
                    cult.swordCount = (cult.swordCount||0) + 1;
                    // 7剑光→万剑归宗
                    if(cult.swordCount >= 7){
                        cult.hasUltimate = true;
                        screenText('🌟 万剑归宗 觉醒!', '#ffd700', 2000);
                    }
                    // 升级次数记录
                    if(!cult._collectedGold) cult._collectedGold = [];
                    if(!cult._collectedGold.includes(targetCard.name)) cult._collectedGold.push(targetCard.name);
                } else {
                    if(!cult._collectedBlue) cult._collectedBlue = [];
                    if(!cult._collectedBlue.includes(targetCard.name)) cult._collectedBlue.push(targetCard.name);
                }
                // 应用卡牌属性
                if(targetCard.apply && p){
                    targetCard.apply(p);
                }
                // 修为
                cult.cultivationValue = Math.min(MAX_CULTIVATION_VALUE, (cult.cultivationValue||0) + (targetCard.cultivationValue||10));

                // 从技能栏移除
                sb.splice(targetIdx, 1);

                screenText('✅ 学习成功! '+targetCard.name+' 已融入', '#ffd700', 1500);
                for(var pj=0; pj<15; pj++){
                    gameState.particles.push(new Particle(gameState.camera.x+canvas.width/2, gameState.camera.y+canvas.height/2, '#ffd700', 600, 3, 4));
                }
            } else {
                // 失败：不回收卡片，但学习次数已扣
                screenText('❌ 学习失败! '+targetCard.name+' 保留技能栏', '#ff4757', 1000);
            }
            return;
        }
        return;
    }

    // 藏图标关闭时 → 点击浮动剑打开面板
    if(cult._floatSword && sx>=cult._floatSword.x && sx<=cult._floatSword.x+cult._floatSword.w
        && sy>=cult._floatSword.y && sy<=cult._floatSword.y+cult._floatSword.h){
        cult.hiddenSwordOpen = true;
        return;
    }
}

function checkTimeFreezeClick(sx,sy){
    var tf=gameState._timeFreeze;
    if(tf.active||tf.cooldown>0) return false;
    var bx=6,by=~~(canvas.height/2+3),bw=34;
    if(sx>=bx&&sx<=bx+bw&&sy>=by&&sy<=by+34){
        activateTimeFreeze();
        return true;
    }
    return false;
}
function activateTimeFreeze(){
    var tf=gameState._timeFreeze;
    tf.active=true;
    tf.timer=tf.duration;
    screenText('⏰ 时间静止!', '#00d4ff', 1200, -20);
    SFX&&SFX.dash&&SFX.dash();
    // 全屏冻结粒子爆散
    for(var i=0;i<20;i++){
        var px=gameState.player.x+(Math.random()-0.5)*200;
        var py=gameState.player.y+(Math.random()-0.5)*200;
        gameState.particles.push(new Particle(px,py,'rgba(0,212,255,0.8)',500,3,2));
    }
}
function openChestCard(){
    if(chestCount<=0) return;
    var pool=[].concat(CHEST_CARDS);
    var picks=[];
    for(var i=0;i<3&&pool.length>0;i++){
        var idx=Math.floor(Math.random()*pool.length);
        picks.push(pool[idx]);
        pool.splice(idx,1);
    }
    if(picks.length===0) return;
    var overlay=document.getElementById('chestCard-overlay');
    if(!overlay) return;
    var container=overlay.querySelector('.chestCard-container');
    if(!container) return;
    container.innerHTML='';
    var title=overlay.querySelector('.chestCard-title');
    if(title) title.textContent='📦 宝箱 ('+chestCount+'个可开)';
    picks.forEach(function(card){
        var el=document.createElement('div');
        el.className='chestCard-item';
        el.innerHTML='<div class="chestCard-icon">'+card.icon+'</div>'+
            '<div class="chestCard-name">'+card.desc+'</div>'+
            '<div class="chestCard-type">'+card.name+'</div>';
        el.onclick=function(){
            var p=gameState.player;
            if(p) card.apply(p);
            chestCount--;
            chestSaveCount();
            SFX.chestOpen();
            screenText('✨ '+card.desc, '#00ff88', 1800, -20);
            overlay.style.display='none';
            if(chestCount>0) openChestCard();
        };
        container.appendChild(el);
    });
    overlay.style.display='flex';
}
function closeChestCardOverlay(){
    var el=document.getElementById('chestCard-overlay');
    if(el) el.style.display='none';
}
window.closeChestCardOverlay=closeChestCardOverlay;

