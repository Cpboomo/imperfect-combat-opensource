/**
 * game-ui.js — v5.1 手游UI重设计
 * @module game-ui
 * @description Mobile-first HUD: unified bottom panel for cards/items/draw,
 *   compact top bar for stats. Fixed 390×844 phone portrait resolution.
 */
'use strict';

// ==================== Layout ====================

/**
 * Fixed phone portrait layout (390×844).
 *
 * Zones:
 *   Y=0-60    SAFE TOP (Feishu nav bar)
 *   Y=60-100  HUD BAR (HP/MP + wave/gold/kills + pause)
 *   Y=100-430 GAME WORLD
 *   Y=430-660 BOTTOM PANEL (items + cards + draw button)
 *   Y=660-744 BUFFER (Feishu bottom toolbar)
 */
function uiLayout(canvasW, canvasH) {
    var dpr = window.devicePixelRatio || 1;
    var cssW = canvasW / dpr;
    var cssH = canvasH / dpr;

    var ua = navigator.userAgent || '';
    var isInApp = /Lark|Feishu|MicroMessenger|WeChat|DingTalk/i.test(ua);

    // Safe areas
    var safeTop = parseInt(getComputedStyle(document.body).paddingTop) || 44;
    if (isInApp && safeTop < 60) safeTop = 60;
    var safeBottom = parseInt(getComputedStyle(document.body).paddingBottom) || 0;
    if (isInApp) safeBottom = Math.max(safeBottom, 100);
    else if (safeBottom < 10) safeBottom = 34;

    var usableH = cssH - safeBottom;

    return {
        cssW: cssW, cssH: cssH,
        safeTop: safeTop, safeBottom: safeBottom,

        // === HUD (top bar) ===
        hudY: safeTop + 4,
        hudH: 36,
        barW: 150,
        barH: 14,
        barX: 8,
        barGap: 3,
        infoX: cssW - 10,

        // === Bottom panel ===
        panelY: usableH - 230,
        panelH: 230,

        // Item slots (top of panel)
        itemW: 48, itemH: 48,
        itemGap: 6,
        itemY: usableH - 218,

        // Card slots (middle of panel)
        cardW: 56, cardH: 70,
        cardGap: 6,
        cardY: usableH - 158,

        // Draw button (bottom of panel)
        drawW: 240, drawH: 52,
        drawY: usableH - 72,

        // Overflow hint
        overflowY: usableH - 246,

        // === Font sizes ===
        fsTitle: 14,
        fsBody: 12,
        fsSmall: 10,
        fsMini: 8
    };
}

// ==================== Main Render ====================

function renderUI(ctx, size) {
    var L = uiLayout(size.w, size.h);
    _safeCall(function(){ renderHUD(ctx, L); });
    _safeCall(function(){ renderBottomPanel(ctx, L); });
    _safeCall(function(){ renderBossItems(ctx); });
    _safeCall(function(){ renderOverflowMode(ctx, L); });
    _safeCall(function(){ renderTalentPanel(ctx, size); });
    _safeCall(function(){ renderCultivationUI(ctx); });
    _safeCall(function(){ renderBlueprint(ctx, size); });
    _safeCall(function(){ renderGameOver(ctx, size); });
}

function _safeCall(fn) {
    try { fn(); } catch(e) {
        if (!window.__safeCallErrors) window.__safeCallErrors = {};
        var name = (e.stack || '').split('\n')[1] || '';
        var key = name.trim().split(' ')[0] || '?';
        if (!window.__safeCallErrors[key]) {
            window.__safeCallErrors[key] = true;
            console.warn('[renderUI] ' + key + ': ' + e.message);
        }
    }
}

// ==================== HUD (Top Bar) ====================

