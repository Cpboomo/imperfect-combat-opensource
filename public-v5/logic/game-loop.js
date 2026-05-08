/**
 * game-loop.js — v5.0 主循环
 * @module game-loop
 * @description Main game loop with delta-time, pause, phase management.
 *   Drives update → render cycle. Delegates to combat/waves/cards/items/talents systems.
 *   Depends on: engine-core, engine-input, game-data, game-state
 */
'use strict';

var loopLastTime = 0;
var loopRunning = false;
var loopFrameCount = 0;

/**
 * Start the game loop
 */
function loopStart() {
    if (loopRunning) return;
    loopRunning = true;
    loopLastTime = performance.now();
    loopFrameCount = 0;
    window._loopPaused = false;
    requestAnimationFrame(loopTick);
}

/** Stop the game loop */
function loopStop() {
    loopRunning = false;
}

/** Pause/resume toggle */
function loopTogglePause() {
    window._loopPaused = !window._loopPaused;
}

/**
 * Main tick — called via requestAnimationFrame
 * @param {number} timestamp
 */
function loopTick(timestamp) {
    if (!loopRunning) return;

    var now = performance.now();
    var dt = Math.min(now - loopLastTime, ENGINE_CONFIG.MAX_DT);
    loopLastTime = now;

    if (!window._loopPaused) {
        loopFrameCount++;

        // --- UPDATE ---
        G.time += dt / 1000;
        loopUpdate(dt);
    }

    // --- RENDER ---
    loopRender();

    requestAnimationFrame(loopTick);
}

/**
 * Update all game systems
 * @param {number} dt - Delta time in ms
 */
function loopUpdate(dt) {
    if (G.phase !== 'playing' && G.phase !== 'over') return;

    // Check game over
    if (G.player && G.player.hp <= 0 && G.phase === 'playing') {
        loopGameOver();
        return;
    }

    // Player movement (handled by input in game-main)
    // Skip update if game over
    if (G.phase === 'over') return;

    // Combat
    if (typeof combatUpdate === 'function') combatUpdate(dt);

    // Waves
    if (typeof wavesUpdate === 'function') wavesUpdate(dt);

    // Cards
    if (typeof cardsUpdate === 'function') cardsUpdate(dt);

    // Items
    if (typeof itemsUpdate === 'function') itemsUpdate(dt);

    // Talents
    if (typeof talentsUpdate === 'function') talentsUpdate(dt);

    // Cultivation
    if (typeof cultivationUpdate === 'function') cultivationUpdate(dt);

    // Heroes (ultimate pet, etc.)
    if (typeof heroesUpdate === 'function') heroesUpdate(dt);

    // Particles
    updateParticles();
}

/**
 * Render all game systems
 */
function loopRender() {
    if (!engineCtx) return;

    var ctx = engineCtx;
    var size = engineGetSize();
    var cam = cameraGetPos();
    var shake = getShakeOffset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // Clear
    ctx.fillStyle = COLORS.BG_DARK;
    ctx.fillRect(0, 0, size.w, size.h);

    if (G.phase === 'menu' || G.phase === 'select') {
        // Menu rendering handled by HTML overlay
        ctx.restore();
        return;
    }

    // Game world rendering (delegated)
    if (typeof renderWorld === 'function') renderWorld(ctx, cam);

    // UI rendering (delegated)
    if (typeof renderUI === 'function') renderUI(ctx, size);

    ctx.restore();
}

/**
 * Trigger game over sequence
 */
function loopGameOver() {
    G.phase = 'over';
    G.finalKills = G.kills;
    G.finalWave = G.totalWave;
    G.finalTime = G.time;
    G.score = (G.kills * 10 + G.totalWave * 100 + G.gold) * (stateGetDifficulty().hpMult);
    audioPlayShatter();
}
