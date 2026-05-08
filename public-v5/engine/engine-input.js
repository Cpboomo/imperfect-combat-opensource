/**
 * engine-input.js — 统一输入处理层
 * @module engine-input
 * @description Unified input handler for mouse + touch.
 *   Provides click, hover, drag, long-press detection with world-coordinate conversion.
 *   Depends on: engine-core.js (must be loaded before this file).
 *   Exposes: isPointerDown, pointerWorldX, pointerWorldY, isDragging, dragStart, dragCurrent, isLongPress, pointerScreenX, pointerScreenY
 */
'use strict';

// ==================== 输入配置 ====================

/** Input configuration constants */
var INPUT_CONFIG = {
    /** Minimum drag distance in pixels before drag is registered */
    DRAG_THRESHOLD: 8,

    /** Long-press duration in milliseconds */
    LONG_PRESS_MS: 500,

    /** Maximum movement during long-press (to cancel if user moves too much) */
    LONG_PRESS_MOVE_LIMIT: 20,

    /** Maximum time between clicks for double-click detection (ms) */
    DOUBLE_CLICK_MS: 400,

    /** Maximum distance between clicks for double-click detection (pixels in world space) */
    DOUBLE_CLICK_DISTANCE: 40
};

// ==================== 输入状态 ====================

/** Current pointer state */
var inputState = {
    /** Is the pointer currently pressed down? */
    isPointerDown: false,

    /** Current pointer position in world coordinates */
    pointerWorldX: 0,
    pointerWorldY: 0,

    /** Current pointer position in screen (canvas) coordinates */
    pointerScreenX: 0,
    pointerScreenY: 0,

    /** Is the user currently dragging? */
    isDragging: false,

    /** Drag start position (world coords) */
    dragStart: { x: 0, y: 0 },

    /** Current drag position (world coords) */
    dragCurrent: { x: 0, y: 0 },

    /** Drag start position (screen coords) */
    _dragStartScreen: { x: 0, y: 0 },

    /** Is a long-press detected? */
    isLongPress: false,

    /** Was long-press just triggered this frame? (reset each frame) */
    isLongPressTriggered: false,

    /** Timestamp of pointer-down for long-press detection */
    _pressStartTime: 0,

    /** Position of pointer-down for long-press detection (screen coords) */
    _pressStartScreen: { x: 0, y: 0 },

    /** Click callback queue — flushed each frame */
    _clicks: [],

    /** Double-click callback queue */
    _doubleClicks: [],

    /** Last click info for double-click detection */
    _lastClickTime: 0,
    _lastClickWorld: { x: 0, y: 0 },

    /** Track whether we handled a click to prevent double-firing with touchend+click */
    _touchHandled: false,

    /** Whether input system is active */
    _active: false
};

// ==================== 公开 API (window.*) ====================

// These are referenced by external code directly:
//   isPointerDown    → inputState.isPointerDown (exported via getter)
//   pointerWorldX    → inputState.pointerWorldX (exported via getter)
//   pointerWorldY    → inputState.pointerWorldY (exported via getter)
//   isDragging       → inputState.isDragging (exported via getter)
//   dragStart        → inputState.dragStart (exported via getter)
//   dragCurrent      → inputState.dragCurrent (exported via getter)
//   isLongPress      → inputState.isLongPress (exported via getter)
//   pointerScreenX   → inputState.pointerScreenX (exported via getter)
//   pointerScreenY   → inputState.pointerScreenY (exported via getter)

// Define getters on window so external code can read inputState properties
Object.defineProperty(window, 'isPointerDown',  { get: function() { return inputState.isPointerDown; }});
Object.defineProperty(window, 'pointerWorldX',  { get: function() { return inputState.pointerWorldX; }});
Object.defineProperty(window, 'pointerWorldY',  { get: function() { return inputState.pointerWorldY; }});
Object.defineProperty(window, 'isDragging',     { get: function() { return inputState.isDragging; }});
Object.defineProperty(window, 'dragStart',      { get: function() { return inputState.dragStart; }});
Object.defineProperty(window, 'dragCurrent',    { get: function() { return inputState.dragCurrent; }});
Object.defineProperty(window, 'isLongPress',    { get: function() { return inputState.isLongPress; }});
Object.defineProperty(window, 'pointerScreenX', { get: function() { return inputState.pointerScreenX; }});
Object.defineProperty(window, 'pointerScreenY', { get: function() { return inputState.pointerScreenY; }});

