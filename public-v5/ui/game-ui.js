/**
 * game-ui.js — v5.0 UI渲染层 (手游优化版)
 * @module game-ui
 * @description Mobile-first HUD: bottom thumb zone for cards/items, top info zone for stats.
 *   All positions relative to canvas dimensions — works on any screen.
 */
'use strict';

// ==================== Responsive Layout ====================

/**
 * Mobile layout zones (relative to canvas):
 *   TOP ZONE   (0-12%):   HP/MP bars + wave/gold/kills
 *   GAME ZONE  (12-62%):  The game world
 *   ITEM ZONE  (62-71%):  5-slot item bar
 *   CARD ZONE  (71-87%):  6-slot card bar + draw button
 *   SAFE GAP   (87-100%): Reserved for browser toolbar / home indicator
 *
 * Reads CSS env(safe-area-inset-bottom) if available (iOS Safari),
 * detects Feishu/WeChat in-app browser for extra bottom padding,
 * otherwise falls back to a percentage-based estimate.
 */
function uiLayout(canvasW, canvasH) {
    var baseScale = Math.min(canvasW / 360, canvasH / 640);

    // --- Top safe area (iPhone notch / status bar) ---
    var safeTopPx = 0;
    try {
        safeTopPx = parseInt(getComputedStyle(document.body).paddingTop) || 0;
    } catch(e) {}
    if (safeTopPx < 10) {
        // Estimate: 5% of CSS height, min 20px for status bar
        var dpr = window.devicePixelRatio || 1;
        safeTopPx = Math.max((canvasH / dpr) * 0.05, 20);
    }

    // --- Bottom safe area ---
    var safeBottomPx = 0;
    try {
        var cssSafe = getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom');
        if (cssSafe) safeBottomPx = parseInt(cssSafe) || 0;
    } catch(e) {}

    if (safeBottomPx < 10) {
        try {
            safeBottomPx = parseInt(getComputedStyle(document.body).paddingBottom) || 0;
        } catch(e) {}
    }

    var ua = navigator.userAgent || '';
    var isInApp = /Lark|Feishu|MicroMessenger|WeChat|DingTalk/i.test(ua);

    if (safeBottomPx < 10) {
        var dpr2 = window.devicePixelRatio || 1;
        var cssH2 = canvasH / dpr2;
        var pct = isInApp ? 0.12 : 0.07;
        safeBottomPx = Math.max(cssH2 * pct, isInApp ? 55 : 30);
    }
    if (isInApp && safeBottomPx < 55) safeBottomPx = 55;

    var usableH = canvasH - safeBottomPx;

    return {
        scale: baseScale,
        safeTop: safeTopPx,
        safeBottom: safeBottomPx,
        // Card slots (bottom row, centered) — raised for Home Indicator
        cardW: Math.max(44, 48 * baseScale),
        cardH: 60 * baseScale,
        cardGap: 5 * baseScale,
        cardY: usableH - 72 * baseScale,
        // Item slots (above cards) — min 44px tap target
        itemW: Math.max(44, 40 * baseScale),
        itemH: Math.max(44, 40 * baseScale),
        itemGap: 4 * baseScale,
        itemY: usableH - 122 * baseScale,
        // HP/MP bars (below status bar, inside safe area)
        hpY: safeTopPx + 4 * baseScale,
        barW: 130 * baseScale,
        barH: 12 * baseScale,
        barX: 6 * baseScale,
        // Top-right info
        infoX: canvasW - 6 * baseScale,
        // Font sizes
        fsTitle: Math.max(10, 13 * baseScale),
        fsBody: Math.max(9, 11 * baseScale),
        fsSmall: Math.max(8, 9 * baseScale),
        fsMini: Math.max(6, 7 * baseScale)
    };
}

// ==================== Main UI Render ====================

function renderUI(ctx, size) {
    var L = uiLayout(size.w, size.h);
    renderHUD(ctx, L);
    renderBlueprintToggle(ctx, L);
    renderCardSlots(ctx, L);
    renderItemSlots(ctx, L);
    renderBossItems(ctx);
    renderOverflowMode(ctx, L);
    renderTalentPanel(ctx, size);
    renderCultivationUI(ctx);
    renderBlueprint(ctx, size);
    renderGameOver(ctx, size);
    renderMiniInfo(ctx, L);
}

