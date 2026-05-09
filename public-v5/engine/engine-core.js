/**
 * engine-core.js — 核心引擎层
 * @module engine-core
 * @description Canvas setup, coordinate transforms, camera, grid, collision detection, delta-time.
 *   Must be loaded first (before engine-input, engine-audio, engine-render).
 *   All functions exposed on window.* for global access.
 */
'use strict';

// ==================== 核心配置 ====================

/** Engine configuration constants */
var ENGINE_CONFIG = {
    /** Grid dimensions (same as v4: 18×32 grid for pathfinding) */
    GRID_COLS: 18,
    GRID_ROWS: 32,
    GRID_SIZE: 40,

    /** Virtual canvas base dimensions (for scaling) */
    BASE_WIDTH: 360,
    BASE_HEIGHT: 640,

    /** Camera lerp smoothing factor (0–1, higher = snappier) */
    CAMERA_LERP: 0.12,

    /** Maximum delta-time in ms (cap to prevent spiral of death) */
    MAX_DT: 33,

    /** Color constants (shared across engine) */
    BG_COLOR: '#0a0a1a',
    GRID_COLOR: 'rgba(255,255,255,0.04)'
};

/** Derived world dimensions */
var ENGINE_MAP_W = ENGINE_CONFIG.GRID_COLS * ENGINE_CONFIG.GRID_SIZE;
var ENGINE_MAP_H = ENGINE_CONFIG.GRID_ROWS * ENGINE_CONFIG.GRID_SIZE;

// ==================== 引擎状态 ====================

/** @type {HTMLCanvasElement} */
var engineCanvas = null;

/** @type {CanvasRenderingContext2D} */
var engineCtx = null;

/** Engine core state */
var engineState = {
    /** Current delta-time in seconds */
    dt: 0,

    /** Raw delta-time in ms */
    dtMs: 0,

    /** Total elapsed time in seconds */
    elapsed: 0,

    /** Frame counter */
    frameCount: 0,

    /** Canvas logical width */
    width: ENGINE_CONFIG.BASE_WIDTH,

    /** Canvas logical height */
    height: ENGINE_CONFIG.BASE_HEIGHT,

    /** Pixel ratio of the display */
    pixelRatio: 1,

    /** Camera position — offset of viewport top-left in world coords */
    camera: { x: 0, y: 0 },

    /** Camera target position (for lerp) */
    cameraTarget: { x: 0, y: 0 },

    /** Is the engine initialized and running? */
    running: false
};

// ==================== Canvas 初始化 ====================

/**
 * Initialize the engine canvas.
 * Creates or attaches to a canvas element inside the given container.
 * Sets up pixel-ratio-aware rendering for crisp graphics on all screens.
 *
 * @param {string|HTMLElement} container - Container element or its ID
 * @returns {{ canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D }} Canvas and context
 */
function engineInit(container) {
    if (typeof container === 'string') {
        container = document.getElementById(container);
    }
    if (!container) {
        throw new Error('[engine-core] Container not found');
    }

    // Create canvas if not exists
    engineCanvas = container.querySelector('canvas');
    if (!engineCanvas) {
        engineCanvas = document.createElement('canvas');
        container.appendChild(engineCanvas);
    }

    engineCtx = engineCanvas.getContext('2d');

    // Apply engine resize (uses fixed phone portrait resolution)
    engineResize();

    // Listen for window resize and orientation change
    window.addEventListener('resize', engineResize);
    window.addEventListener('orientationchange', function () {
        setTimeout(engineResize, 300);
    });

    engineState.running = true;

    return { canvas: engineCanvas, ctx: engineCtx };
}

/**
 * Resize canvas to fill container, respecting pixel ratio.
 * Called automatically on init and when container resizes.
 * 
 * Uses FIXED phone portrait resolution (390×844) for consistent layout.
 * Canvas scales proportionally to fit the viewport, centered with letterboxing.
 */