// ==================== 初始化 ====================

/**
 * Initialize the input system.
 * Attaches all mouse and touch event listeners to the engine canvas.
 * Blocks touch defaults to prevent scroll/zoom during gameplay.
 *
 * @param {function} [onClick] - Optional global click handler (worldX, worldY)
 * @param {function} [onDoubleClick] - Optional global double-click handler (worldX, worldY)
 * @param {function} [onDragStart] - Optional drag start handler (worldX, worldY)
 * @param {function} [onDragEnd] - Optional drag end handler (startX, startY, endX, endY)
 * @param {function} [onLongPress] - Optional long-press handler (worldX, worldY)
 */
function inputInit(onClick, onDoubleClick, onDragStart, onDragEnd, onLongPress) {
    if (!engineCanvas) {
        console.warn('[engine-input] engineCanvas not initialized. Call engineInit() first.');
        return;
    }

    var c = engineCanvas;

    // ===== Mouse events =====
    c.addEventListener('mousedown', _onPointerDown, { passive: false });
    c.addEventListener('mousemove', _onPointerMove, { passive: false });
    c.addEventListener('mouseup',   _onPointerUp,   { passive: false });
    c.addEventListener('mouseleave', _onPointerUp,  { passive: false });
    c.addEventListener('click',     _onClick,       { passive: false });

    // Prevent context menu on canvas (we handle long-press ourselves)
    c.addEventListener('contextmenu', function(e) { e.preventDefault(); });

    // ===== Touch events =====
    c.addEventListener('touchstart', _onTouchStart, { passive: false });
    c.addEventListener('touchmove',  _onTouchMove,  { passive: false });
    c.addEventListener('touchend',   _onTouchEnd,   { passive: false });
    c.addEventListener('touchcancel',_onTouchEnd,   { passive: false });

    // ===== Keyboard events (optional, for dev/testing) =====
    var kbHandler = _onKeyEvent(onClick, onDoubleClick, onDragStart, onDragEnd, onLongPress);
    document.addEventListener('keydown', function(e) { kbHandler(e, true); });
    document.addEventListener('keyup',   function(e) { kbHandler(e, false); });

    // Store callbacks
    inputState._onClick = onClick;
    inputState._onDoubleClick = onDoubleClick;
    inputState._onDragStart = onDragStart;
    inputState._onDragEnd = onDragEnd;
    inputState._onLongPress = onLongPress;

    inputState._active = true;
}

// ==================== 事件处理器 ====================

/**
 * Extract pointer coordinates from a mouse event.
 * @private
 * @param {MouseEvent} e
 * @returns {{ sx: number, sy: number, wx: number, wy: number }}
 */
function _extractMouseCoords(e) {
    var rect = engineCanvas.getBoundingClientRect();
    var sx = e.clientX - rect.left;
    var sy = e.clientY - rect.top;
    var world = screenToWorld(sx, sy);
    return { sx: sx, sy: sy, wx: world.x, wy: world.y };
}

/**
 * Extract pointer coordinates from a single touch.
 * @private
 * @param {Touch} touch
 * @returns {{ sx: number, sy: number, wx: number, wy: number }}
 */
function _extractTouchCoords(touch) {
    var rect = engineCanvas.getBoundingClientRect();
    var sx = touch.clientX - rect.left;
    var sy = touch.clientY - rect.top;
    var world = screenToWorld(sx, sy);
    return { sx: sx, sy: sy, wx: world.x, wy: world.y };
}

/**
 * Handle pointer-down (mouse or primary touch).
 * @private
 */
function _onPointerDown(e) {
    e.preventDefault();
    if (e.type === 'touchstart') return; // Handled by _onTouchStart

    var coords = _extractMouseCoords(e);
    _handleDown(coords);
}

function _onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 0) return;

    var coords = _extractTouchCoords(e.touches[0]);
    _handleDown(coords);
    inputState._touchHandled = true;
}