// ==================== HUD ====================

function renderHUD(ctx, L) {
    if (!G.player) return;
    var p = G.player;

    // --- Top backdrop strip (below status bar) ---
    var topH = L.safeTop + 30 * L.scale;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, L.safeTop, ctx.canvas.width, topH - L.safeTop);

    // --- HP bar ---
    var hpPct = p.hp / p.maxHp;
    var hpColor = hpPct > 0.5 ? COLORS.GREEN : hpPct > 0.25 ? COLORS.ORANGE : COLORS.RED;
    var hpY = L.hpY;
    drawProgressBar(ctx, L.barX, hpY, L.barW, L.barH, hpPct, hpColor);
    drawOutlineText(ctx, '❤️ ' + Math.round(p.hp) + '/' + p.maxHp, L.barX + L.barW/2, hpY + L.barH * 0.7, L.fsSmall, COLORS.WHITE, COLORS.BG_DARK, 'center');

    // --- MP bar ---
    var mpY = hpY + L.barH + 3 * L.scale;
    var mpPct = p.mp / p.maxMp;
    drawProgressBar(ctx, L.barX, mpY, L.barW * 0.75, L.barH * 0.7, mpPct, COLORS.CYAN);
    drawOutlineText(ctx, '💧' + Math.round(p.mp), L.barX + L.barW * 0.75/2, mpY + L.barH * 0.5, L.fsMini, COLORS.CYAN, COLORS.BG_DARK, 'center');

    // --- Wave + Gold (top-right) ---
    drawOutlineText(ctx, '🌊 第' + G.chapter + '章' + G.wave + '波', L.infoX, hpY + L.barH * 0.5, L.fsTitle, COLORS.WHITE, COLORS.BG_DARK, 'right');

    // Gold
    var diff = stateGetDifficulty();
    drawOutlineText(ctx, '💰' + G.gold, L.infoX, mpY + L.barH * 0.5, L.fsBody, COLORS.GOLD, COLORS.BG_DARK, 'right');

    // Kills row
    drawOutlineText(ctx, '💀' + G.kills + ' (' + G.killsTowardTalent + '/' + diff.killsPerTalent + '天赋)', L.infoX, mpY + 16 * L.scale, L.fsMini, COLORS.WHITE_30, COLORS.BG_DARK, 'right');

    // Pause button (top-left corner of game area)
    var pauseBtnX = L.barX;
    var pauseBtnY = L.safeTop + 36 * L.scale;
    var pauseBtnSize = 22 * L.scale;
    fillRoundRect(ctx, pauseBtnX, pauseBtnY, pauseBtnSize, pauseBtnSize, 4, 'rgba(0,0,0,0.3)');
    strokeRoundRect(ctx, pauseBtnX, pauseBtnY, pauseBtnSize, pauseBtnSize, 4, 'rgba(255,255,255,0.15)', 1);
    drawOutlineText(ctx, G.paused ? '▶' : '⏸', pauseBtnX + pauseBtnSize/2, pauseBtnY + pauseBtnSize * 0.65, 12 * L.scale, COLORS.WHITE_50, COLORS.BG_DARK, 'center');
    window._pauseBtnRect = {x: pauseBtnX, y: pauseBtnY, w: pauseBtnSize, h: pauseBtnSize};
}

// ==================== 蓝图开关按钮 ====================

/** Small 📋 button in top-right — only visible when blueprint is closed */
function renderBlueprintToggle(ctx, L) {
    if (G.blueprintOpen) {
        window._blueprintToggleRect = null;
        return;
    }
    // Fixed position near right edge, below wave info area
    var btnX = ctx.canvas.width - 34 * L.scale;
    var btnY = 50 * L.scale;
    var btnSize = 26 * L.scale;
    fillRoundRect(ctx, btnX, btnY, btnSize, btnSize, 5, COLORS.BLACK_40);
    strokeRoundRect(ctx, btnX, btnY, btnSize, btnSize, 5, COLORS.WHITE_12, 1);
    drawOutlineText(ctx, '📋', btnX + btnSize/2, btnY + btnSize * 0.65, 14 * L.scale, COLORS.WHITE_50, COLORS.BG_DARK, 'center');
    window._blueprintToggleRect = {x: btnX, y: btnY, w: btnSize, h: btnSize};
}

// ==================== 6格悬浮卡槽 (底部拇指区域) ====================

