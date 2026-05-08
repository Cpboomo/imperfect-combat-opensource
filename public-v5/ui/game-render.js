/**
 * game-render.js — v5.0 世界渲染
 * @module game-render
 * @description Renders game world: grid, monsters, player, projectiles, ground items, portals, precision pet.
 */
'use strict';

function renderWorld(ctx, cam) {
    renderGrid(ctx, cam);
    renderMonsters(ctx, cam);
    renderProjectiles(ctx, cam);
    renderGroundItems(ctx, cam);
    renderPortals(ctx, cam);
    renderPlayer(ctx, cam);
    renderParticles(ctx, cam);
}

function renderGrid(ctx, cam) {
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (var gx = 0; gx <= ENGINE_CONFIG.GRID_COLS; gx++) {
        var x = Math.floor(gx * ENGINE_CONFIG.GRID_SIZE - cam.x);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ctx.canvas.height); ctx.stroke();
    }
    for (var gy = 0; gy <= ENGINE_CONFIG.GRID_ROWS; gy++) {
        var y = Math.floor(gy * ENGINE_CONFIG.GRID_SIZE - cam.y);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ctx.canvas.width, y); ctx.stroke();
    }
}

function renderMonsters(ctx, cam) {
    for (var i = 0; i < G.monsters.length; i++) {
        var m = G.monsters[i];
        if (!isOnScreen(m.x, m.y, m.size, m.size, 30)) continue;
        var sx = m.x - cam.x, sy = m.y - cam.y;

        // Body
        var bodyColor = m.hitFlash > 0 ? '#ffffff' : m.color;
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(sx, sy, m.size, 0, Math.PI * 2);
        ctx.fill();

        // Elite/Boss border
        if (m.isElite) {
            var pulse = Math.sin(G.time * 5) * 0.3 + 0.7;
            strokeRoundRect(ctx, sx - m.size - 3, sy - m.size - 3, (m.size+3)*2, (m.size+3)*2, m.size, 'rgba(139,92,246,' + pulse + ')', 2);
        }

        // Icon
        drawOutlineText(ctx, m.icon || '👾', sx, sy - 2, m.size, COLORS.WHITE, COLORS.BG_DARK, 'center');

        // HP bar
        if (m.hp < m.maxHp) {
            drawProgressBar(ctx, sx - m.size, sy - m.size - 6, m.size * 2, 4, m.hp / m.maxHp, COLORS.RED);
        }
    }
}

function renderProjectiles(ctx, cam) {
    for (var i = 0; i < G.projectiles.length; i++) {
        var p = G.projectiles[i];
        var sx = p.x - cam.x, sy = p.y - cam.y;
        drawGlow(ctx, sx, sy, p.radius * 2, p.color, 0.3);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

function renderGroundItems(ctx, cam) {
    for (var i = 0; i < G.groundItems.length; i++) {
        var item = G.groundItems[i];
        var sx = item.worldX - cam.x, sy = item.worldY - cam.y;
        var alpha = item.groundTimer < 60 ? item.groundTimer / 60 : 1;
        ctx.globalAlpha = alpha;
        drawGlow(ctx, sx, sy, 12, COLORS.GOLD, 0.3);
        drawOutlineText(ctx, item.icon || '📦', sx, sy, 14, COLORS.WHITE, COLORS.BG_DARK, 'center');
        ctx.globalAlpha = 1;
    }
}

function renderPortals(ctx, cam) {
    for (var i = 0; i < G.bossPortals.length; i++) {
        var portal = G.bossPortals[i];
        var sx = portal.x - cam.x, sy = portal.y - cam.y;
        var pulse = Math.sin(G.time * 3) * 5 + 20;
        drawGlow(ctx, sx, sy, pulse, COLORS.PURPLE, 0.4);
        ctx.strokeStyle = COLORS.PURPLE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, 15, 0, Math.PI * 2);
        ctx.stroke();
        drawOutlineText(ctx, '🚪', sx, sy, 14, COLORS.WHITE, COLORS.BG_DARK, 'center');
    }
}

function renderPlayer(ctx, cam) {
    if (!G.player) return;
    var p = G.player;
    var sx = p.x - cam.x, sy = p.y - cam.y;
    var hero = stateGetHero();

    // Invincible flash
    if (p.invincible > 0 && Math.floor(G.time * 10) % 2 === 0) return;

    // Glow
    drawGlow(ctx, sx, sy, 20, hero.color, 0.2);

    // Body
    ctx.fillStyle = hero.color;
    ctx.beginPath();
    ctx.arc(sx, sy, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.WHITE_20;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Hero icon
    drawOutlineText(ctx, hero.icon, sx, sy, 14, COLORS.WHITE, COLORS.BG_DARK, 'center');

    // Dash trail
    if (p._vx !== undefined && (Math.abs(p._vx) > 1 || Math.abs(p._vy) > 1)) {
        var trailAlpha = Math.min(1, Math.abs(p._vx || 0) / 5 + Math.abs(p._vy || 0) / 5);
        drawGlow(ctx, sx - (p._vx || 0), sy - (p._vy || 0), 10, hero.color, trailAlpha * 0.15);
    }

    // Precision pet
    if (precisionPetActive) {
        renderPrecisionPet(ctx, cam);
    }
}

function renderPrecisionPet(ctx, cam) {
    var sx = precisionPetX - cam.x, sy = precisionPetY - cam.y;
    drawGlow(ctx, sx, sy, 14, COLORS.GOLD, 0.4);
    drawOutlineText(ctx, '🐟', sx, sy, 14, COLORS.WHITE, COLORS.BG_DARK, 'center');
}

function renderParticles(ctx, cam) {
    drawParticles(ctx, cam.x, cam.y);
}