function _handleDown(coords) {
    inputState.isPointerDown = true;
    inputState.pointerWorldX = coords.wx;
    inputState.pointerWorldY = coords.wy;
    inputState.pointerScreenX = coords.sx;
    inputState.pointerScreenY = coords.sy;

    // Reset drag
    inputState.isDragging = false;
    inputState.dragStart.x = coords.wx;
    inputState.dragStart.y = coords.wy;
    inputState.dragCurrent.x = coords.wx;
    inputState.dragCurrent.y = coords.wy;
    inputState._dragStartScreen.x = coords.sx;
    inputState._dragStartScreen.y = coords.sy;

    // Start long-press timer
    inputState.isLongPress = false;
    inputState.isLongPressTriggered = false;
    inputState._pressStartTime = performance.now();
    inputState._pressStartScreen.x = coords.sx;
    inputState._pressStartScreen.y = coords.sy;
}

/**
 * Handle pointer-move.
 * @private
 */
function _onPointerMove(e) {
    e.preventDefault();
    if (e.type === 'touchmove') return; // Handled by _onTouchMove

    var coords = _extractMouseCoords(e);
    _handleMove(coords);
}

function _onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 0) return;

    var coords = _extractTouchCoords(e.touches[0]);
    _handleMove(coords);
}

function _handleMove(coords) {
    if (!inputState.isPointerDown) return;

    inputState.pointerWorldX = coords.wx;
    inputState.pointerWorldY = coords.wy;
    inputState.pointerScreenX = coords.sx;
    inputState.pointerScreenY = coords.sy;
    inputState.dragCurrent.x = coords.wx;
    inputState.dragCurrent.y = coords.wy;

    // Detect drag threshold
    if (!inputState.isDragging) {
        var dx = coords.sx - inputState._dragStartScreen.x;
        var dy = coords.sy - inputState._dragStartScreen.y;
        if (Math.abs(dx) > INPUT_CONFIG.DRAG_THRESHOLD || Math.abs(dy) > INPUT_CONFIG.DRAG_THRESHOLD) {
            inputState.isDragging = true;
            if (inputState._onDragStart) {
                inputState._onDragStart(inputState.dragStart.x, inputState.dragStart.y);
            }
        }
    }

    // Cancel long-press if moved too far
    if (!inputState.isLongPress && !inputState.isLongPressTriggered) {
        var mx = coords.sx - inputState._pressStartScreen.x;
        var my = coords.sy - inputState._pressStartScreen.y;
        if (Math.abs(mx) > INPUT_CONFIG.LONG_PRESS_MOVE_LIMIT || Math.abs(my) > INPUT_CONFIG.LONG_PRESS_MOVE_LIMIT) {
            inputState._pressStartTime = Infinity; // Cancel
        }
    }
}

/**
 * Handle pointer-up.
 * @private
 */
function _onPointerUp(e) {
    e.preventDefault();
    if (e.type === 'touchend' || e.type === 'touchcancel') {
        // Prevent ghost click after touch
        setTimeout(function() { inputState._touchHandled = false; }, 300);
    }

    if (inputState._touchHandled && (e.type === 'mouseup' || e.type === 'click')) {
        return;
    }

    _handleUp();
}

function _onTouchEnd(e) {
    e.preventDefault();
    _handleUp();
    inputState._touchHandled = true;
    setTimeout(function() { inputState._touchHandled = false; }, 300);
}

function _handleUp() {
    var wasDown = inputState.isPointerDown;
    var wasDragging = inputState.isDragging;
    var dragStartCopy = { x: inputState.dragStart.x, y: inputState.dragStart.y };
    var dragEndCopy = { x: inputState.dragCurrent.x, y: inputState.dragCurrent.y };

    inputState.isPointerDown = false;
    inputState.isDragging = false;
    inputState.isLongPress = false;

    if (wasDragging && inputState._onDragEnd) {
        inputState._onDragEnd(dragStartCopy.x, dragStartCopy.y, dragEndCopy.x, dragEndCopy.y);
    }
}

/**
 * Handle click (mouse only — touch clicks are handled by up).
 * @private
 */
