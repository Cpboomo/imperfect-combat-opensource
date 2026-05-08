/**
 * game-state.js — v5.0 全局状态管理
 * @module game-state
 * @description Single source of truth for all runtime game state.
 *   Mutated by game logic modules, read by render/ui modules.
 *   Depends on: engine-core.js, game-data.js
 */
'use strict';

// ==================== 全局游戏状态 ====================

/** @type {Object} Central game state — the single source of truth */
var G = {
    // --- 游戏元信息 ---
    /** Current difficulty key (n1-n10) */
    difficulty: 'n5',

    /** Selected hero ID */
    heroId: 'immortal',

    /** Game phase: 'menu' | 'select' | 'playing' | 'paused' | 'over' */
    phase: 'menu',

    /** Elapsed game time in seconds */
    time: 0,

    /** Current chapter (1-5) */
    chapter: 1,

    /** Current wave within chapter (1-4) */
    wave: 1,

    /** Total wave index (1-20) */
    totalWave: 0,

    // --- 双轨经济 ---
    /** Gold — used for card draws */
    gold: 0,

    /** Total kills — used for talent purchases */
    kills: 0,

    /** Kills accumulated toward next talent unlock */
    killsTowardTalent: 0,

    // --- 玩家 ---
    /** @type {{x:number,y:number,hp:number,maxHp:number,mp:number,maxMp:number,atkMin:number,atkMax:number,range:number,speed:number,invincible:number,hero:Object}} */
    player: null,

    // --- 6格悬浮卡槽 ---
    /** @type {Array<Object|null>} 6 card slots — null = empty */
    cardSlots: [null, null, null, null, null, null],

    /** Selected card slot index for overflow replace (-1 = none) */
    overflowReplacing: -1,

    /** Cards available to draw */
    drawableCards: [],

    // --- 5格道具栏 ---
    /** @type {Array<Object|null>} 5 item slots */
    itemSlots: [null, null, null, null, null],

    /** Items on the ground (world space) */
    groundItems: [],

    /** Active boss-following items */
    bossFollowingItems: [],

    // --- 修仙L1-L3体系 ---
    /** Selected L2 card (null = not yet chosen) */
    cultivationL2: null,

    /** Selected L2 card path ID */
    cultivationL2Path: '',

    /** Remaining L2 cards for this path (decrease as they appear) */
    cultivationL2Pool: [],

    /** Active L3 cards */
    cultivationL3: [],

    /** Accumulated recycle counts for current L2 card */
    cultivationRecycleCount: 0,

    /** Current L2 card lifecycle timer (ms remaining) */
    cultivationL2Timer: 0,

    /** Weapon upgrade level */
    cultivationWeaponLevel: 1,

    /** Available weapon upgrade attempts */
    cultivationWeaponUpgrades: 0,

    /** Is the cultivation UI open? */
    cultivationUIOpen: false,

    // --- 全局天赋 ---
    /** @type {Array<Object>} Active talents */
    talents: [],

    /** @type {Array<Object>} Available talent choices (3 at a time) */
    talentChoices: [],

    /** Is talent selection panel visible? */
    talentPanelOpen: false,

    // --- 战斗 ---
    /** @type {Array<Object>} Active monsters */
    monsters: [],

    /** @type {Array<Object>} Active projectiles */
    projectiles: [],

    /** @type {Array<Object>} Active boss portals */
    bossPortals: [],

    /** Next monster spawn timestamp */
    nextSpawnTime: 0,

    /** Monster spawn queue */
    spawnQueue: [],

    // --- UI ---
    /** Is hero blueprint panel open? */
    blueprintOpen: false,

    /** Card currently being hovered (for enlarged preview) */
    hoveredCardIndex: -1,

    /** Item currently being dragged */
    draggedItemIndex: -1,

    /** Boss item selection panel open? */
    bossItemPanelOpen: false,

    /** Active portal selection widget */
    portalSelectionOpen: false,

    // --- 结算 ---
    score: 0,
    finalKills: 0,
    finalWave: 0,
    finalTime: 0
};

// ==================== 状态初始化 ====================

/**
 * Initialize/reset game state for a new run
 * @param {string} difficulty - Difficulty key (n1-n10)
 * @param {string} heroId - Hero ID
 */