function renderCardSlots(ctx, L) {
    // Center 6 cards at the bottom
    var totalW = 6 * L.cardW + 5 * L.cardGap;
    var startX = (ctx.canvas.width - totalW) / 2;

    // --- Bottom UI backdrop (dark strip to separate from grid) ---
    var barTop = L.cardY - 8 * L.scale;
    var barH = (L.cardH + 12 * L.scale);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, barTop, ctx.canvas.width, barH);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, barTop, ctx.canvas.width, 1);

    // Label
    var labelX = startX - 6 * L.scale;
    drawOutlineText(ctx, '组件', labelX, L.cardY + L.cardH/2, 8 * L.scale, 'rgba(255,255,255,0.15)', COLORS.BG_DARK, 'right');

    // --- Draw card button (centered above card row) ---
    var canDraw = G.gold >= CARD_DRAW_COST && stateFindEmptyCardSlot() >= 0;
    var drawBtnW = Math.min(L.cardW * 3, ctx.canvas.width * 0.35);
    var drawBtnH = L.cardH * 0.7;
    var drawBtnX = (ctx.canvas.width - drawBtnW) / 2;
    var drawBtnY = L.cardY - drawBtnH - 4 * L.scale;

    fillRoundRect(ctx, drawBtnX, drawBtnY, drawBtnW, drawBtnH, 6, canDraw ? COLORS.GOLD_20 : 'rgba(255,255,255,0.04)');
    if (canDraw && G.overflowReplacing < 0) {
        strokeRoundRect(ctx, drawBtnX, drawBtnY, drawBtnW, drawBtnH, 6, COLORS.GOLD, 2.5);
        drawOutlineText(ctx, '🃏 抽卡 💰' + CARD_DRAW_COST, drawBtnX + drawBtnW/2, drawBtnY + drawBtnH/2 + 4, L.fsSmall, COLORS.GOLD, COLORS.BG_DARK, 'center');
        if (!window._drawBtnPhase) window._drawBtnPhase = 0;
        window._drawBtnPhase += 0.05;
        var pulse = Math.sin(window._drawBtnPhase) * 0.3 + 0.7;
        strokeRoundRect(ctx, drawBtnX - 1, drawBtnY - 1, drawBtnW + 2, drawBtnH + 2, 7, COLORS.GOLD, 1.5 + pulse);
        window._drawCardRect = {x:drawBtnX, y:drawBtnY, w:drawBtnW, h:drawBtnH};
    } else {
        strokeRoundRect(ctx, drawBtnX, drawBtnY, drawBtnW, drawBtnH, 6, 'rgba(255,255,255,0.1)', 1);
        drawOutlineText(ctx, '💰' + CARD_DRAW_COST + ' 抽卡', drawBtnX + drawBtnW/2, drawBtnY + drawBtnH/2 + 4, L.fsMini, 'rgba(255,255,255,0.2)', COLORS.BG_DARK, 'center');
        window._drawCardRect = {x:drawBtnX, y:drawBtnY, w:drawBtnW, h:drawBtnH};
    }

    for (var i = 0; i < 6; i++) {
        var sx = startX + i * (L.cardW + L.cardGap);
        var sy = L.cardY;

        var card = G.cardSlots[i];
        var isHovered = cardsHoveredSlot === i;
        var scale = isHovered ? 1.25 : 1;
        var w = L.cardW * scale, h = L.cardH * scale;
        var dx = sx - (w - L.cardW) / 2;
        var dy = sy - (h - L.cardH);

        if (card) {
            var cardColor;
            switch(card.rarity) {
                case 1: cardColor = '#666'; break;
                case 2: cardColor = '#22c55e'; break;
                case 3: cardColor = '#3b82f6'; break;
                case 4: cardColor = '#8b5cf6'; break;
                case 5: cardColor = '#ffd700'; break;
                default: cardColor = '#666';
            }
            drawMatteCard(ctx, dx, dy, w, h, cardColor, isHovered ? 3 : 1.5);
            drawOutlineText(ctx, card.icon || '?', dx + w/2, dy + h/2 - 5, isHovered ? 16 : 13, COLORS.WHITE, cardColor, 'center');
            drawOutlineText(ctx, card.name || '', dx + w/2, dy + h - 8, isHovered ? 8 : 6, COLORS.WHITE_50, COLORS.BG_DARK, 'center');

            if (isHovered) {
                var popW = 130, popH = 44;
                fillRoundRect(ctx, dx - (popW - w) / 2, dy - popH - 4, popW, popH, 6, COLORS.BLACK_70);
                strokeRoundRect(ctx, dx - (popW - w) / 2, dy - popH - 4, popW, popH, 6, cardColor, 1);
                drawOutlineText(ctx, card.desc || '', dx + w/2, dy - popH/2 + 4, 8, COLORS.WHITE_50, COLORS.BG_DARK, 'center');
                drawOutlineText(ctx, '💲' + (CARD_SELL_BACK[card.rarity]||5), dx + w/2, dy - popH/2 + 18, 8, COLORS.GOLD, COLORS.BG_DARK, 'center');
            }
        } else {
            // Empty slot — visible placeholder
            fillRoundRect(ctx, dx, dy, w, h, 4, 'rgba(255,255,255,0.04)');
            strokeRoundRect(ctx, dx, dy, w, h, 4, 'rgba(255,255,255,0.12)', 1);
            drawOutlineText(ctx, (i + 1), dx + w/2, dy + h/2 + 2, 10, 'rgba(255,255,255,0.08)', COLORS.BG_DARK, 'center');
        }

        // Overflow replacing glow
        if (G.overflowReplacing >= 0) {
            strokeRoundRect(ctx, sx, sy, L.cardW, L.cardH, 4, COLORS.RED, 2);
        }
    }

    // Overflow drag card
    if (cardsDragCard && G.overflowReplacing >= 0) {
        var mx = inputState.pointerScreenX - 25;
        var my = inputState.pointerScreenY - 30;
        drawMatteCard(ctx, mx, my, 50, 60, COLORS.ORANGE, 3);
        drawOutlineText(ctx, cardsDragCard.icon || '?', mx + 25, my + 22, 16, COLORS.WHITE, COLORS.ORANGE, 'center');
        drawOutlineText(ctx, cardsDragCard.name || '', mx + 25, my + 48, 7, COLORS.WHITE_60, COLORS.BG_DARK, 'center');
    }
}