function renderHUD(ctx, L) {
    if (!G.player) return;
    var p = G.player;

    // Background strip
    var hudBot = L.safeTop + 40;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, L.safeTop, L.cssW, 40);
    // Subtle gradient bottom edge
    var grad = ctx.createLinearGradient(0, hudBot - 4, 0, hudBot);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, hudBot - 4, L.cssW, 4);

    var by = L.hudY;

    // HP bar
    var hpPct = p.hp / p.maxHp;
    var hpColor = hpPct > 0.5 ? COLORS.GREEN : hpPct > 0.25 ? COLORS.ORANGE : COLORS.RED;
    drawProgressBar(ctx, L.barX, by, L.barW, L.barH, hpPct, hpColor);
    drawOutlineText(ctx, '♥ ' + Math.round(p.hp) + '/' + p.maxHp,
        L.barX + L.barW / 2, by + L.barH * 0.7, L.fsSmall, COLORS.WHITE, COLORS.BG_DARK, 'center');

    // MP bar
    var mpy = by + L.barH + L.barGap;
    var mpPct = p.mp / p.maxMp;
    drawProgressBar(ctx, L.barX, mpy, L.barW * 0.8, L.barH * 0.7, mpPct, COLORS.CYAN);
    drawOutlineText(ctx, '♦ ' + Math.round(p.mp), L.barX + L.barW * 0.4,
        mpy + L.barH * 0.5, L.fsMini, COLORS.CYAN, COLORS.BG_DARK, 'center');

    // Wave + chapter (top-right)
    drawOutlineText(ctx, '⚔ 第' + G.chapter + '章' + G.wave + '波',
        L.infoX, by + L.barH * 0.5, L.fsTitle, COLORS.WHITE, COLORS.BG_DARK, 'right');

    // Gold
    drawOutlineText(ctx, '💰' + G.gold, L.infoX, mpy + L.barH * 0.5,
        L.fsBody, COLORS.GOLD, COLORS.BG_DARK, 'right');

    // Kills + talent progress
    var diff = stateGetDifficulty();
    drawOutlineText(ctx, '💀' + G.kills + ' (' + G.killsTowardTalent + '/' + diff.killsPerTalent + ')',
        L.infoX, mpy + 14, L.fsMini, COLORS.WHITE_20, COLORS.BG_DARK, 'right');

    // Pause button (top-left, below HUD bar)
    var psz = 26;
    var pbx = L.barX;
    var pby = L.safeTop + 44;
    fillRoundRect(ctx, pbx, pby, psz, psz, 5, COLORS.BLACK_40);
    strokeRoundRect(ctx, pbx, pby, psz, psz, 5, COLORS.WHITE_08, 1);
    drawOutlineText(ctx, G.paused ? '▶' : '⏸', pbx + psz / 2, pby + psz * 0.62,
        13, COLORS.WHITE_40, COLORS.BG_DARK, 'center');
    window._pauseBtnRect = { x: pbx, y: pby, w: psz, h: psz };

    // 📋 Blueprint toggle (next to pause)
    if (!G.blueprintOpen) {
        var bbx = pbx + psz + 4;
        fillRoundRect(ctx, bbx, pby, psz, psz, 5, COLORS.BLACK_40);
        strokeRoundRect(ctx, bbx, pby, psz, psz, 5, COLORS.WHITE_08, 1);
        drawOutlineText(ctx, '📋', bbx + psz / 2, pby + psz * 0.62,
            14, COLORS.WHITE_40, COLORS.BG_DARK, 'center');
        window._blueprintToggleRect = { x: bbx, y: pby, w: psz, h: psz };
    } else {
        window._blueprintToggleRect = null;
    }
}

// ==================== Bottom Panel (Unified) ====================