function engineResize() {
    if (!engineCanvas) return;

    var FIXED_W = 390;
    var FIXED_H = 844;
    var dpr = window.devicePixelRatio || 1;

    // Scale to fit viewport while maintaining aspect ratio
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var scaleX = vw / FIXED_W;
    var scaleY = vh / FIXED_H;
    var displayScale = Math.min(scaleX, scaleY);

    var displayW = Math.round(FIXED_W * displayScale);
    var displayH = Math.round(FIXED_H * displayScale);
    var offsetX = Math.round((vw - displayW) / 2);
    var offsetY = Math.round((vh - displayH) / 2);

    engineState.pixelRatio = dpr;
    engineState.width = FIXED_W;
    engineState.height = FIXED_H;

    // Canvas buffer: fixed logical size × DPR
    engineCanvas.width = FIXED_W * dpr;
    engineCanvas.height = FIXED_H * dpr;

    // CSS display: scaled to fit viewport, centered
    engineCanvas.style.width = displayW + 'px';
    engineCanvas.style.height = displayH + 'px';
    engineCanvas.style.position = 'absolute';
    engineCanvas.style.left = offsetX + 'px';
    engineCanvas.style.top = offsetY + 'px';

    // Scale the context so all drawing is in CSS-pixel coords
    engineCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Reset camera bounds after resize
    _clampCameraTarget();
}

/**
 * Get the CSS-pixel dimensions of the canvas.
 * @returns {{ w: number, h: number }}
 */
function engineGetSize() {
    return { w: engineState.width, h: engineState.height };
}

/**
 * Get the pixel ratio of the current display.
 * @returns {number}
 */
function engineGetPixelRatio() {
    return engineState.pixelRatio;
}

// ==================== 坐标转换 ====================

/**
 * Convert world coordinates to screen (canvas) coordinates.
 * Accounts for camera offset.
 *
 * @param {number} wx - World X coordinate
 * @param {number} wy - World Y coordinate
 * @returns {{ x: number, y: number }} Screen coordinates
 */
function worldToScreen(wx, wy) {
    return {
        x: wx - engineState.camera.x,
        y: wy - engineState.camera.y
    };
}

/**
 * Convert screen (canvas) coordinates to world coordinates.
 * Accounts for camera offset.
 *
 * @param {number} sx - Screen X coordinate
 * @param {number} sy - Screen Y coordinate
 * @returns {{ x: number, y: number }} World coordinates
 */
function screenToWorld(sx, sy) {
    return {
        x: sx + engineState.camera.x,
        y: sy + engineState.camera.y
    };
}

/**
 * Convert a raw pointer event (clientX/clientY) to world coordinates.
 * Handles CSS-to-canvas offset automatically.
 *
 * @param {MouseEvent|Touch} e - Pointer event or touch object
 * @returns {{ x: number, y: number }} World coordinates
 */
function pointerToWorld(e) {
    var rect = engineCanvas.getBoundingClientRect();
    var sx = e.clientX - rect.left;
    var sy = e.clientY - rect.top;
    return screenToWorld(sx, sy);
}

/**
 * Check if a point in world coordinates is visible on screen.
 *
 * @param {number} wx - World X
 * @param {number} wy - World Y
 * @param {number} [margin=0] - Extra margin in pixels
 * @returns {boolean} True if on screen
 */
function isOnScreen(wx, wy, margin) {
    if (margin === undefined) margin = 0;
    var sx = wx - engineState.camera.x;
    var sy = wy - engineState.camera.y;
    return sx >= -margin &&
           sy >= -margin &&
           sx <= engineState.width + margin &&
           sy <= engineState.height + margin;
}

// ==================== 世界 / 网格转换 ====================

/**
 * Convert world coordinates to grid cell indices.
 *
 * @param {number} wx - World X
 * @param {number} wy - World Y
 * @returns {{ x: number, y: number }} Grid cell { col, row }
 */
function worldToGrid(wx, wy) {
    return {
        x: Math.floor(wx / ENGINE_CONFIG.GRID_SIZE),
        y: Math.floor(wy / ENGINE_CONFIG.GRID_SIZE)
    };
}

/**
 * Convert grid cell indices to world coordinates (cell center).
 *
 * @param {number} gx - Grid column
 * @param {number} gy - Grid row
 * @returns {{ x: number, y: number }} World coordinates of cell center
 */
function gridToWorld(gx, gy) {
    return {
        x: gx * ENGINE_CONFIG.GRID_SIZE + ENGINE_CONFIG.GRID_SIZE / 2,
        y: gy * ENGINE_CONFIG.GRID_SIZE + ENGINE_CONFIG.GRID_SIZE / 2
    };
}

/**
 * Get the grid cell the center of a world-position entity occupies.
 * @param {number} wx
 * @param {number} wy
 * @returns {{ x: number, y: number }}
 */
