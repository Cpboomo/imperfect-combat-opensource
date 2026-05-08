/**
 * game-talents.js — v5.0 全局天赋系统
 * @module game-talents
 * @description Kill-count driven talent selection, talent effects application.
 */
'use strict';

/** Offer talent selection (3 random choices) */
function talentsOffer() {
    var pool = TALENTS.slice();
    // Remove already-selected talents
    var selectedIds = G.talents.map(function(t){return t.id;});
    pool = pool.filter(function(t){return selectedIds.indexOf(t.id) < 0;});
    if (pool.length < 3) return;

    // Shuffle and pick 3
    for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i+1));
        var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }

    G.talentChoices = pool.slice(0, 3);
    G.talentPanelOpen = true;
    audioPlayCardFlip();
}

/** Select a talent */
function talentsSelect(index) {
    if (index < 0 || index >= G.talentChoices.length) return;
    var talent = G.talentChoices[index];
    G.talents.push(talent);
    G.talentChoices = [];
    G.talentPanelOpen = false;

    // Apply talent effects
    talentsApply(talent);
    audioPlayCardSelect();
}

/** Apply talent effects to game state */
function talentsApply(talent) {
    switch(talent.id) {
        case 't3': // 残骸回收
            // Applied in combatKillMonster via diff multiplier
            break;
        case 't4': // 铁壁防线
            // Applied in combatUpdateMonsters via speed mult
            break;
        case 't13': // 时空扭曲 — instant effect
            for (var i = 0; i < G.monsters.length; i++) {
                G.monsters[i].speed *= 0.7;
            }
            // Revert after 10s
            setTimeout(function(){
                for (var i = 0; i < G.monsters.length; i++) {
                    G.monsters[i].speed /= 0.7;
                }
            }, 10000);
            break;
        case 't15': // 不死之身 — passive
            G.player._hasRebirth = true;
            break;
        case 't7': // 时间扩展 — handled in wave system
            break;
    }
}

/** Update talents each frame */
function talentsUpdate(dt) {
    // Auto-vendor talent
    if (G.talents.some(function(t){return t.id === 't1';})) {
        if (!G._lastAutoVendor) G._lastAutoVendor = G.time;
        if (G.time - G._lastAutoVendor > 30) {
            G._lastAutoVendor = G.time;
            cardsDraw();
        }
    }

    // Double gold talent
    if (G.talents.some(function(t){return t.id === 't2';})) {
        G._greedyCapsule = true;
    }

    // Undying — one-time resurrection
    if (G.player && G.player._hasRebirth && G.player.hp <= 0) {
        G.player.hp = G.player.maxHp;
        G.player._hasRebirth = false;
        G.player.invincible = 3;
        emitParticles(G.player.x, G.player.y, {count:30,color:COLORS.GOLD,speed:8,life:40,shape:'circle'});
        G.talents = G.talents.filter(function(t){return t.id !== 't15'});
    }
}