// ==================== 5格道具栏 (卡槽上方) ====================

function renderItemSlots(ctx, L) {
    var totalW = 5 * L.itemW + 4 * L.itemGap;
    var startX = (ctx.canvas.width - totalW) / 2;

    // Item bar backdrop
    var barTop = L.itemY - 4 * L.scale;
    var barH = L.itemH + 8 * L.scale;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, barTop, ctx.canvas.width, barH);

    // Label
    var labelX = startX - 6 * L.scale;
    drawOutlineText(ctx, '道具', labelX, L.itemY + L.itemH/2, 8 * L.scale, 'rgba(255,255,255,0.15)', COLORS.BG_DARK, 'right');

    for (var i = 0; i < 5; i++) {
        var sx = startX + i * (L.itemW + L.itemGap);
        var sy = L.itemY;

        var item = G.itemSlots[i];
        if (item) {
            fillRoundRect(ctx, sx, sy, L.itemW, L.itemH, 4, COLORS.BLACK_30);
            strokeRoundRect(ctx, sx, sy, L.itemW, L.itemH, 4, COLORS.WHITE_15, 1);
            drawOutlineText(ctx, item.icon || '?', sx + L.itemW/2, sy + L.itemH/2 - 3, 13, COLORS.WHITE, COLORS.BG_DARK, 'center');
            drawOutlineText(ctx, (item.name||'').slice(0,3), sx + L.itemW/2, sy + L.itemH - 6, 6, COLORS.WHITE_30, COLORS.BG_DARK, 'center');
        } else {
            fillRoundRect(ctx, sx, sy, L.itemW, L.itemH, 3, 'rgba(255,255,255,0.03)');
            strokeRoundRect(ctx, sx, sy, L.itemW, L.itemH, 3, 'rgba(255,255,255,0.08)', 1);
            drawOutlineText(ctx, (i+1), sx + L.itemW/2, sy + L.itemH/2 + 2, 8, 'rgba(255,255,255,0.06)', COLORS.BG_DARK, 'center');
        }
    }
}

