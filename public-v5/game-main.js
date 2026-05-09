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
    var container = document.getElementById('game-container');
    if (!container) { console.error('Container not found'); return; }

    // Init engines (pass container element, not canvas)
    engineInit(container);

    // Init input
    inputInit(
        gameOnClick,       // onClick
        null,              // onDoubleClick
        gameOnDragStart,   // onDragStart
        gameOnDragEnd,     // onDragEnd
        gameOnLongPress    // onLongPress
    );

    audioInit();

    // Game state initialized by gameStart() — not here

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
    var cw = engineCanvas.width, ch = engineCanvas.height;
    var L = uiLayout(cw, ch);

    // Check pause button
    if (window._pauseBtnRect) {
        var pr = window._pauseBtnRect;
        if (sx >= pr.x && sx <= pr.x + pr.w && sy >= pr.y && sy <= pr.y + pr.h) {
            loopTogglePause();
            return;
        }
    }

    // Check card draw button
    if (window._drawCardRect) {
        var dr = window._drawCardRect;
        if (sx >= dr.x && sx <= dr.x + dr.w && sy >= dr.y && sy <= dr.y + dr.h) {
            cardsDraw();
            return;
        }
    }

    // Check card slot clicks (centered bottom row)
    var cardTotalW = 6 * L.cardW + 5 * L.cardGap;
    var cardStartX = (cw - cardTotalW) / 2;
    for (var i = 0; i < 6; i++) {
        var cardSx = cardStartX + i * (L.cardW + L.cardGap);
        if (sx >= cardSx && sx <= cardSx + L.cardW && sy >= L.cardY && sy <= L.cardY + L.cardH) {
            if (G.overflowReplacing >= 0) {
                cardsReplaceSlot(i);
                return;
            }
            gameCardClick(i);
            return;
        }
    }

    // Check item slot clicks (centered, above cards)
    var itemTotalW = 5 * L.itemW + 4 * L.itemGap;
    var itemStartX = (cw - itemTotalW) / 2;
    for (i = 0; i < 5; i++) {
        var itemSx = itemStartX + i * (L.itemW + L.itemGap);
        if (sx >= itemSx && sx <= itemSx + L.itemW && sy >= L.itemY && sy <= L.itemY + L.itemH) {
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

    // Check blueprint toggle button (small 📋 button top-right)
    if (window._blueprintToggleRect) {
        var br = window._blueprintToggleRect;
        if (sx >= br.x && sx <= br.x + br.w && sy >= br.y && sy <= br.y + br.h) {
            G.blueprintOpen = true;
            return;
        }
    }

    // Check blueprint close button
    if (G.blueprintOpen && window._blueprintCloseRect) {
        var bc = window._blueprintCloseRect;
        if (sx >= bc.x && sx <= bc.x + bc.w && sy >= bc.y && sy <= bc.y + bc.h) {
            G.blueprintOpen = false;
            return;
        }
    }

    // Check blueprint sidebar background tap → close
    if (G.blueprintOpen) {
        G.blueprintOpen = false;
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

    // Check boss following items click (40px radius for fingers)
    for (i = 0; i < G.bossFollowingItems.length; i++) {
        var bi = G.bossFollowingItems[i];
        if (distSq(sx, sy, bi.x - cam.x, bi.y - cam.y) < 1600) {
            itemsUsePortal(bi);
            return;
        }
    }

    // Check ground items click (40px radius)
    for (i = 0; i < G.groundItems.length; i++) {
        var gi = G.groundItems[i];
        if (distSq(sx, sy, gi.worldX - cam.x, gi.worldY - cam.y) < 1600) {
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
    var cam = cameraGetPos();
    var sx = wx - cam.x;
    var sy = wy - cam.y;
    var r = window._retryRect;
    if (sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) {
        gameRestart();
    }
}

// ==================== Input Handlers ====================

function gameOnDragStart(wx, wy) {
    var cam = cameraGetPos();
    var cw = engineCanvas.width;
    var L = uiLayout(cw, engineCanvas.height);
    var clickSx = wx - cam.x;
    var clickSy = wy - cam.y;
    var itemTotalW = 5 * L.itemW + 4 * L.itemGap;
    var itemStartX = (cw - itemTotalW) / 2;
    for (var i = 0; i < 5; i++) {
        var sx = itemStartX + i * (L.itemW + L.itemGap);
        if (clickSx >= sx && clickSx <= sx + L.itemW && clickSy >= L.itemY && clickSy <= L.itemY + L.itemH) {
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
    var cam = cameraGetPos();
    var sx = wx - cam.x, sy = wy - cam.y;
    var cw = engineCanvas.width;
    var L = uiLayout(cw, engineCanvas.height);
    var cardTotalW = 6 * L.cardW + 5 * L.cardGap;
    var cardStartX = (cw - cardTotalW) / 2;
    for (var i = 0; i < 6; i++) {
        var cardSx = cardStartX + i * (L.cardW + L.cardGap);
        if (sx >= cardSx && sx <= cardSx + L.cardW && sy >= L.cardY && sy <= L.cardY + L.cardH) {
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
    window._retryRect = null;
    window._drawCardRect = null;
    window._talentRects = null;
    window._cultivationL2Rects = null;
    cameraFollow(G.player.x, G.player.y, true);
    cameraUpdate();
    loopLastTime = performance.now();
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
    window._retryRect = null;
    window._drawCardRect = null;
    window._talentRects = null;
    window._cultivationL2Rects = null;
    cameraFollow(G.player.x, G.player.y, true);
    cameraUpdate();
    loopLastTime = performance.now();
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
