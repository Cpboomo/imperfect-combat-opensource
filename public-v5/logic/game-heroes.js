/**
 * game-heroes.js — v5.0 英雄系统
 * @module game-heroes
 * @description Two hero systems: UI-less precision matching + UI-based cultivation.
 */
'use strict';

/** Update hero-specific systems */
function heroesUpdate(dt) {
    if (!G.player) return;
    var hero = stateGetHero();

    if (hero.type === HERO_TYPE.PRECISION) {
        heroesUpdatePrecision(dt);
    } else if (hero.type === HERO_TYPE.CULTIVATION) {
        heroesUpdateCultivation(dt);
    }
}

// ==================== 无UI体系：精准对子流 ====================

/** Track pet state */
var precisionPetActive = false;
var precisionPetX = 0, precisionPetY = 0;
var precisionPetTimer = 0;

/** Check card pairs for precision matching */
function heroesUpdatePrecision(dt) {
    // Count cards by synergy groups
    var cardIds = G.cardSlots.filter(function(c){return c;}).map(function(c){return c.id;});

    // Check each pair
    var bonuses = {};
    for (var key in PRECISION_PAIRS) {
        if (key === 'triple_ultimate') continue;
        var pair = PRECISION_PAIRS[key];
        var matched = pair.cards.filter(function(cid){return cardIds.indexOf(cid) >= 0;}).length;
        if (matched >= 2) {
            Object.assign(bonuses, pair.effect);
        }
    }

    // Apply bonuses to player
    if (G.player) G.player.bonuses = Object.assign(G.player.bonuses || {}, bonuses);

    // Check triple ultimate
    var triple = PRECISION_PAIRS.triple_ultimate;
    var tripleMatched = triple.cards.filter(function(cid){return cardIds.indexOf(cid) >= 0;}).length;
    if (tripleMatched >= 3 && !precisionPetActive) {
        precisionPetActive = true;
        precisionPetX = G.player.x;
        precisionPetY = G.player.y;
        precisionPetTimer = 0;
        emitParticles(G.player.x, G.player.y, {count:30,color:COLORS.GOLD,speed:10,life:50,shape:'circle'});
        audioPlayCritHit();
    }

    // Update pet
    if (precisionPetActive && G.player) {
        precisionPetTimer += dt / 1000;
        // Pet orbits player
        precisionPetX = G.player.x + Math.cos(precisionPetTimer * 2) * 50;
        precisionPetY = G.player.y + Math.sin(precisionPetTimer * 3) * 40;
        // Pet attacks nearest monster every 2s
        if (Math.floor(precisionPetTimer) % 2 === 0 && precisionPetTimer - Math.floor(precisionPetTimer) < 0.05) {
            var target = combatFindNearest(precisionPetX, precisionPetY, 200);
            if (target) {
                G.projectiles.push({
                    x: precisionPetX, y: precisionPetY,
                    vx: (target.x-precisionPetX)*0.1, vy: (target.y-precisionPetY)*0.1,
                    damage: 30, isCrit: false, color: COLORS.GOLD, radius: 6, pierce: 2
                });
            }
        }
    }
}

// ==================== 带UI体系：修仙流派 ====================

/** Cultivation system update */
function heroesUpdateCultivation(dt) {
    if (!stateIsCultivation()) return;

    // L2 card lifecycle timer
    if (G.cultivationL2 && G.cultivationL2Path) {
        G.cultivationL2Timer -= dt;
        if (G.cultivationL2Timer <= 0) {
            // Auto-recycle L2
            cultivationRecycleL2();
        }
    }

    // L2 selection: when reaching recycle count threshold
    if (!G.cultivationL2Path && G.cultivationL2Pool.length > 0 && G.cultivationRecycleCount >= 5) {
        cultivationOfferL2();
    }

    // MP regen
    if (G.player) {
        G.player.mp = Math.min(G.player.maxMp, G.player.mp + (0.5 * dt / 1000));
    }
}