function worldToGridCenter(wx, wy) {
    return worldToGrid(wx, wy);
}

// ==================== 相机系统 ====================

/**
 * Set camera target to follow a world position.
 * Camera will smoothly lerp toward this target each frame.
 *
 * @param {number} wx - World X to follow
 * @param {number} wy - World Y to follow
 * @param {boolean} [instant=false] - Skip lerp and jump immediately
 */
function cameraFollow(wx, wy, instant) {
    var tx = wx - engineState.width / 2;
    var ty = wy - engineState.height / 2;

    // Clamp to map bounds
    var mapW = ENGINE_MAP_W;
    var mapH = ENGINE_MAP_H;
    var cw = engineState.width;
    var ch = engineState.height;

    var maxX = Math.max(0, mapW - cw);
    var maxY = Math.max(0, mapH - ch);

    engineState.cameraTarget.x = Math.max(0, Math.min(tx, maxX));
    engineState.cameraTarget.y = Math.max(0, Math.min(ty, maxY));

    // Center if map smaller than canvas
    if (mapW <= cw) {
        engineState.cameraTarget.x = -(cw - mapW) / 2;
    }
    if (mapH <= ch) {
        engineState.cameraTarget.y = -(ch - mapH) / 2;
    }

    if (instant) {
        engineState.camera.x = engineState.cameraTarget.x;
        engineState.camera.y = engineState.cameraTarget.y;
    }
}

/**
 * Update camera position with lerp smoothing.
 * Called once per frame.
 */
function cameraUpdate() {
    var lerp = ENGINE_CONFIG.CAMERA_LERP;
    engineState.camera.x += (engineState.cameraTarget.x - engineState.camera.x) * lerp;
    engineState.camera.y += (engineState.cameraTarget.y - engineState.camera.y) * lerp;
}

/**
 * Internal: clamp camera target to map bounds after resize.
 * @private
 */
function _clampCameraTarget() {
    var cw = engineState.width;
    var ch = engineState.height;
    var mapW = ENGINE_MAP_W;
    var mapH = ENGINE_MAP_H;

    if (mapW <= cw) {
        engineState.cameraTarget.x = -(cw - mapW) / 2;
    }
    if (mapH <= ch) {
        engineState.cameraTarget.y = -(ch - mapH) / 2;
    }

    var maxX = Math.max(0, mapW - cw);
    var maxY = Math.max(0, mapH - ch);

    engineState.cameraTarget.x = Math.max(0, Math.min(engineState.cameraTarget.x, maxX));
    engineState.cameraTarget.y = Math.max(0, Math.min(engineState.cameraTarget.y, maxY));
}

/**
 * Get the current camera position.
 * @returns {{ x: number, y: number }}
 */
function cameraGetPos() {
    return { x: engineState.camera.x, y: engineState.camera.y };
}

/**
 * Get the camera target position.
 * @returns {{ x: number, y: number }}
 */
function cameraGetTarget() {
    return { x: engineState.cameraTarget.x, y: engineState.cameraTarget.y };
}

/**
 * Set camera lerp speed.
 * @param {number} lerp - 0–1 smoothing factor
 */
function cameraSetLerp(lerp) {
    ENGINE_CONFIG.CAMERA_LERP = Math.max(0, Math.min(1, lerp));
}

// ==================== 碰撞检测 ====================

/**
 * AABB (axis-aligned bounding box) collision test.
 *
 * @param {number} ax - A center X
 * @param {number} ay - A center Y
 * @param {number} aw - A width
 * @param {number} ah - A height
 * @param {number} bx - B center X
 * @param {number} by - B center Y
 * @param {number} bw - B width
 * @param {number} bh - B height
 * @returns {boolean} True if A and B overlap
 */
function collideAABB(ax, ay, aw, ah, bx, by, bw, bh) {
    return Math.abs(ax - bx) < (aw + bw) / 2 &&
           Math.abs(ay - by) < (ah + bh) / 2;
}

/**
 * Circle-circle collision test.
 *
 * @param {number} ax - Circle A center X
 * @param {number} ay - Circle A center Y
 * @param {number} ar - Circle A radius
 * @param {number} bx - Circle B center X
 * @param {number} by - Circle B center Y
 * @param {number} br - Circle B radius
 * @returns {boolean} True if circles overlap
 */