function renderBottomPanel(ctx, L) {
    // === Unified backdrop ===
    var py = L.panelY;
    var ph = L.panelH;

    // Main panel background (more opaque for visibility)
    ctx.fillStyle = 'rgba(4,4,16,0.93)';
    ctx.fillRect(0, py, L.cssW, ph);

    // Top border glow
    strokeRoundRect(ctx, 0, py, L.cssW, 1, 0, 'rgba(139,92,246,0.5)', 1.5);
    var grad = ctx.createLinearGradient(0, py + 1, 0, py + 5);
    grad.addColorStop(0, 'rgba(139,92,246,0.3)');
    grad.addColorStop(1, 'rgba(139,92,246,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, py + 1, L.cssW, 4);

    // === Item slots (top section of panel) ===
    var itemTotalW = 5 * L.itemW + 4 * L.itemGap;
    var itemStartX = (L.cssW - itemTotalW) / 2;

    // Label
    drawOutlineText(ctx, '道具', 10, L.itemY + L.itemH / 2,
        9, 'rgba(255,255,255,0.25)', COLORS.BG_DARK, 'left');

    for (var i = 0; i < 5; i++) {
        var ix = itemStartX + i * (L.itemW + L.itemGap);
        var iy = L.itemY;

        var item = G.itemSlots[i];
        if (item) {
            fillRoundRect(ctx, ix, iy, L.itemW, L.itemH, 6, 'rgba(255,255,255,0.08)');
            strokeRoundRect(ctx, ix, iy, L.itemW, L.itemH, 6, COLORS.WHITE_12, 1.5);
            drawOutlineText(ctx, item.icon || '📦', ix + L.itemW / 2, iy + L.itemH / 2 - 4,
                16, COLORS.WHITE, COLORS.BG_DARK, 'center');
            drawOutlineText(ctx, (item.name || '').slice(0, 3), ix + L.itemW / 2, iy + L.itemH - 7,
                7, COLORS.WHITE_40, COLORS.BG_DARK, 'center');
        } else {
            // Empty slot — more visible placeholder
            fillRoundRect(ctx, ix, iy, L.itemW, L.itemH, 5, 'rgba(255,255,255,0.04)');
            strokeRoundRect(ctx, ix, iy, L.itemW, L.itemH, 5, 'rgba(255,255,255,0.15)', 1.5);
            drawOutlineText(ctx, '' + (i + 1), ix + L.itemW / 2, iy + L.itemH / 2 + 2,
                10, 'rgba(255,255,255,0.12)', COLORS.BG_DARK, 'center');
        }
    }

    // === Card slots (middle section of panel) ===
    var cardTotalW = 6 * L.cardW + 5 * L.cardGap;
    var cardStartX = (L.cssW - cardTotalW) / 2;

    // Label
    drawOutlineText(ctx, '组件', 10, L.cardY + L.cardH / 2,
        9, 'rgba(255,255,255,0.25)', COLORS.BG_DARK, 'left');

    for (var j = 0; j < 6; j++) {
        var cx = cardStartX + j * (L.cardW + L.cardGap);
        var cy = L.cardY;

        var card = G.cardSlots[j];
        var isHovered = cardsHoveredSlot === j;
        var sc = isHovered ? 1.18 : 1;
        var cw = L.cardW * sc, ch = L.cardH * sc;
        var dx = cx - (cw - L.cardW) / 2;
        var dy = cy - (ch - L.cardH);

        if (card) {
            var cardColor;
            switch (card.rarity) {
                case 1: cardColor = '#555'; break;
                case 2: cardColor = '#22c55e'; break;
                case 3: cardColor = '#3b82f6'; break;
                case 4: cardColor = '#8b5cf6'; break;
                case 5: cardColor = '#ffd700'; break;
                default: cardColor = '#555';
            }

            // Rarity glow behind card
            if (card.rarity >= 2) {
                var glowAlpha = card.rarity >= 4 ? 0.15 : 0.08;
                drawGlow(ctx, dx + cw / 2, dy + ch / 2, cw * 0.7, cardColor, glowAlpha);
            }

            drawMatteCard(ctx, dx, dy, cw, ch, cardColor, isHovered ? 3 : 1.5);

            // Icon (larger)
            drawOutlineText(ctx, card.icon || '?', dx + cw / 2, dy + ch / 2 - 6,
                isHovered ? 18 : 15, COLORS.WHITE, cardColor, 'center');

            // Name
            drawOutlineText(ctx, card.name || '', dx + cw / 2, dy + ch - 9,
                isHovered ? 8 : 7, COLORS.WHITE_60, COLORS.BG_DARK, 'center');

            // Hover tooltip
            if (isHovered) {
                var tw = 140, th = 48;
                fillRoundRect(ctx, dx - (tw - cw) / 2, dy - th - 6, tw, th, 8, COLORS.BLACK_70);
                strokeRoundRect(ctx, dx - (tw - cw) / 2, dy - th - 6, tw, th, 8, cardColor, 1.5);
                drawOutlineText(ctx, card.desc || '', dx + cw / 2, dy - th / 2 + 2,
                    8, COLORS.WHITE_60, COLORS.BG_DARK, 'center');
                drawOutlineText(ctx, '💲' + (CARD_SELL_BACK[card.rarity] || 5), dx + cw / 2,
                    dy - th / 2 + 17, 8, COLORS.GOLD, COLORS.BG_DARK, 'center');
            }
        } else {
            // Empty card slot — more visible
            fillRoundRect(ctx, dx, dy, cw, ch, 6, 'rgba(255,255,255,0.05)');
            strokeRoundRect(ctx, dx, dy, cw, ch, 6, 'rgba(255,255,255,0.18)', 1.5);
            drawOutlineText(ctx, '' + (j + 1), dx + cw / 2, dy + ch / 2 + 2,
                13, 'rgba(255,255,255,0.15)', COLORS.BG_DARK, 'center');
        }

        // Overflow highlight
        if (G.overflowReplacing >= 0 && j === G.overflowReplacing) {
            strokeRoundRect(ctx, cx - 1, cy - 1, L.cardW + 2, L.cardH + 2, 6, COLORS.RED, 2.5);
        }
    }

    // === Draw card button (bottom of panel) ===
    var canDraw = G.gold >= CARD_DRAW_COST && stateFindEmptyCardSlot() >= 0;
    var dxb = (L.cssW - L.drawW) / 2;
    var dyb = L.drawY;

    if (canDraw && G.overflowReplacing < 0) {
        // Active draw button — gradient fill
        var dgrad = ctx.createLinearGradient(dxb, dyb, dxb + L.drawW, dyb);
        dgrad.addColorStop(0, '#8b5cf6');
        dgrad.addColorStop(0.5, '#a78bfa');
        dgrad.addColorStop(1, '#8b5cf6');
        fillRoundRect(ctx, dxb, dyb, L.drawW, L.drawH, 10, dgrad);
        strokeRoundRect(ctx, dxb, dyb, L.drawW, L.drawH, 10, COLORS.GOLD, 2.5);

        // Pulsing outer glow
        if (!window._drawBtnPhase) window._drawBtnPhase = 0;
        window._drawBtnPhase += 0.06;
        var pulse = Math.sin(window._drawBtnPhase) * 0.25 + 0.75;
        strokeRoundRect(ctx, dxb - 2, dyb - 2, L.drawW + 4, L.drawH + 4, 11,
            'rgba(139,92,246,' + pulse.toFixed(2) + ')', 2);

        drawOutlineText(ctx, '🃏 抽 卡', dxb + L.drawW / 2, dyb + L.drawH / 2 - 7,
            16, COLORS.WHITE, COLORS.PURPLE, 'center');
        drawOutlineText(ctx, '💰' + CARD_DRAW_COST, dxb + L.drawW / 2, dyb + L.drawH / 2 + 11,
            10, COLORS.GOLD, COLORS.PURPLE, 'center');
        window._drawCardRect = { x: dxb, y: dyb, w: L.drawW, h: L.drawH };
    } else {
        // Inactive draw button — still visible
        fillRoundRect(ctx, dxb, dyb, L.drawW, L.drawH, 10, 'rgba(139,92,246,0.2)');
        strokeRoundRect(ctx, dxb, dyb, L.drawW, L.drawH, 10,
            'rgba(139,92,246,0.3)', 2);
        drawOutlineText(ctx, '💰' + CARD_DRAW_COST + ' 抽卡', dxb + L.drawW / 2,
            dyb + L.drawH / 2 + 4, 14, 'rgba(255,255,255,0.35)', COLORS.BG_DARK, 'center');
        window._drawCardRect = { x: dxb, y: dyb, w: L.drawW, h: L.drawH };
    }

    // === Overflow drag card ===
    if (cardsDragCard && G.overflowReplacing >= 0) {
        var mx = inputState.pointerScreenX - 28;
        var my = inputState.pointerScreenY - 35;
        drawMatteCard(ctx, mx, my, 56, 70, COLORS.ORANGE, 3);
        drawOutlineText(ctx, cardsDragCard.icon || '?', mx + 28, my + 26, 18,
            COLORS.WHITE, COLORS.ORANGE, 'center');
        drawOutlineText(ctx, cardsDragCard.name || '', mx + 28, my + 55, 7,
            COLORS.WHITE_60, COLORS.BG_DARK, 'center');
    }
}

// ==================== Overlay Panels ====================

function renderBossItems(ctx) {
    var cam = cameraGetPos();
    for (var i = 0; i < G.bossFollowingItems.length; i++) {
        var item = G.bossFollowingItems[i];
        var sx = item.x - cam.x;
        var sy = item.y - cam.y;
        drawGlow(ctx, sx, sy, 20, COLORS.GOLD, 0.4);
        drawOutlineText(ctx, item.icon || '🚪', sx, sy, 18,
            COLORS.WHITE, COLORS.BG_DARK, 'center');
    }
}

function renderOverflowMode(ctx, L) {
    if (G.overflowReplacing < 0) return;
    drawOutlineText(ctx, '🔄 点击卡槽替换 | 新卡: ' + (cardsDragCard ? cardsDragCard.name : ''),
        L.cssW / 2, L.overflowY, L.fsSmall, COLORS.ORANGE, COLORS.BG_DARK, 'center');
}

function renderTalentPanel(ctx, size) {
    if (!G.talentPanelOpen || G.talentChoices.length === 0) return;

    ctx.fillStyle = COLORS.BLACK_40;
    ctx.fillRect(0, 0, size.w, size.h);

    var pw = Math.min(320, size.w - 30);
    var ph = 230;
    var px = (size.w - pw) / 2;
    var py = (size.h - ph) / 2;

    fillRoundRect(ctx, px, py, pw, ph, 14, '#151530');
    strokeRoundRect(ctx, px, py, pw, ph, 14, COLORS.PURPLE, 2.5);
    drawOutlineText(ctx, '🌟 选择天赋 (消耗杀敌数)', px + pw / 2, py + 24,
        15, COLORS.WHITE, COLORS.BG_DARK, 'center');

    for (var i = 0; i < G.talentChoices.length; i++) {
        var t = G.talentChoices[i];
        var ty = py + 50 + i * 60;
        fillRoundRect(ctx, px + 15, ty, pw - 30, 50, 8, COLORS.WHITE_06);
        strokeRoundRect(ctx, px + 15, ty, pw - 30, 50, 8, COLORS.WHITE_12, 1);
        drawOutlineText(ctx, t.icon + ' ' + t.name, px + 30, ty + 16,
            14, COLORS.WHITE, COLORS.BG_DARK);
        drawOutlineText(ctx, t.desc, px + 30, ty + 36,
            10, COLORS.WHITE_40, COLORS.BG_DARK);

        if (!window._talentRects) window._talentRects = [];
        window._talentRects[i] = { x: px + 15, y: ty, w: pw - 30, h: 50 };
    }
}

function renderCultivationUI(ctx) {
    if (!stateIsCultivation() || !G.player) return;

    var hero = stateGetHero();
    var ui = hero.cultivationUI;
    if (!ui) return;

    var L2 = uiLayout(ctx.canvas.width, ctx.canvas.height);

    // Compact floating panel
    var uw = Math.min(280, L2.cssW - 80);
    var ux = (L2.cssW - uw) / 2;
    var uy = L2.safeTop + 50;

    fillRoundRect(ctx, ux, uy, uw, 48, 10, COLORS.BLACK_70);
    strokeRoundRect(ctx, ux, uy, uw, 48, 10, COLORS.PURPLE, 2);
    drawOutlineText(ctx, ui.weaponIcon + ' 修仙武器 Lv.' + G.cultivationWeaponLevel,
        ux + uw / 2, uy + 18, 13, COLORS.WHITE, COLORS.BG_DARK, 'center');
    drawOutlineText(ctx, '升级 ' + G.cultivationWeaponUpgrades + '次  |  回收',
        ux + uw / 2, uy + 36, 10, COLORS.GREEN, COLORS.BG_DARK, 'center');

    // L2 selection
    if (!G.cultivationL2Path && G.cultivationL2Pool.length > 0 && G.cultivationRecycleCount >= 5) {
        var sy = uy + 56;
        for (var i = 0; i < G.cultivationL2Pool.length; i++) {
            var c2 = G.cultivationL2Pool[i];
            fillRoundRect(ctx, ux, sy + i * 36, uw, 32, 6, COLORS.WHITE_06);
            strokeRoundRect(ctx, ux, sy + i * 36, uw, 32, 6, COLORS.WHITE_15, 1);
            drawOutlineText(ctx, c2.icon + ' ' + c2.name, ux + uw / 2,
                sy + i * 36 + 18, 11, COLORS.WHITE, COLORS.BG_DARK, 'center');
        }
        window._cultivationL2Rects = G.cultivationL2Pool.map(function (c, k) {
            return { x: ux, y: sy + k * 36, w: uw, h: 32, index: k };
        });
    } else {
        window._cultivationL2Rects = null;
    }
}

function renderBlueprint(ctx, size) {
    if (!G.blueprintOpen) return;

    var L = uiLayout(size.w, size.h);
    var bw = Math.min(260, size.w * 0.42);
    var bx = size.w - bw;

    // Dim overlay
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, size.w, size.h);

    // Sidebar
    fillRoundRect(ctx, bx, 0, bw, size.h, 0, 'rgba(10,10,30,0.97)');
    strokeRoundRect(ctx, bx, 0, bw, size.h, 0, COLORS.WHITE_08, 2);

    var hero = stateGetHero();
    var yo = L.safeTop + 14;

    // Close X
    var clx = bx + bw - 24, cly = yo;
    fillRoundRect(ctx, clx - 8, cly - 4, 28, 28, 6, COLORS.BLACK_40);
    strokeRoundRect(ctx, clx - 8, cly - 4, 28, 28, 6, COLORS.WHITE_08, 1);
    drawOutlineText(ctx, '✕', clx + 6, cly + 6, 14, COLORS.WHITE_40, COLORS.BG_DARK, 'center');
    window._blueprintCloseRect = { x: clx - 10, y: cly - 6, w: 32, h: 32 };

    yo += 8;
    drawOutlineText(ctx, hero.icon + ' ' + hero.name, bx + 16, yo, 14, hero.color, COLORS.BG_DARK);
    yo += 24;
    drawOutlineText(ctx, '══ 核心组件 ══', bx + 14, yo, 10, COLORS.WHITE_40, COLORS.BG_DARK);
    yo += 18;

    var hasCards = false;
    for (var i = 0; i < 6; i++) {
        var card = G.cardSlots[i];
        if (card) {
            hasCards = true;
            drawOutlineText(ctx, card.icon + ' ' + card.name, bx + 18, yo, 10, COLORS.WHITE_60, COLORS.BG_DARK);
            yo += 16;
        }
    }
    if (!hasCards) {
        drawOutlineText(ctx, '(空的 — 抽卡获取)', bx + 18, yo, 9, COLORS.WHITE_20, COLORS.BG_DARK);
        yo += 14;
    }

    yo += 8;
    drawOutlineText(ctx, '══ 外挂模块 ══', bx + 14, yo, 10, COLORS.WHITE_40, COLORS.BG_DARK);
    yo += 18;

    if (G.talents.length > 0) {
        for (i = 0; i < G.talents.length; i++) {
            drawOutlineText(ctx, G.talents[i].icon + ' ' + G.talents[i].name,
                bx + 18, yo, 10, COLORS.WHITE_60, COLORS.BG_DARK);
            yo += 15;
        }
    } else {
        drawOutlineText(ctx, '(无天赋)', bx + 18, yo, 9, COLORS.WHITE_20, COLORS.BG_DARK);
        yo += 14;
    }

    if (stateIsCultivation() && G.cultivationL3.length > 0) {
        yo += 8;
        drawOutlineText(ctx, '══ 羁绊回路 ══', bx + 14, yo, 10, COLORS.WHITE_40, COLORS.BG_DARK);
        yo += 18;
        for (i = 0; i < G.cultivationL3.length; i++) {
            drawOutlineText(ctx, G.cultivationL3[i].icon + ' ' + G.cultivationL3[i].name,
                bx + 18, yo, 9, COLORS.PURPLE, COLORS.BG_DARK);
            yo += 14;
        }
    }
}

