/**
 * game-items.js — v5.0 5格道具系统
 * @module game-items
 * @description 5-slot inventory, ground drops, boss-following items, active discarding.
 */
'use strict';

/**
 * Drop a random item at monster death location
 * @param {Object} monster
 */
function itemsDropRandom(monster) {
    // Determine drop source
    if (monster.isElite) {
        // 30% chance consumable, 30% passive, 40% boss drop
        var roll = Math.random();
        var pool;
        if (roll < 0.3) pool = ITEM_POOL.consumable;
        else if (roll < 0.6) pool = ITEM_POOL.passive;
        else pool = ITEM_POOL.boss;
        var item = pool[Math.floor(Math.random() * pool.length)];
        itemsSpawnGround(Object.assign({}, item), monster.x, monster.y);
        return;
    }

    // Normal monster: small chance
    if (Math.random() < 0.1) {
        var cons = ITEM_POOL.consumable[Math.floor(Math.random() * ITEM_POOL.consumable.length)];
        itemsSpawnGround(Object.assign({}, cons), monster.x, monster.y);
    }
}

/**
 * Spawn item on ground at world position
 */
function itemsSpawnGround(item, wx, wy) {
    item.worldX = wx;
    item.worldY = wy;
    item.ground = true;
    item.groundTimer = 300; // 300 frames = 5 seconds
    G.groundItems.push(item);
}

/**
 * Pick up ground item into inventory
 * @param {Object} item
 * @returns {boolean} success
 */
function itemsPickup(item) {
    var slot = stateFindEmptyItemSlot();
    if (slot >= 0) {
        G.itemSlots[slot] = item;
        item.ground = false;
        audioPlayPickup();
        return true;
    }
    return false;
}

/**
 * Use a consumable item
 * @param {number} slotIndex
 */
function itemsUseConsumable(slotIndex) {
    var item = G.itemSlots[slotIndex];
    if (!item || item.passive) return;

    switch (item.id) {
        case 'it1': // 清道夫炸弹
            for (var i = G.monsters.length - 1; i >= 0; i--) {
                var m = G.monsters[i];
                if (!m.isElite && m.type.indexOf('boss') < 0) {
                    emitParticles(m.x, m.y, {count:5,color:'#ff4444',speed:4,life:15});
                    G.monsters.splice(i, 1);
                }
            }
            shakeScreen(8, 12);
            break;
        case 'it2': // 治疗针
            G.player.hp = Math.min(G.player.maxHp, G.player.hp + G.player.maxHp * 0.5);
            emitParticles(G.player.x, G.player.y, {count:10,color:COLORS.GREEN,speed:3,life:20,shape:'circle'});
            break;
        case 'it3': // 能量脉冲
            for (i = 0; i < G.monsters.length; i++) {
                var mx = G.monsters[i].x - G.player.x;
                var my = G.monsters[i].y - G.player.y;
                var d = Math.sqrt(mx*mx+my*my)||1;
                G.monsters[i].x += (mx/d)*80;
                G.monsters[i].y += (my/d)*80;
            }
            emitParticles(G.player.x, G.player.y, {count:20,color:COLORS.CYAN,speed:6,life:15,shape:'circle'});
            break;
    }

    G.itemSlots[slotIndex] = null;
    audioPlayClick();
}

/**
 * Discard item from inventory to ground
 * @param {number} slotIndex
 */
function itemsDiscard(slotIndex) {
    var item = G.itemSlots[slotIndex];
    if (!item) return;
    item.worldX = G.player.x;
    item.worldY = G.player.y;
    item.ground = true;
    item.groundTimer = 300;
    G.groundItems.push(item);
    G.itemSlots[slotIndex] = null;
}

/**
 * Use boss portal item
 * @param {Object} item
 */
function itemsUsePortal(item) {
    if (!item.portalType) return;
    var pType = item.portalType;

    G.bossPortals.push({
        x: G.player.x + (Math.random()-0.5)*100,
        y: G.player.y - 80,
        type: pType,
        timer: 15000, // 15 seconds of spawning
        spawnInterval: 1500,
        lastSpawn: 0
    });

    // Remove from inventory
    for (var i = 0; i < 5; i++) {
        if (G.itemSlots[i] === item) { G.itemSlots[i] = null; break; }
    }
    // Remove from following
    var idx = G.bossFollowingItems.indexOf(item);
    if (idx >= 0) G.bossFollowingItems.splice(idx, 1);
    audioPlayCardSelect();
}

/** Update items each frame */
function itemsUpdate(dt) {
    // Update ground item timers
    for (var i = G.groundItems.length - 1; i >= 0; i--) {
        G.groundItems[i].groundTimer--;
        if (G.groundItems[i].groundTimer <= 0) G.groundItems.splice(i, 1);
    }

    // Update boss-following items
    if (G.player) {
        for (i = 0; i < G.bossFollowingItems.length; i++) {
            var item = G.bossFollowingItems[i];
            item.x = G.player.x + (Math.cos(G.time * 2 + i) * 40);
            item.y = G.player.y + (Math.sin(G.time * 2 + i) * 40);
        }
    }

    // Update portals
    for (i = G.bossPortals.length - 1; i >= 0; i--) {
        var portal = G.bossPortals[i];
        portal.timer -= dt;
        if (portal.timer <= 0) {
            G.bossPortals.splice(i, 1);
            continue;
        }
        portal.lastSpawn += dt;
        if (portal.lastSpawn >= portal.spawnInterval) {
            portal.lastSpawn = 0;
            wavesSpawnMonster(portal.type, false);
        }
    }

    // Check player proximity to ground items
    if (G.player) {
        for (i = G.groundItems.length - 1; i >= 0; i--) {
            var gi = G.groundItems[i];
            if (distSq(G.player.x, G.player.y, gi.worldX, gi.worldY) < 1600) { // 40px pickup range
                if (itemsPickup(gi)) {
                    G.groundItems.splice(i, 1);
                }
            }
        }
    }
}
