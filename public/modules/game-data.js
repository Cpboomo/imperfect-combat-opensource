/**
 * game-data.js — 配置与数据层
 * @module game-data
 * @description All game configuration, hero classes, card pools, cultivation data, and game state init.
 *   Loaded first — no dependencies on other modules.
 */

// game-data.js — Config, heroes, audio, boss configs, game state

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
/** Check card synergy thresholds (3+ same-family cards) and apply bonus effects. */
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
