/**
 * game-main.js — v5.0 入口
 * @module game-main
 * @description Entry point, initialization, click routing, game start/restart.
 *   Must be loaded LAST (after all other modules).
 */
'use strict';

// ==================== Initialization ====================

var GRoot = {}; // HTML root reference

function gameMain() {
    var canvas = document.getElementById('game-canvas');
    if (!canvas) { console.error('Canvas not found'); return; }

    // Init engines
    engineInit(canvas);

    // Init input
    inputInit(
        gameOnClick,       // onClick
        null,              // onDoubleClick
        gameOnDragStart,   // onDragStart
        gameOnDragEnd,     // onDragEnd
        gameOnLongPress    // onLongPress
    );

    audioInit();

    // Init game state with defaults
    stateInit('n5', 'immortal');

    // Start camera follow
    cameraFollow(G.player.x, G.player.y, true);
    cameraUpdate();

    // Start game loop
    loopStart();

    console.log('Imperfect Combat v5.0 ready');
}

// ==================== Click Routing ====================

function gameOnClick(wx, wy) {
    if (G.phase === 'playing') {
        gameRouteClick(wx, wy);
    } else if (G.phase === 'over') {
        gameCheckRetry(wx, wy);
    }
}

function gameRouteClick(wx, wy) {
    var cam = cameraGetPos();
    var sx = wx - cam.x;
    var sy = wy - cam.y;

    // Check card slot clicks
    for (var i = 0; i < 6; i++) {
        var cardSx = UI.CARD_START_X + i * (UI.CARD_W + UI.CARD_GAP);
        if (sx >= cardSx && sx <= cardSx + UI.CARD_W && sy >= UI.CARD_Y && sy <= UI.CARD_Y + UI.CARD_H) {
            if (G.overflowReplacing >= 0) {
                cardsReplaceSlot(i);
                return;
            }
            // Click card: show sell option or use
            gameCardClick(i);
            return;
        }
    }

    // Check item slot clicks
    for (i = 0; i < 5; i++) {
        var itemSx = UI.ITEM_START_X + i * (UI.ITEM_W + UI.ITEM_GAP);
        if (sx >= itemSx && sx <= itemSx + UI.ITEM_W && sy >= UI.ITEM_Y && sy <= UI.ITEM_Y + UI.ITEM_H) {
            gameItemClick(i);
            return;
        }
    }

    // Check talent selection
    if (G.talentPanelOpen && window._talentRects) {
        for (i = 0; i < window._talentRects.length; i++) {
            var r = window._talentRects[i];
            if (sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) {
                talentsSelect(i);
                return;
            }
        }
    }

    // Check blueprint toggle (top-right area)
    if (sx > 310 && sy < 80) {
        G.blueprintOpen = !G.blueprintOpen;
        return;
    }

    // Check cultivation UI clicks
    if (stateIsCultivation() && window._cultivationL2Rects) {
        for (i = 0; i < window._cultivationL2Rects.length; i++) {
            var cr = window._cultivationL2Rects[i];
            if (sx >= cr.x && sx <= cr.x + cr.w && sy >= cr.y && sy <= cr.y + cr.h) {
                cultivationSelectL2(i);
                return;
            }
        }
    }

    // Check boss following items click
    for (i = 0; i < G.bossFollowingItems.length; i++) {
        var bi = G.bossFollowingItems[i];
        if (distSq(sx, sy, bi.x - cam.x, bi.y - cam.y) < 400) {
            itemsUsePortal(bi);
            return;
        }
    }

    // Check ground items click
    for (i = 0; i < G.groundItems.length; i++) {
        var gi = G.groundItems[i];
        if (distSq(sx, sy, gi.worldX - cam.x, gi.worldY - cam.y) < 400) {
            if (itemsPickup(gi)) {
                G.groundItems.splice(i, 1);
            }
            return;
        }
    }

    // Default: move player
    combatMoveTo(wx, wy);
}

function gameCardClick(index) {
    var card = G.cardSlots[index];
    if (!card) return;
    // Simple: sell card
    cardsSell(index);
}

function gameItemClick(index) {
    var item = G.itemSlots[index];
    if (!item) return;
    if (item.passive) return;
    itemsUseConsumable(index);
}

function gameCheckRetry(wx, wy) {
    if (!window._retryRect) return;
    var r = window._retryRect;
    if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) {
        gameRestart();
    }
}

// ==================== Input Handlers ====================

function gameOnDragStart(wx, wy) {
    // Check if dragging from item slot
    var cam = cameraGetPos();
    for (var i = 0; i < 5; i++) {
        var sx = UI.ITEM_START_X + i * (UI.ITEM_W + UI.ITEM_GAP);
        var clickSx = wx - cam.x;
        var clickSy = wy - cam.y;
        if (clickSx >= sx && clickSx <= sx + UI.ITEM_W && clickSy >= UI.ITEM_Y && clickSy <= UI.ITEM_Y + UI.ITEM_H) {
            G.draggedItemIndex = i;
            return;
        }
    }
}

function gameOnDragEnd() {
    if (G.draggedItemIndex >= 0) {
        // Discard item
        itemsDiscard(G.draggedItemIndex);
        G.draggedItemIndex = -1;
    }
}

function gameOnLongPress(wx, wy) {
    // Long press on card → sell
    var cam = cameraGetPos();
    var sx = wx - cam.x, sy = wy - cam.y;
    for (var i = 0; i < 6; i++) {
        var cardSx = UI.CARD_START_X + i * (UI.CARD_W + UI.CARD_GAP);
        if (sx >= cardSx && sx <= cardSx + UI.CARD_W && sy >= UI.CARD_Y && sy <= UI.CARD_Y + UI.CARD_H) {
            cardsSell(i);
            return;
        }
    }
}

// ==================== Game Lifecycle ====================

function gameRestart() {
    stateInit(G.difficulty, G.heroId);
    particles.length = 0;
    G.phase = 'playing';
    playerMoveTarget = null;
    precisionPetActive = false;
    waveIsActive = false;
    waveSpawnQueue = [];
    cardsDragCard = null;
    G.overflowReplacing = -1;
    cameraFollow(G.player.x, G.player.y, true);
    cameraUpdate();
    wavesStart();
}

/** Called from HTML: start game with difficulty */
function gameStart(difficulty, heroId) {
    stateInit(difficulty, heroId);
    particles.length = 0;
    playerMoveTarget = null;
    precisionPetActive = false;
    waveIsActive = false;
    waveSpawnQueue = [];
    cardsDragCard = null;
    G.overflowReplacing = -1;
    cameraFollow(G.player.x, G.player.y, true);
    cameraUpdate();
    wavesStart();
    if (!loopRunning) loopStart();
}

// Auto-start on load
window.addEventListener('load', function() {
    var canvas = document.getElementById('game-canvas');
    if (canvas && canvas.parentElement && canvas.parentElement.classList.contains('active')) {
        gameMain();
    }
});
