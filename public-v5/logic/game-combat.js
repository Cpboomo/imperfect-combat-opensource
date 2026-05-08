/**
 * game-combat.js — v5.0 战斗系统
 * @module game-combat
 * @description Player attack, projectile physics, monster AI & collision, damage calculation.
 */
'use strict';

var ATTACK_COOLDOWN = 300; // ms between attacks
var combatLastAttack = 0;

function combatUpdate(dt) {
    if (!G.player) return;
    var p = G.player;
    var now = performance.now();

    // Player auto-attack nearest monster
    if (now - combatLastAttack > ATTACK_COOLDOWN) {
        combatAutoAttack();
    }

    // Update projectiles
    combatUpdateProjectiles(dt);

    // Update monsters
    combatUpdateMonsters(dt);

    // Check monster contact damage
    combatCheckContact();

    // Update invincibility timer
    if (p.invincible > 0) p.invincible -= dt / 1000;
}

/** Find nearest monster and fire projectile */
function combatAutoAttack() {
    if (G.monsters.length === 0) return;
    var p = G.player;
    var target = combatFindNearest(p.x, p.y, p.range);
    if (!target) return;

    var angle = angleBetween(p.x, p.y, target.x, target.y);
    var dmg = Math.floor(Math.random() * (p.atkMax - p.atkMin + 1)) + p.atkMin;
    
    // Apply card bonuses
    if (p.bonuses && p.bonuses.atkBonus) dmg += p.bonuses.atkBonus;
    
    // Crit check
    var critChance = (p.bonuses && p.bonuses.critBonus) ? p.bonuses.critBonus : 0.05;
    var isCrit = Math.random() < critChance;
    if (isCrit) dmg = Math.floor(dmg * 2);

    G.projectiles.push({
        x: p.x, y: p.y,
        vx: Math.cos(angle) * 8,
        vy: Math.sin(angle) * 8,
        damage: dmg,
        isCrit: isCrit,
        color: isCrit ? COLORS.ORANGE : COLORS.CYAN,
        radius: 4,
        pierce: (p.bonuses && p.bonuses.pierce) ? p.bonuses.pierce : 0
    });

    combatLastAttack = performance.now();
}

/** Find nearest monster within range */
function combatFindNearest(x, y, range) {
    var nearest = null, nearestDist = range;
    for (var i = 0; i < G.monsters.length; i++) {
        var m = G.monsters[i];
        var d = dist(x, y, m.x, m.y);
        if (d < nearestDist) { nearestDist = d; nearest = m; }
    }
    return nearest;
}

/** Update projectile positions and hit detection */
function combatUpdateProjectiles(dt) {
    var scale = dt / 16;
    for (var i = G.projectiles.length - 1; i >= 0; i--) {
        var proj = G.projectiles[i];
        proj.x += proj.vx * scale;
        proj.y += proj.vy * scale;

        // Out of bounds check
        if (proj.x < -50 || proj.x > ENGINE_MAP_W + 50 || proj.y < -50 || proj.y > ENGINE_MAP_H + 50) {
            G.projectiles.splice(i, 1);
            continue;
        }

        // Hit monster check
        var hit = false;
        for (var j = G.monsters.length - 1; j >= 0; j--) {
            var m = G.monsters[j];
            if (distSq(proj.x, proj.y, m.x, m.y) < (m.size + proj.radius) * (m.size + proj.radius)) {
                combatDamageMonster(m, proj.damage, proj.isCrit);
                hit = true;
                if (proj.pierce <= 0) break;
                proj.pierce--;
            }
        }
        if (hit && proj.pierce <= 0) {
            G.projectiles.splice(i, 1);
        }
    }
}

/** Deal damage to monster, handle death */
function combatDamageMonster(monster, damage, isCrit) {
    monster.hp -= damage;
    monster.hitFlash = 4;
    emitParticles(monster.x, monster.y, {
        count: isCrit ? 8 : 3,
        color: isCrit ? COLORS.ORANGE : COLORS.WHITE,
        speed: 3, life: 15
    });

    if (monster.hp <= 0) {
        combatKillMonster(monster);
    }
}

