/**
 * engine-render.js — 渲染工具层
 * @module engine-render
 * @description Base drawing utilities, particle system, screen shake, text rendering.
 *   All drawing functions use world/screen coordinate transforms from engine-core.
 *   Depends on: engine-core.js (must be loaded before this file).
 */
'use strict';

// ==================== 色板常量 ====================

/** Color palette — 1:1 illustration style, flat colors, matte finish */
var COLORS = {
    BG_DARK:       '#0a0a1a',
    BG_MID:        '#1a1a3a',
    CYAN:          '#00d4ff',
    CYAN_DIM:      'rgba(0,212,255,0.3)',
    PURPLE:        '#8b5cf6',
    PURPLE_DIM:    'rgba(139,92,246,0.3)',
    PINK:          '#ff69b4',
    PINK_DIM:      'rgba(255,105,180,0.3)',
    GREEN:         '#22c55e',
    GREEN_DIM:     'rgba(34,197,94,0.3)',
    RED:           '#ef4444',
    RED_DIM:       'rgba(239,68,68,0.3)',
    ORANGE:        '#f59e0b',
    ORANGE_DIM:    'rgba(245,158,11,0.3)',
    YELLOW:        '#fbbf24',
    WHITE:         '#ffffff',
    WHITE_08:      'rgba(255,255,255,0.08)',
    WHITE_12:      'rgba(255,255,255,0.12)',
    WHITE_20:      'rgba(255,255,255,0.20)',
    WHITE_40:      'rgba(255,255,255,0.40)',
    WHITE_60:      'rgba(255,255,255,0.60)',
    BLACK_40:      'rgba(0,0,0,0.40)',
    BLACK_70:      'rgba(0,0,0,0.70)',
    GOLD:          '#ffd700',
    GOLD_DIM:      'rgba(255,215,0,0.3)',
    SILVER:        '#c0c0c0',
    BRONZE:        '#cd7f32'
};

// ==================== 粒子系统 ====================

/** @type {Array<{x:number,y:number,vx:number,vy:number,life:number,maxLife:number,size:number,color:string,shape:string}>} */
var particles = [];

/**
 * Emit particles at world position
 * @param {number} x - World X
 * @param {number} y - World Y
 * @param {Object} opts
 * @param {number} [opts.count=10] - Number of particles
 * @param {number} [opts.speed=3] - Maximum initial speed
 * @param {number} [opts.life=30] - Frames to live
 * @param {string} [opts.color='#ffffff'] - Particle color
 * @param {number} [opts.size=3] - Particle size in pixels
 * @param {string} [opts.shape='square'] - 'square', 'circle', 'triangle'
 * @param {number} [opts.spread=Math.PI*2] - Spread angle in radians
 */
function emitParticles(x, y, opts) {
    opts = opts || {};
    var count = opts.count || 10;
    var speed = opts.speed || 3;
    var life = opts.life || 30;
    var color = opts.color || '#ffffff';
    var size = opts.size || 3;
    var shape = opts.shape || 'square';
    var spread = opts.spread !== undefined ? opts.spread : Math.PI * 2;

    for (var i = 0; i < count; i++) {
        var angle = Math.random() * spread - spread / 2;
        var spd = Math.random() * speed;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            life: life,
            maxLife: life,
            size: size * (0.5 + Math.random()),
            color: color,
            shape: shape
        });
    }
}

/** Update all particles each frame */
function updateParticles() {
    for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

/** Draw all particles */
function drawParticles(ctx, camX, camY) {
    for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var alpha = p.life / p.maxLife;
        var sx = p.x - camX;
        var sy = p.y - camY;
        ctx.globalAlpha = alpha;

        switch (p.shape) {
            case 'circle':
                ctx.beginPath();
                ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();
                break;
            case 'triangle':
                ctx.beginPath();
                ctx.moveTo(sx, sy - p.size);
                ctx.lineTo(sx - p.size, sy + p.size);
                ctx.lineTo(sx + p.size, sy + p.size);
                ctx.closePath();
                ctx.fillStyle = p.color;
                ctx.fill();
                break;
            default: // square
                ctx.fillStyle = p.color;
                ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
        }
    }
    ctx.globalAlpha = 1;
}

// ==================== 屏幕震动 ====================

var shakeState = { intensity: 0, duration: 0, elapsed: 0 };

/**
 * Trigger screen shake
 * @param {number} intensity - Shake intensity in pixels
 * @param {number} duration - Duration in frames
 */
function shakeScreen(intensity, duration) {
    shakeState.intensity = Math.max(shakeState.intensity, intensity);
    shakeState.duration = Math.max(shakeState.duration, duration);
    shakeState.elapsed = 0;
}

/** Get current shake offset — call each frame */
function getShakeOffset() {
    if (shakeState.elapsed >= shakeState.duration) return { x: 0, y: 0 };
    var progress = shakeState.elapsed / shakeState.duration;
    var decay = 1 - progress;
    var intensity = shakeState.intensity * decay;
    shakeState.elapsed++;
    return {
        x: (Math.random() - 0.5) * intensity * 2,
        y: (Math.random() - 0.5) * intensity * 2
    };
}

// ==================== 绘制工具 ====================

/**
 * Draw rounded rectangle path (must call beginPath/fill/stroke separately)
 */