function _onClick(e) {
    e.preventDefault();
    if (inputState._touchHandled) return;

    // Check for double-click
    var coords = _extractMouseCoords(e);
    var now = performance.now();
    var last = inputState._lastClickTime;
    var lastPos = inputState._lastClickWorld;

    if (now - last < INPUT_CONFIG.DOUBLE_CLICK_MS &&
        dist(coords.wx, coords.wy, lastPos.x, lastPos.y) < INPUT_CONFIG.DOUBLE_CLICK_DISTANCE) {
        // Double click
        inputState._lastClickTime = 0;
        if (inputState._onDoubleClick) {
            inputState._onDoubleClick(coords.wx, coords.wy);
        }
    } else {
        // Single click
        inputState._lastClickTime = now;
        inputState._lastClickWorld.x = coords.wx;
        inputState._lastClickWorld.y = coords.wy;

        if (inputState._onClick) {
            inputState._onClick(coords.wx, coords.wy);
        }
    }
}

/**
 * Fake keyboard handler for dev/testing.
 * @private
 */
function _onKeyEvent(onClick, onDoubleClick, onDragStart, onDragEnd, onLongPress) {
    var keys = {};

    return function(e, isDown) {
        keys[e.key] = isDown;
    };
}

// ==================== 帧更新 ====================

/**
 * Called once per frame to check long-press and other time-based input state.
 * Must be called in the game loop.
 */
function inputUpdate() {
    // Check long-press threshold
    if (inputState.isPointerDown && !inputState.isDragging && !inputState.isLongPress && !inputState.isLongPressTriggered) {
        var elapsed = performance.now() - inputState._pressStartTime;
        if (elapsed >= INPUT_CONFIG.LONG_PRESS_MS) {
            inputState.isLongPress = true;
            inputState.isLongPressTriggered = true;
            if (inputState._onLongPress) {
                inputState._onLongPress(inputState.pointerWorldX, inputState.pointerWorldY);
            }
        }
    }
}

/**
 * Reset long-press triggered flag (call after processing to prevent re-fire).
 */
function inputResetLongPress() {
    inputState.isLongPress = false;
    if (!inputState.isPointerDown) {
        inputState.isLongPressTriggered = false;
    }
}

// ==================== 工具函数 ====================

/**
 * Check if pointer is currently hovering over a rectangular area in world space.
 * Useful for card enlargement, tooltips, etc.
 *
 * @param {number} wx - Rect left in world coords
 * @param {number} wy - Rect top in world coords
 * @param {number} w - Rect width
 * @param {number} h - Rect height
 * @returns {boolean} True if pointer is hovering over this rect
 */
function isHoveringWorld(wx, wy, w, h) {
    return pointInRect(inputState.pointerWorldX, inputState.pointerWorldY, wx, wy, w, h);
}

/**
 * Check if pointer is currently hovering over a circular area in world space.
 *
 * @param {number} wx - Circle center X in world coords
 * @param {number} wy - Circle center Y in world coords
 * @param {number} r - Circle radius
 * @returns {boolean}
 */
function isHoveringCircleWorld(wx, wy, r) {
    return pointInCircle(inputState.pointerWorldX, inputState.pointerWorldY, wx, wy, r);
}

/**
 * Check if pointer is hovering over a rectangular area in screen space.
 * Useful for UI elements that don't move with camera.
 *
 * @param {number} sx - Screen X
 * @param {number} sy - Screen Y
 * @param {number} w - Width
 * @param {number} h - Height
 * @returns {boolean}
 */
function isHoveringScreen(sx, sy, w, h) {
    return pointInRect(inputState.pointerScreenX, inputState.pointerScreenY, sx, sy, w, h);
}

/**
 * Get the current drag delta vector (world coords).
 * @returns {{ dx: number, dy: number }}
 */
function inputGetDragDelta() {
    return {
        dx: inputState.dragCurrent.x - inputState.dragStart.x,
        dy: inputState.dragCurrent.y - inputState.dragStart.y
    };
}

/**
 * Get the current drag length (distance in world pixels).
 * @returns {number}
 */
function inputGetDragLength() {
    var delta = inputGetDragDelta();
    return Math.sqrt(delta.dx * delta.dx + delta.dy * delta.dy);
}