function renderBossItems(ctx) {
    var cam = cameraGetPos();
    for (var i = 0; i < G.bossFollowingItems.length; i++) {
        var item = G.bossFollowingItems[i];
        var sx = item.x - cam.x;
        var sy = item.y - cam.y;
        drawGlow(ctx, sx, sy, 18, COLORS.GOLD, 0.4);
        drawOutlineText(ctx, item.icon || '🚪', sx, sy, 16, COLORS.WHITE, COLORS.BG_DARK, 'center');
    }
}

function renderOverflowMode(ctx, L) {
    if (G.overflowReplacing < 0) return;
    var cx = ctx.canvas.width / 2;
    drawOutlineText(ctx, '🔄 点击卡槽替换 | 新卡: ' + (cardsDragCard ? cardsDragCard.name : ''), cx, ctx.canvas.height - 78 * L.scale, L.fsSmall, COLORS.ORANGE, COLORS.BG_DARK, 'center');
}

// ==================== 天赋面板 ====================

function renderTalentPanel(ctx, size) {
    if (!G.talentPanelOpen || G.talentChoices.length === 0) return;

    ctx.fillStyle = COLORS.BLACK_40;
    ctx.fillRect(0, 0, size.w, size.h);

    var panelW = Math.min(300, size.w - 20);
    var panelH = 220;
    var px = (size.w - panelW) / 2;
    var py = (size.h - panelH) / 2;

    fillRoundRect(ctx, px, py, panelW, panelH, 12, '#1a1a3a');
    strokeRoundRect(ctx, px, py, panelW, panelH, 12, COLORS.PURPLE, 2);
    drawOutlineText(ctx, '🌟 选择天赋 (消耗杀敌数)', px + panelW/2, py + 20, 14, COLORS.WHITE, COLORS.BG_DARK, 'center');

    for (var i = 0; i < G.talentChoices.length; i++) {
        var t = G.talentChoices[i];
        var ty = py + 45 + i * 55;
        fillRoundRect(ctx, px + 15, ty, panelW - 30, 45, 6, COLORS.WHITE_06);
        strokeRoundRect(ctx, px + 15, ty, panelW - 30, 45, 6, COLORS.WHITE_15, 1);
        drawOutlineText(ctx, t.icon + ' ' + t.name, px + 30, ty + 14, 13, COLORS.WHITE, COLORS.BG_DARK);
        drawOutlineText(ctx, t.desc, px + 30, ty + 32, 10, COLORS.WHITE_40, COLORS.BG_DARK);

        if (!window._talentRects) window._talentRects = [];
        window._talentRects[i] = {x:px+15, y:ty, w:panelW-30, h:45};
    }
}

// ==================== 修仙专属UI ====================

function renderCultivationUI(ctx) {
    if (!stateIsCultivation() || !G.player) return;

    var hero = stateGetHero();
    var ui = hero.cultivationUI;
    if (!ui) return;

    var cx = ctx.canvas.width / 2;
    var L = uiLayout(ctx.canvas.width, ctx.canvas.height);
    var s = L.scale;

    // Compact floating panel — centered, constrained to canvas
    var uw = Math.min(280 * s, ctx.canvas.width * 0.7);
    var ux = cx - uw / 2;
    var uy = 55 * s;

    // Ensure panel doesn't overflow right edge
    if (ux + uw > ctx.canvas.width - 4 * s) {
        ux = ctx.canvas.width - uw - 4 * s;
    }
    if (ux < 4 * s) {
        ux = 4 * s;
    }

    fillRoundRect(ctx, ux, uy, uw, 40 * s, 8, COLORS.BLACK_70);
    strokeRoundRect(ctx, ux, uy, uw, 40 * s, 8, COLORS.PURPLE, 1);
    drawOutlineText(ctx, ui.weaponIcon + ' 修仙武器 Lv.' + G.cultivationWeaponLevel, ux + uw/2, uy + 16 * s, 12 * s, COLORS.WHITE, COLORS.BG_DARK, 'center');
    drawOutlineText(ctx, '升级 ' + G.cultivationWeaponUpgrades + '次  | 回收', ux + uw/2, uy + 32 * s, 10 * s, COLORS.GREEN, COLORS.BG_DARK, 'center');

    // L2 selection panel (below if active)
    if (!G.cultivationL2Path && G.cultivationL2Pool.length > 0 && G.cultivationRecycleCount >= 5) {
        var selY = uy + 48 * s;
        for (var i = 0; i < G.cultivationL2Pool.length; i++) {
            var c2 = G.cultivationL2Pool[i];
            fillRoundRect(ctx, ux, selY + i * 32 * s, uw, 28 * s, 4, COLORS.WHITE_06);
            strokeRoundRect(ctx, ux, selY + i * 32 * s, uw, 28 * s, 4, COLORS.WHITE_15, 1);
            drawOutlineText(ctx, c2.icon + ' ' + c2.name, ux + uw/2, selY + i * 32 * s + 16 * s, 10 * s, COLORS.WHITE, COLORS.BG_DARK, 'center');
        }
        window._cultivationL2Rects = G.cultivationL2Pool.map(function(c,i){return {x:ux, y:selY+i*32*s, w:uw, h:28*s, index:i};});
    } else {
        window._cultivationL2Rects = null;
    }
}