function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

/**
 * Draw a filled rounded rectangle
 */
function fillRoundRect(ctx, x, y, w, h, r, color) {
    ctx.fillStyle = color;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
}

/**
 * Draw a stroked rounded rectangle
 */
function strokeRoundRect(ctx, x, y, w, h, r, color, lineWidth) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth || 1;
    roundRect(ctx, x, y, w, h, r);
    ctx.stroke();
}

/**
 * Draw a progress bar (horizontal)
 * @param {number} x - Screen X
 * @param {number} y - Screen Y
 * @param {number} w - Width
 * @param {number} h - Height
 * @param {number} pct - Progress 0–1
 * @param {string} fillColor
 * @param {string} [bgColor='rgba(255,255,255,0.08)']
 */
function drawProgressBar(ctx, x, y, w, h, pct, fillColor, bgColor) {
    bgColor = bgColor || COLORS.WHITE_08;
    pct = Math.max(0, Math.min(1, pct));
    fillRoundRect(ctx, x, y, w, h, h / 2, bgColor);
    if (pct > 0) fillRoundRect(ctx, x, y, w * pct, h, h / 2, fillColor);
}

/**
 * Draw text with outline (for readability on any background)
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {number} [size=14]
 * @param {string} [fill='#ffffff']
 * @param {string} [outline='#000000']
 * @param {string} [align='left']
 */
function drawOutlineText(ctx, text, x, y, size, fill, outline, align) {
    size = size || 14;
    fill = fill || COLORS.WHITE;
    outline = outline || COLORS.BG_DARK;
    align = align || 'left';
    ctx.font = 'bold ' + size + 'px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = outline;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
}

/**
 * Draw a glow aura around a point
 * @param {number} x - Center X
 * @param {number} y - Center Y
 * @param {number} radius
 * @param {string} color
 * @param {number} [alpha=0.3]
 */
function drawGlow(ctx, x, y, radius, color, alpha) {
    alpha = alpha || 0.3;
    var grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'transparent');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

/**
 * Flash the canvas (e.g., on damage hit)
 * @param {string} [color='rgba(255,255,255,0.3)']
 */
function canvasFlash(ctx, canvas, color) {
    color = color || 'rgba(255,255,255,0.3)';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ==================== CSS Color Helpers ====================

/**
 * Blend two hex colors
 * @param {string} c1 - Hex color
 * @param {string} c2 - Hex color
 * @param {number} t - Blend factor 0–1
 * @returns {string} Hex color
 */
function blendColors(c1, c2, t) {
    var r1 = parseInt(c1.slice(1,3), 16);
    var g1 = parseInt(c1.slice(3,5), 16);
    var b1 = parseInt(c1.slice(5,7), 16);
    var r2 = parseInt(c2.slice(1,3), 16);
    var g2 = parseInt(c2.slice(3,5), 16);
    var b2 = parseInt(c2.slice(5,7), 16);
    var r = Math.round(r1 + (r2 - r1) * t);
    var g = Math.round(g1 + (g2 - g1) * t);
    var b = Math.round(b1 + (b2 - b1) * t);
    return '#' + [r,g,b].map(function(v){return ('0'+v.toString(16)).slice(-2)}).join('');
}

/**
 * Lighten a hex color by percentage
 * @param {string} hex
 * @param {number} pct - 0–1
 * @returns {string}
 */
function lightenColor(hex, pct) {
    return blendColors(hex, '#ffffff', pct);
}

/**
 * Darken a hex color by percentage
 * @param {string} hex
 * @param {number} pct - 0–1
 * @returns {string}
 */
function darkenColor(hex, pct) {
    return blendColors(hex, '#000000', pct);
}

// ==================== 1:1 Illustration Style ====================

/**
 * Draw a matte toy-style card (flat color, crisp edges, no shadows)
 * @param {number} x - Screen X
 * @param {number} y - Screen Y
 * @param {number} w - Width
 * @param {number} h - Height
 * @param {string} color - Base color
 * @param {number} [elevation=0] - Stack offset for layered effect (0 = no offset)
 */
function drawMatteCard(ctx, x, y, w, h, color, elevation) {
    elevation = elevation || 0;
    var r = 8;
    // Shadow layer (offset, darker variant)
    if (elevation > 0) {
        fillRoundRect(ctx, x + elevation, y + elevation, w, h, r, darkenColor(color, 0.3));
    }
    // Main card
    fillRoundRect(ctx, x, y, w, h, r, color);
    // Top highlight (matte reflection)
    var grad = ctx.createLinearGradient(x, y, x, y + h * 0.3);
    grad.addColorStop(0, 'rgba(255,255,255,0.15)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    // Border
    strokeRoundRect(ctx, x, y, w, h, r, 'rgba(255,255,255,0.2)', 1);
}

/**
 * Draw a glossy button (matte base + subtle highlight)
 */
function drawButton(ctx, x, y, w, h, color, text, textSize) {
    drawMatteCard(ctx, x, y, w, h, color, 2);
    drawOutlineText(ctx, text, x + w/2, y + h/2, textSize || 14, COLORS.WHITE, darkenColor(color, 0.5), 'center');
}

// ==================== 视口裁剪 ====================
// Note: isOnScreen() is defined in engine-core.js — do not redefine here.