/** Offer L2 card selection */
function cultivationOfferL2() {
    G.cultivationL2Timer = 10000;
    G.cultivationRecycleCount = 0;
    audioPlayCardFlip();
}

/** Select L2 card */
function cultivationSelectL2(poolIndex) {
    if (poolIndex < 0 || poolIndex >= G.cultivationL2Pool.length) return;
    G.cultivationL2 = G.cultivationL2Pool[poolIndex];
    G.cultivationL2Path = G.cultivationL2Pool[poolIndex].id;
    G.cultivationL2Timer = 10000; // 10s lifecycle
    G.cultivationL2Pool = []; // Other L2 paths no longer available
    audioPlayCardSelect();
}

/** Recycle L2 card → produce L3 card */
function cultivationRecycleL2() {
    var successRate = 0.5;
    // Apply support card bonuses
    for (var i = 0; i < G.cultivationL3.length; i++) {
        var c = G.cultivationL3[i];
        if (c.recycleSuccessUp) successRate += c.recycleSuccessUp;
    }
    // Apply talent bonuses
    if (G.talents.some(function(t){return t.id === 't3';})) successRate += 0.1;

    if (Math.random() < successRate) {
        // Success — produce L3 card
        var pool = CULTIVATION_L3_CORE;
        // Mix support cards
        if (Math.random() < 0.4) pool = CULTIVATION_L3_SUPPORT;
        var l3Card = Object.assign({}, pool[Math.floor(Math.random() * pool.length)]);
        G.cultivationL3.push(l3Card);
        G.cultivationWeaponUpgrades++;
        emitParticles(G.player.x, G.player.y, {count:15,color:COLORS.PURPLE,speed:6,life:25,shape:'circle'});
        audioPlayCardSelect();

        // Check ultimate synergy
        var l3Ids = G.cultivationL3.map(function(c){return c.id;});
        var ultimateMatch = ULTIMATE_SYNERGY_SET.filter(function(id){return l3Ids.indexOf(id) >= 0;}).length;
        if (ultimateMatch >= 6) {
            cultivationTriggerUltimate();
        }
    } else {
        // Failure
        emitParticles(G.player.x, G.player.y, {count:5,color:COLORS.RED,speed:4,life:15});
        audioPlayShatter();
    }

    // Reset L2
    G.cultivationL2 = null;
    G.cultivationL2Path = '';
    G.cultivationL2Timer = 0;
}

/** Trigger ultimate synergy skill */
function cultivationTriggerUltimate() {
    emitParticles(G.player.x, G.player.y, {count:40,color:COLORS.PINK,speed:12,life:50,shape:'circle'});
    shakeScreen(10, 20);
    audioPlayCritHit();

    // Damage all monsters on screen
    for (var i = G.monsters.length - 1; i >= 0; i--) {
        combatDamageMonster(G.monsters[i], 200, true);
    }
}

/** Attempt weapon upgrade */
function cultivationUpgradeWeapon() {
    if (G.cultivationWeaponUpgrades <= 0) return;
    var hero = stateGetHero();
    var ui = hero.cultivationUI;
    if (!ui) return;
    if (G.cultivationWeaponLevel >= ui.maxLevel) return;

    var successRate = ui.upgradeSuccessBase;
    // Talent bonus
    if (G.talents.some(function(t){return t.id === 't12';})) successRate += 0.2;

    G.cultivationWeaponUpgrades--;

    if (Math.random() < successRate) {
        G.cultivationWeaponLevel++;
        G.player.atkMin += 3;
        G.player.atkMax += 3;
        emitParticles(G.player.x, G.player.y, {count:15,color:COLORS.GREEN,speed:5,life:20,shape:'circle'});
        audioPlayCardSelect();
    } else {
        emitParticles(G.player.x, G.player.y, {count:5,color:COLORS.RED,speed:4,life:15});
        audioPlayShatter();
    }
}