function collideCircle(ax, ay, ar, bx, by, br) {
    var dx = ax - bx;
    var dy = ay - by;
    var dist = dx * dx + dy * dy;
    var radii = ar + br;
    return dist < radii * radii;
}

/**
 * Distance squared between two points.
 *
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number} Squared distance
 */
function distSq(x1, y1, x2, y2) {
    var dx = x1 - x2;
    var dy = y1 - y2;
    return dx * dx + dy * dy;
}

/**
 * Distance between two points.
 *
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number} Distance in pixels
 */
function dist(x1, y1, x2, y2) {
    return Math.sqrt(distSq(x1, y1, x2, y2));
}

/**
 * Test if a point is inside a circle.
 *
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {number} cx - Circle center X
 * @param {number} cy - Circle center Y
 * @param {number} r - Circle radius
 * @returns {boolean}
 */
function pointInCircle(px, py, cx, cy, r) {
    return distSq(px, py, cx, cy) < r * r;
}

/**
 * Test if a point is inside a rectangle (world coords, top-left origin).
 *
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {number} rx - Rect left
 * @param {number} ry - Rect top
 * @param {number} rw - Rect width
 * @param {number} rh - Rect height
 * @returns {boolean}
 */
function pointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw &&
           py >= ry && py <= ry + rh;
}

/**
 * Get angle (in radians) from point A to point B.
 *
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @returns {number} Angle in radians
 */
function angleBetween(ax, ay, bx, by) {
    return Math.atan2(by - ay, bx - ax);
}

/**
 * Clamp a value between min and max.
 *
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(val, min, max) {
    return val < min ? min : val > max ? max : val;
}

/**
 * Linear interpolation (lerp).
 *
 * @param {number} a - Start
 * @param {number} b - End
 * @param {number} t - Factor 0–1
 * @returns {number}
 */
function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Move toward a target value by a step.
 *
 * @param {number} current
 * @param {number} target
 * @param {number} step
 * @returns {number}
 */
function moveToward(current, target, step) {
    if (Math.abs(target - current) <= step) return target;
    return current + (target > current ? step : -step);
}

// ==================== Delta-Time 管理 ====================

/**
 * Start the engine loop.
 * Calls the provided callback each frame with delta-time information.
 *
 * @param {function(number, number, number): void} callback - Called with (dt, dtMs, timestamp) each frame
 */