function renderGameOver(ctx, size) {
    if (G.phase !== 'over') return;

    ctx.fillStyle = COLORS.BLACK_70;
    ctx.fillRect(0, 0, size.w, size.h);

    var L = uiLayout(size.w, size.h);
    var pw = Math.min(290, size.w - 24);
    var ph = 290;
    var px = (size.w - pw) / 2, py = (size.h - ph) / 2;

    fillRoundRect(ctx, px, py, pw, ph, 18, '#151530');
    strokeRoundRect(ctx, px, py, pw, ph, 18, COLORS.PURPLE, 2.5);

    var hero = stateGetHero();
    var grade = G.score > 5000 ? 'S' : G.score > 3000 ? 'A' : G.score > 1500 ? 'B' : 'C';
    var gradeColor = grade === 'S' ? COLORS.GOLD : grade === 'A' ? COLORS.PURPLE : grade === 'B' ? COLORS.CYAN : COLORS.WHITE_60;

    drawOutlineText(ctx, hero.icon + ' ' + hero.name, px + pw / 2, py + 26,
        18, hero.color, COLORS.BG_DARK, 'center');
    drawOutlineText(ctx, grade + ' 级评价', px + pw / 2, py + 54,
        24, gradeColor, COLORS.BG_DARK, 'center');
    drawOutlineText(ctx, '得分: ' + Math.round(G.score), px + pw / 2, py + 82,
        14, COLORS.WHITE, COLORS.BG_DARK, 'center');

    var rows = [
        ['💀 击杀', G.finalKills],
        ['🌊 最高波次', G.finalWave],
        ['⏱ 存活时间', formatTime(G.finalTime)],
        ['⚔ 难度', (DIFFICULTY[G.difficulty] || {}).name || '未知']
    ];
    for (var r = 0; r < rows.length; r++) {
        drawOutlineText(ctx, rows[r][0] + ': ' + rows[r][1],
            px + pw / 2, py + 110 + r * 26, 12, COLORS.WHITE_50, COLORS.BG_DARK, 'center');
    }

    var btnX = px + 40, btnY = py + ph - 54, btnW = pw - 80, btnH = 40;
    fillRoundRect(ctx, btnX, btnY, btnW, btnH, 10, COLORS.CYAN);
    drawOutlineText(ctx, '🔄 再来一局', btnX + btnW / 2, btnY + btnH / 2,
        15, COLORS.WHITE, COLORS.CYAN, 'center');
    window._retryRect = { x: btnX, y: btnY, w: btnW, h: btnH };
}

function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}