// ==================== 英雄蓝图侧边栏 ====================

function renderBlueprint(ctx, size) {
    if (!G.blueprintOpen) return;

    var L = uiLayout(size.w, size.h);
    var bw = Math.min(260 * L.scale, size.w * 0.38);
    var bx = size.w - bw;

    // Dim background
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, size.w, size.h);

    fillRoundRect(ctx, bx, 0, bw, size.h, 0, 'rgba(10,10,30,0.97)');
    strokeRoundRect(ctx, bx, 0, bw, size.h, 0, COLORS.WHITE_08, 2);

    var hero = stateGetHero();
    var yo = 52 * L.scale;

    // Close X button
    var closeX = bx + bw - 18 * L.scale;
    var closeY = 10 * L.scale;
    drawOutlineText(ctx, '✕', closeX, closeY + 12 * L.scale, 16 * L.scale, COLORS.WHITE_40, COLORS.BG_DARK, 'center');
    window._blueprintCloseRect = {x: closeX - 14 * L.scale, y: closeY, w: 30 * L.scale, h: 30 * L.scale};

    drawOutlineText(ctx, hero.icon + ' ' + hero.name, bx + 16 * L.scale, yo, 14 * L.scale, hero.color, COLORS.BG_DARK);
    yo += 22 * L.scale;

    drawOutlineText(ctx, '══ 核心组件 ══', bx + 10 * L.scale, yo, 10 * L.scale, COLORS.WHITE_40, COLORS.BG_DARK);
    yo += 16 * L.scale;

    var hasCards = false;
    for (var i = 0; i < 6; i++) {
        var card = G.cardSlots[i];
        if (card) {
            hasCards = true;
            drawOutlineText(ctx, card.icon + ' ' + card.name, bx + 18 * L.scale, yo, 9 * L.scale, COLORS.WHITE_60, COLORS.BG_DARK);
            yo += 15 * L.scale;
        }
    }
    if (!hasCards) {
        drawOutlineText(ctx, '(空的 — 抽卡获取组件)', bx + 18 * L.scale, yo, 8 * L.scale, COLORS.WHITE_20, COLORS.BG_DARK);
        yo += 12 * L.scale;
    }

    yo += 6 * L.scale;
    drawOutlineText(ctx, '══ 外挂模块 ══', bx + 10 * L.scale, yo, 10 * L.scale, COLORS.WHITE_40, COLORS.BG_DARK);
    yo += 16 * L.scale;

    if (G.talents.length > 0) {
        for (i = 0; i < G.talents.length; i++) {
            drawOutlineText(ctx, G.talents[i].icon + ' ' + G.talents[i].name, bx + 18 * L.scale, yo, 9 * L.scale, COLORS.WHITE_60, COLORS.BG_DARK);
            yo += 13 * L.scale;
        }
    } else {
        drawOutlineText(ctx, '(无天赋)', bx + 18 * L.scale, yo, 8 * L.scale, COLORS.WHITE_20, COLORS.BG_DARK);
        yo += 12 * L.scale;
    }

    if (stateIsCultivation() && G.cultivationL3.length > 0) {
        yo += 6 * L.scale;
        drawOutlineText(ctx, '══ 羁绊回路 ══', bx + 10 * L.scale, yo, 10 * L.scale, COLORS.WHITE_40, COLORS.BG_DARK);
        yo += 16 * L.scale;
        for (i = 0; i < G.cultivationL3.length; i++) {
            drawOutlineText(ctx, G.cultivationL3[i].icon + ' ' + G.cultivationL3[i].name, bx + 18 * L.scale, yo, 8 * L.scale, COLORS.PURPLE, COLORS.BG_DARK);
            yo += 13 * L.scale;
        }
    }

    // Blueprint toggle button (small, top-right of game area)
    var toggleBtnX = size.w - bw - 22 * L.scale;
    var toggleBtnY = 10 * L.scale;
    fillRoundRect(ctx, toggleBtnX, toggleBtnY, 20 * L.scale, 20 * L.scale, 4, COLORS.WHITE_08);
    drawOutlineText(ctx, '📋', toggleBtnX + 10 * L.scale, toggleBtnY + 14 * L.scale, 11 * L.scale, COLORS.WHITE_40, COLORS.BG_DARK, 'center');
    window._blueprintToggleRect = {x: toggleBtnX, y: toggleBtnY, w: 20 * L.scale, h: 20 * L.scale};
}

