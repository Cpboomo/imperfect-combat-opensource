/**
 * game-waves.js — v5.0 波次系统
 * @module game-waves
 * @description Wave spawning from templates, monster factory, boss/elite events, portal system.
 */
'use strict';

var waveStartTime = 0;
var waveDuration = 0;
var waveSpawnQueue = [];
var waveSpawnTimer = 0;
var waveIsActive = false;

/** Start the first wave */
function wavesStart() {
    G.totalWave = 0;
    wavesNextWave();
}

/** Advance to next wave */
function wavesNextWave() {
    var idx = G.totalWave;
    if (idx >= WAVE_TEMPLATES.length) {
        // Game complete!
        loopGameOver();
        return;
    }

    var tmpl = WAVE_TEMPLATES[idx];
    G.chapter = tmpl.chapter;
    G.wave = tmpl.wave;
    G.totalWave++;
    waveStartTime = G.time * 1000;
    waveDuration = tmpl.duration * 1000;
    waveIsActive = true;

    // Build spawn queue from template
    waveSpawnQueue = [];
    var diff = stateGetDifficulty();
    for (var i = 0; i < tmpl.monsters.length; i++) {
        var sg = tmpl.monsters[i];
        for (var j = 0; j < sg.count; j++) {
            waveSpawnQueue.push({
                time: j * sg.interval * 1000,
                type: sg.type,
                isElite: sg.type.indexOf('elite') >= 0 || sg.type.indexOf('boss') >= 0
            });
        }
    }

    // Sort by time
    waveSpawnQueue.sort(function(a, b) { return a.time - b.time; });
    waveSpawnTimer = 0;

    // Emit wave start particles
    if (G.player) {
        emitParticles(G.player.x, G.player.y, {
            count: 20, color: COLORS.PURPLE, speed: 8, life: 30, shape: 'circle'
        });
    }
}

/** Update wave spawning */
function wavesUpdate(dt) {
    if (!waveIsActive) return;

    waveSpawnTimer += dt;

    // Process spawn queue
    while (waveSpawnQueue.length > 0 && waveSpawnQueue[0].time <= waveSpawnTimer) {
        var entry = waveSpawnQueue.shift();
        wavesSpawnMonster(entry.type, entry.isElite);
    }

    // Wave end check: all spawned + all dead → next wave; timeout as safeguard
    var allSpawned = waveSpawnQueue.length === 0;
    var allDead = G.monsters.length === 0;
    var timeUp = waveSpawnTimer >= waveDuration;
    if ((allSpawned && allDead) || timeUp) {
        waveIsActive = false;
        wavesNextWave();
    }
}

/** Spawn a monster */
function wavesSpawnMonster(type, isElite) {
    var tmpl = MONSTER_TYPES[type];
    if (!tmpl) return;

    var diff = stateGetDifficulty();

    // Spawn position: top of map with slight random offset
    var sx = ENGINE_MAP_W * 0.1 + Math.random() * ENGINE_MAP_W * 0.8;
    var sy = isElite ? ENGINE_CONFIG.GRID_SIZE * 2 : -20;

    var monster = {
        x: sx,
        y: sy,
        hp: Math.floor(tmpl.hp * diff.hpMult),
        maxHp: Math.floor(tmpl.hp * diff.hpMult),
        speed: tmpl.speed,
        atk: Math.floor(tmpl.atk * diff.hpMult),
        gold: tmpl.gold,
        size: tmpl.size,
        color: tmpl.color,
        icon: tmpl.icon,
        name: tmpl.name,
        type: type,
        isElite: isElite,
        hitFlash: 0,
        dropsStat: tmpl.dropsStat || false,
        dropsGold: tmpl.dropsGold || false
    };

    G.monsters.push(monster);

    // Elite/Boss entrance effect
    if (isElite) {
        emitParticles(sx, sy, { count: 20, color: COLORS.PURPLE, speed: 6, life: 25, shape: 'circle' });
    }
}

/** Boss drop: portal item */
function wavesBossDropPortal(bossX, bossY) {
    // Pick a random portal type
    var portalTypes = ['sandbag', 'gold_slime', 'elite_grunt'];
    var pType = portalTypes[Math.floor(Math.random() * portalTypes.length)];

    var item = {
        id: 'portal_' + pType,
        name: '超级阀门',
        icon: '🚪',
        desc: '选择出怪品类',
        bossDrop: true,
        portalType: pType,
        x: bossX,
        y: bossY,
        following: true,
        followTarget: G.player
    };

    G.bossFollowingItems.push(item);
}