/** Kill monster, grant rewards */
function combatKillMonster(monster) {
    var idx = G.monsters.indexOf(monster);
    if (idx >= 0) G.monsters.splice(idx, 1);

    var diff = stateGetDifficulty();
    var goldReward = Math.floor(monster.gold * diff.goldMult);
    stateAddGold(goldReward);

    var needTalent = stateAddKills(1);
    if (needTalent && typeof talentsOffer === 'function') {
        talentsOffer();
    }

    // Lifesteal
    if (G.player.bonuses && G.player.bonuses.lifesteal) {
        G.player.hp = Math.min(G.player.maxHp, G.player.hp + G.player.maxHp * G.player.bonuses.lifesteal);
    }

    // Cultivation recycle count for L2
    if (stateIsCultivation() && G.cultivationL2Path) {
        G.cultivationRecycleCount++;
    }

    // Drop check (items)
    if (Math.random() < 0.15 && typeof itemsDropRandom === 'function') {
        itemsDropRandom(monster);
    }

    // Boss drop: portal item
    if ((monster.type === 'boss_mini' || monster.type === 'boss_final') && typeof wavesBossDropPortal === 'function') {
        wavesBossDropPortal(monster.x, monster.y);
    }

    emitParticles(monster.x, monster.y, {
        count: 15, color: monster.color || COLORS.WHITE, speed: 5, life: 25, shape: 'square'
    });

    audioPlayHit();
}

/** Update monster AI (move toward player) */
function combatUpdateMonsters(dt) {
    if (!G.player) return;
    var scale = dt / 16;
    var diff = stateGetDifficulty();

    for (var i = 0; i < G.monsters.length; i++) {
        var m = G.monsters[i];
        var dx = G.player.x - m.x;
        var dy = G.player.y - m.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;

        var spd = m.speed * diff.speedMult * scale;
        if (d > 1) {
            m.x += (dx / d) * spd;
            m.y += (dy / d) * spd;
        }

        // Hit flash decay
        if (m.hitFlash > 0) m.hitFlash--;
    }
}

/** Check player contact with monsters */
function combatCheckContact() {
    if (!G.player || G.player.invincible > 0) return;
    var p = G.player;

    for (var i = 0; i < G.monsters.length; i++) {
        var m = G.monsters[i];
        if (distSq(p.x, p.y, m.x, m.y) < (15 + m.size) * (15 + m.size)) {
            var dmg = m.atk;
            if (p.bonuses && p.bonuses.defBonus) dmg = Math.max(1, dmg - p.bonuses.defBonus);
            p.hp -= dmg;
            p.invincible = 0.5;
            shakeScreen(4, 8);
            audioPlayCritHit();
            emitParticles(p.x, p.y, {count:6, color:COLORS.RED, speed:3, life:15});

            // Thorns
            if (p.bonuses && p.bonuses.thorns) {
                combatDamageMonster(m, Math.floor(dmg * p.bonuses.thorns), false);
            }
            break;
        }
    }
}

// ==================== Player Movement ====================

var playerMoveTarget = null;

/** Set player move target (from click) */
function combatMoveTo(wx, wy) {
    playerMoveTarget = { x: wx, y: wy };
}

/** Update player movement toward target */
function combatUpdateMovement(dt) {
    if (!G.player) return;
    if (!playerMoveTarget) {
        // Decay velocity (inertia glide)
        if (G.player._vx) G.player._vx *= 0.9;
        if (G.player._vy) G.player._vy *= 0.9;
        if (Math.abs(G.player._vx || 0) < 0.1) G.player._vx = 0;
        if (Math.abs(G.player._vy || 0) < 0.1) G.player._vy = 0;
        return;
    }

    var p = G.player;
    var dx = playerMoveTarget.x - p.x;
    var dy = playerMoveTarget.y - p.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    var scale = dt / 16;

    if (d < 4) {
        playerMoveTarget = null;
        G.player._vx = 0;
        G.player._vy = 0;
        return;
    }

    var speed = p.speed * 2.5 * scale;
    var targetVx = (dx / d) * speed;
    var targetVy = (dy / d) * speed;

    p._vx = p._vx || 0;
    p._vy = p._vy || 0;
    p._vx += (targetVx - p._vx) * 0.15;
    p._vy += (targetVy - p._vy) * 0.15;

    p.x += p._vx;
    p.y += p._vy;

    // Clamp to map
    p.x = Math.max(20, Math.min(ENGINE_MAP_W - 20, p.x));
    p.y = Math.max(20, Math.min(ENGINE_MAP_H - 20, p.y));
}