// ==================== 游戏结束面板 ====================

function renderGameOver(ctx, size) {
    if (G.phase !== 'over') return;

    ctx.fillStyle = COLORS.BLACK_70;
    ctx.fillRect(0, 0, size.w, size.h);

    var L = uiLayout(size.w, size.h);
    var pw = Math.min(280, size.w - 20);
    var ph = 300 * L.scale;
    var px = (size.w - pw) / 2, py = (size.h - ph) / 2;
    fillRoundRect(ctx, px, py, pw, ph, 16, '#1a1a3a');
    strokeRoundRect(ctx, px, py, pw, ph, 16, COLORS.PURPLE, 2);

    var hero = stateGetHero();
    var grade = G.score > 5000 ? 'S' : G.score > 3000 ? 'A' : G.score > 1500 ? 'B' : 'C';

    drawOutlineText(ctx, hero.icon + ' ' + hero.name, px + pw/2, py + 24, 18 * L.scale, hero.color, COLORS.BG_DARK, 'center');
    drawOutlineText(ctx, grade + ' 级评价', px + pw/2, py + 50, 22 * L.scale, COLORS.GOLD, COLORS.BG_DARK, 'center');
    drawOutlineText(ctx, '得分: ' + Math.round(G.score), px + pw/2, py + 76, 14 * L.scale, COLORS.WHITE, COLORS.BG_DARK, 'center');

    var iy = py + 100;
    var rows = [
        ['💀 击杀', G.finalKills],
        ['🌊 最高波次', G.finalWave],
        ['⏱️ 存活时间', formatTime(G.finalTime)],
        ['⚔️ 难度', (DIFFICULTY[G.difficulty]||{}).name||'未知']
    ];
    for (var r = 0; r < rows.length; r++) {
        drawOutlineText(ctx, rows[r][0] + ': ' + rows[r][1], px + pw/2, iy + r * 24 * L.scale, 12 * L.scale, COLORS.WHITE_50, COLORS.BG_DARK, 'center');
    }

    var btnX = px + 40 * L.scale, btnY = py + ph - 50 * L.scale, btnW = pw - 80 * L.scale, btnH = 36 * L.scale;
    fillRoundRect(ctx, btnX, btnY, btnW, btnH, 8, COLORS.CYAN);
    drawOutlineText(ctx, '🔄 再来一局', btnX + btnW/2, btnY + btnH/2, 14 * L.scale, COLORS.WHITE, COLORS.CYAN, 'center');
    window._retryRect = {x:btnX, y:btnY, w:btnW, h:btnH};
}

function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

// ==================== 小地图信息 ====================

function renderMiniInfo(ctx, L) {
    var cx = ctx.canvas.width / 2;
    if (G.monsters.length > 0) {
        drawOutlineText(ctx, '👾×' + G.monsters.length, cx, ctx.canvas.height - 120 * L.scale, 9 * L.scale, COLORS.WHITE_20, COLORS.BG_DARK, 'center');
    }
    // Wave time remaining
    if (G.waveEndTime > 0) {
        var remain = Math.max(0, Math.ceil((G.waveEndTime - G.time)));
        if (remain > 0) {
            drawOutlineText(ctx, '⏱' + remain + 's', cx, ctx.canvas.height - 133 * L.scale, 10 * L.scale, COLORS.WHITE_30, COLORS.BG_DARK, 'center');
        }
    }
}