function stateInit(difficulty, heroId) {
    var hero = HEROES[heroId];
    var diff = DIFFICULTY[difficulty];

    // Reset core
    G.difficulty = difficulty;
    G.heroId = heroId;
    G.phase = 'playing';
    G.time = 0;
    G.chapter = 1;
    G.wave = 1;
    G.totalWave = 0;

    // Reset economy
    G.gold = 0;
    G.kills = 0;
    G.killsTowardTalent = 0;

    // Reset player
    G.player = {
        x: ENGINE_MAP_W / 2,
        y: ENGINE_MAP_H * 0.8,
        hp: hero.hp,
        maxHp: hero.hp,
        mp: hero.mp,
        maxMp: hero.mp,
        atkMin: hero.atkMin,
        atkMax: hero.atkMax,
        range: hero.range,
        speed: 3,
        invincible: 0,
        hero: hero,
        // Combat bonuses (from cards/items/talents)
        bonuses: {}
    };

    // Reset cards
    G.cardSlots = [null, null, null, null, null, null];
    G.overflowReplacing = -1;
    G.drawableCards = WORKER_CARDS.slice();

    // Reset items
    G.itemSlots = [null, null, null, null, null];
    G.groundItems = [];
    G.bossFollowingItems = [];

    // Reset cultivation
    G.cultivationL2 = null;
    G.cultivationL2Path = '';
    G.cultivationL2Pool = [];
    G.cultivationL3 = [];
    G.cultivationRecycleCount = 0;
    G.cultivationL2Timer = 0;
    G.cultivationWeaponLevel = 1;
    G.cultivationWeaponUpgrades = 0;
    G.cultivationUIOpen = false;

    // Setup cultivation L2 pool if hero is cultivation type
    if (hero.type === HERO_TYPE.CULTIVATION) {
        G.cultivationL2Pool = (CULTIVATION_L2_CARDS[heroId] || []).slice();
    }

    // Reset talents
    G.talents = [];
    G.talentChoices = [];
    G.talentPanelOpen = false;

    // Reset combat
    G.monsters = [];
    G.projectiles = [];
    G.bossPortals = [];
    G.nextSpawnTime = 0;
    G.spawnQueue = [];

    // Reset UI
    G.blueprintOpen = false;
    G.hoveredCardIndex = -1;
    G.draggedItemIndex = -1;
    G.bossItemPanelOpen = false;
    G.portalSelectionOpen = false;

    // Reset score
    G.score = 0;
    G.finalKills = 0;
    G.finalWave = 0;
    G.finalTime = 0;

    // Set camera to player
    cameraFollow(G.player.x, G.player.y, true);
    cameraUpdate();
}

/**
 * Get the current difficulty config
 * @returns {Object}
 */
function stateGetDifficulty() {
    return DIFFICULTY[G.difficulty] || DIFFICULTY.n5;
}

/**
 * Get the current hero config
 * @returns {Object}
 */
function stateGetHero() {
    return HEROES[G.heroId];
}

/**
 * Check if player has a cultivation-type hero
 * @returns {boolean}
 */
function stateIsCultivation() {
    return stateGetHero().type === HERO_TYPE.CULTIVATION;
}

/**
 * Add kills and check talent threshold
 * @param {number} count - Number of kills to add
 */
function stateAddKills(count) {
    G.kills += count;
    G.killsTowardTalent += count;
    var threshold = stateGetDifficulty().killsPerTalent;
    if (G.killsTowardTalent >= threshold) {
        G.killsTowardTalent -= threshold;
        return true; // Trigger talent selection
    }
    return false;
}

/**
 * Add gold
 * @param {number} amount
 */
function stateAddGold(amount) {
    G.gold += amount;
}

/**
 * Find first empty card slot
 * @returns {number} Index or -1 if full
 */
function stateFindEmptyCardSlot() {
    for (var i = 0; i < 6; i++) {
        if (!G.cardSlots[i]) return i;
    }
    return -1;
}

/**
 * Find first empty item slot
 * @returns {number} Index or -1 if full
 */
function stateFindEmptyItemSlot() {
    for (var i = 0; i < 5; i++) {
        if (!G.itemSlots[i]) return i;
    }
    return -1;
}