function engineLoop(callback) {
    var lastTime = 0;

    function frame(timestamp) {
        if (!engineState.running) return;

        // Calculate delta
        var dtMs = lastTime ? Math.min(timestamp - lastTime, ENGINE_CONFIG.MAX_DT) : 16.67;
        lastTime = timestamp;

        var dt = dtMs / 1000;

        engineState.dt = dt;
        engineState.dtMs = dtMs;
        engineState.elapsed += dt;
        engineState.frameCount++;

        callback(dt, dtMs, timestamp);

        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}

/**
 * Get the current delta-time in seconds.
 * @returns {number}
 */
function engineGetDt() {
    return engineState.dt;
}

/**
 * Get the current delta-time in milliseconds.
 * @returns {number}
 */
function engineGetDtMs() {
    return engineState.dtMs;
}

/**
 * Get total elapsed time since engine started.
 * @returns {number} Seconds
 */
function engineGetElapsed() {
    return engineState.elapsed;
}

// ==================== 网格系统 ====================

/**
 * Create a 2D grid array (EMPTY = all cells free).
 *
 * @param {number} [cols] - Grid columns (default: GRID_COLS)
 * @param {number} [rows] - Grid rows (default: GRID_ROWS)
 * @returns {Array<Array<object>>} 2D array of cell objects { type: 'empty'|'wall', ... }
 */
function gridCreate(cols, rows) {
    cols = cols || ENGINE_CONFIG.GRID_COLS;
    rows = rows || ENGINE_CONFIG.GRID_ROWS;

    var grid = [];
    for (var y = 0; y < rows; y++) {
        grid[y] = [];
        for (var x = 0; x < cols; x++) {
            grid[y][x] = { type: 'empty' };
        }
    }
    return grid;
}

/**
 * Set a cell to wall type.
 *
 * @param {Array<Array<object>>} grid
 * @param {number} gx - Grid column
 * @param {number} gy - Grid row
 */
function gridSetWall(grid, gx, gy) {
    if (gy >= 0 && gy < grid.length && gx >= 0 && gx < (grid[0]||[]).length) {
        grid[gy][gx].type = 'wall';
    }
}

/**
 * Check if a grid cell is a wall (or out of bounds).
 *
 * @param {Array<Array<object>>} grid
 * @param {number} gx - Grid column
 * @param {number} gy - Grid row
 * @returns {boolean}
 */
function gridIsWall(grid, gx, gy) {
    if (gx < 0 || gx >= ENGINE_CONFIG.GRID_COLS || gy < 0 || gy >= ENGINE_CONFIG.GRID_ROWS) {
        return true; // Out of bounds = wall
    }
    var cell = grid[gy] ? grid[gy][gx] : null;
    return cell && cell.type === 'wall';
}

/**
 * Check if a grid cell is walkable (not a wall, not out of bounds).
 *
 * @param {Array<Array<object>>} grid
 * @param {number} gx
 * @param {number} gy
 * @returns {boolean}
 */
function gridIsWalkable(grid, gx, gy) {
    return !gridIsWall(grid, gx, gy);
}

/**
 * Get neighbor cell coordinates (4-directional).
 *
 * @param {number} gx
 * @param {number} gy
 * @returns {Array<{ x: number, y: number }>}
 */
function gridGetNeighbors(gx, gy) {
    return [
        { x: gx,     y: gy - 1 },
        { x: gx + 1, y: gy     },
        { x: gx,     y: gy + 1 },
        { x: gx - 1, y: gy     }
    ];
}

/**
 * Draw the grid overlay on the canvas.
 * Renders faint grid lines for visual reference.
 *
 * @param {object} [opts] - Options
 * @param {string} [opts.color] - Grid line color
 * @param {number} [opts.lineWidth]
 */
function gridDraw(opts) {
    opts = opts || {};
    var color = opts.color || ENGINE_CONFIG.GRID_COLOR;
    var lw = opts.lineWidth || 1;
    var gs = ENGINE_CONFIG.GRID_SIZE;
    var ctx = engineCtx;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;

    // Vertical lines
    for (var x = 0; x <= ENGINE_MAP_W; x += gs) {
        var s = worldToScreen(x, 0);
        var e = worldToScreen(x, ENGINE_MAP_H);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();
    }

    // Horizontal lines
    for (var y = 0; y <= ENGINE_MAP_H; y += gs) {
        var s2 = worldToScreen(0, y);
        var e2 = worldToScreen(ENGINE_MAP_W, y);
        ctx.beginPath();
        ctx.moveTo(s2.x, s2.y);
        ctx.lineTo(e2.x, e2.y);
        ctx.stroke();
    }

    ctx.restore();
}

/**
 * Draw walls from grid data (only walls that are visible on screen).
 *
 * @param {Array<Array<object>>} grid
 * @param {string} [wallColor] - Color for wall cells
 */
function gridDrawWalls(grid, wallColor) {
    wallColor = wallColor || '#3d3d5c';
    var gs = ENGINE_CONFIG.GRID_SIZE;
    var ctx = engineCtx;

    ctx.save();
    ctx.fillStyle = wallColor;

    for (var gy = 0; gy < grid.length; gy++) {
        var row = grid[gy];
        for (var gx = 0; gx < row.length; gx++) {
            if (row[gx].type === 'wall') {
                var wx = gx * gs;
                var wy = gy * gs;
                if (isOnScreen(wx, wy, gs)) {
                    var s = worldToScreen(wx, wy);
                    ctx.fillRect(s.x, s.y, gs, gs);
                }
            }
        }
    }

    ctx.restore();
}

// ==================== 调试 ====================

/**
 * Log engine diagnostics to console.
 */
function engineDebug() {
    console.log('[engine-core] Diagnostics:');
    console.log('  Canvas:', engineState.width + 'x' + engineState.height, '@' + engineState.pixelRatio + 'x');
    console.log('  World:', ENGINE_MAP_W + 'x' + ENGINE_MAP_H);
    console.log('  Camera:', Math.round(engineState.camera.x) + ',' + Math.round(engineState.camera.y));
    console.log('  Target:', Math.round(engineState.cameraTarget.x) + ',' + Math.round(engineState.cameraTarget.y));
    console.log('  Frames:', engineState.frameCount, 'Elapsed:', engineState.elapsed.toFixed(2) + 's');
}
