/**
 * game-ui.js — v5.0 UI渲染层
 * @module game-ui
 * @description HUD rendering, blueprint sidebar, card previews, game-over panel, talent panel.
 */
'use strict';

// ==================== Layout Constants ====================

var UI = {
    /** Card slot dimensions */
    CARD_W: 46, CARD_H: 56, CARD_GAP: 5,
    CARD_START_X: 20, CARD_Y: 570,

    /** Item slot dimensions */
    ITEM_W: 38, ITEM_H: 38, ITEM_GAP: 4,
    ITEM_START_X: 20, ITEM_Y: 500,

    /** HUD bar dimensions */
    HP_BAR_X: 10, HP_BAR_Y: 10, BAR_W: 140, BAR_H: 14,

    /** Blueprint panel */
    BLUEPRINT_W: 260,
    BLUEPRINT_X: 360
};

// ==================== Main UI Render ====================

function renderUI(ctx, size) {
    renderHUD(ctx);
    renderCardSlots(ctx);
    renderItemSlots(ctx);
    renderBossItems(ctx);
    renderOverflowMode(ctx);
    renderTalentPanel(ctx, size);
    renderCultivationUI(ctx);
    renderBlueprint(ctx, size);
    renderGameOver(ctx, size);
    renderMiniInfo(ctx);
}

// ==================== HUD ====================

function renderHUD(ctx) {
    if (!G.player) return;
    var p = G.player;

    // HP bar
    var hpPct = p.hp / p.maxHp;
    var hpColor = hpPct > 0.5 ? COLORS.GREEN : hpPct > 0.25 ? COLORS.ORANGE : COLORS.RED;
    drawProgressBar(ctx, UI.HP_BAR_X, UI.HP_BAR_Y, UI.BAR_W, UI.BAR_H, hpPct, hpColor);
    drawOutlineText(ctx, 'HP ' + Math.round(p.hp) + '/' + p.maxHp, UI.HP_BAR_X + UI.BAR_W/2, UI.HP_BAR_Y + 7, 10, COLORS.WHITE, COLORS.BG_DARK, 'center');

    // MP bar
    var mpPct = p.mp / p.maxMp;
    drawProgressBar(ctx, UI.HP_BAR_X, UI.HP_BAR_Y + UI.BAR_H + 4, UI.BAR_W, UI.BAR_H * 0.8, mpPct, COLORS.CYAN);
    drawOutlineText(ctx, 'MP ' + Math.round(p.mp), UI.HP_BAR_X + UI.BAR_W/2, UI.HP_BAR_Y + UI.BAR_H + 10, 8, COLORS.CYAN, COLORS.BG_DARK, 'center');

    // Wave / Chapter
    var topRight = 240;
    drawOutlineText(ctx, '第' + G.chapter + '章 第' + G.wave + '波', topRight, 15, 13, COLORS.WHITE, COLORS.BG_DARK, 'left');

    // Gold
    drawOutlineText(ctx, '💰 ' + G.gold, topRight, 35, 13, COLORS.GOLD, COLORS.BG_DARK, 'left');

    // Kills
    drawOutlineText(ctx, '💀 ' + G.kills + ' (天赋 ' + G.killsTowardTalent + '/' + stateGetDifficulty().killsPerTalent + ')', topRight, 55, 11, COLORS.WHITE_40, COLORS.BG_DARK, 'left');

    // Time
    var mins = Math.floor(G.time / 60);
    var secs = Math.floor(G.time % 60);
    drawOutlineText(ctx, '⏱ ' + (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs, topRight, 72, 11, COLORS.WHITE_40, COLORS.BG_DARK, 'left');

    // Card draw button
    var canDraw = G.gold >= CARD_DRAW_COST && stateFindEmptyCardSlot() >= 0;
    if (canDraw && G.overflowReplacing < 0) {
        var btnX = 190, btnY = UI.CARD_Y, btnW = 60, btnH = UI.CARD_H;
        strokeRoundRect(ctx, btnX, btnY, btnW, btnH, 6, COLORS.GOLD, 2);
        drawOutlineText(ctx, '抽卡', btnX + btnW/2, btnY + btnH/2 - 6, 12, COLORS.GOLD, COLORS.BG_DARK, 'center');
        drawOutlineText(ctx, '💰' + CARD_DRAW_COST, btnX + btnW/2, btnY + btnH/2 + 12, 9, COLORS.GOLD, COLORS.BG_DARK, 'center');
        window._drawCardRect = {x:btnX, y:btnY, w:btnW, h:btnH};
    } else if (G.overflowReplacing < 0) {
        drawOutlineText(ctx, '💰不足', 220, UI.CARD_Y + UI.CARD_H/2, 10, COLORS.WHITE_20, COLORS.BG_DARK, 'center');
    }
}

// ==================== 6格悬浮卡槽 ====================

function renderCardSlots(ctx) {
    for (var i = 0; i < 6; i++) {
        var sx = UI.CARD_START_X + i * (UI.CARD_W + UI.CARD_GAP);
        var sy = UI.CARD_Y;

        var card = G.cardSlots[i];
        var isHovered = cardsHoveredSlot === i;
        var scale = isHovered ? 1.3 : 1;
        var w = UI.CARD_W * scale, h = UI.CARD_H * scale;
        var dx = sx - (w - UI.CARD_W) / 2;
        var dy = sy - (h - UI.CARD_H);

        if (card) {
            // Card color by rarity
            var cardColor;
            switch(card.rarity) {
                case 1: cardColor = '#666'; break;
                case 2: cardColor = '#22c55e'; break;
                case 3: cardColor = '#3b82f6'; break;
                case 4: cardColor = '#8b5cf6'; break;
                case 5: cardColor = '#ffd700'; break;
                default: cardColor = '#666';
            }
            drawMatteCard(ctx, dx, dy, w, h, cardColor, isHovered ? 4 : 2);
            drawOutlineText(ctx, card.icon || '?', dx + w/2, dy + h/2 - 6, isHovered ? 18 : 14, COLORS.WHITE, cardColor, 'center');
            drawOutlineText(ctx, card.name || '', dx + w/2, dy + h - 10, isHovered ? 8 : 6, COLORS.WHITE_60, COLORS.BG_DARK, 'center');

            // Hover popup
            if (isHovered) {
                var popW = 140, popH = 50;
                fillRoundRect(ctx, dx - (popW - w) / 2, dy - popH - 5, popW, popH, 6, COLORS.BLACK_70);
                strokeRoundRect(ctx, dx - (popW - w) / 2, dy - popH - 5, popW, popH, 6, cardColor, 1);
                drawOutlineText(ctx, card.desc || '', dx + w/2, dy - popH/2 - 2, 9, COLORS.WHITE_60, COLORS.BG_DARK, 'center');
                drawOutlineText(ctx, '出售 💰' + (CARD_SELL_BACK[card.rarity]||5), dx + w/2, dy - popH/2 + 12, 8, COLORS.GOLD, COLORS.BG_DARK, 'center');
            }
        } else {
            // Empty slot
            strokeRoundRect(ctx, dx, dy, w, h, 4, COLORS.WHITE_08, 1);
        }

        // Overflow replacing glow
        if (G.overflowReplacing >= 0) {
            strokeRoundRect(ctx, sx, sy, UI.CARD_W, UI.CARD_H, 4, COLORS.RED, 2);
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

// ==================== 5格道具栏 ====================

function renderItemSlots(ctx) {
    for (var i = 0; i < 5; i++) {
        var sx = UI.ITEM_START_X + i * (UI.ITEM_W + UI.ITEM_GAP);
        var sy = UI.ITEM_Y;

        var item = G.itemSlots[i];
        if (item) {
            fillRoundRect(ctx, sx, sy, UI.ITEM_W, UI.ITEM_H, 4, COLORS.BLACK_40);
            strokeRoundRect(ctx, sx, sy, UI.ITEM_W, UI.ITEM_H, 4, COLORS.WHITE_20, 1);
            drawOutlineText(ctx, item.icon || '?', sx + UI.ITEM_W/2, sy + UI.ITEM_H/2 - 4, 14, COLORS.WHITE, COLORS.BG_DARK, 'center');
            drawOutlineText(ctx, (item.name||'').slice(0,3), sx + UI.ITEM_W/2, sy + UI.ITEM_H - 7, 6, COLORS.WHITE_40, COLORS.BG_DARK, 'center');
        } else {
            strokeRoundRect(ctx, sx, sy, UI.ITEM_W, UI.ITEM_H, 4, COLORS.WHITE_08, 1);
        }
    }
}

function renderBossItems(ctx) {
    var cam = cameraGetPos();
    for (var i = 0; i < G.bossFollowingItems.length; i++) {
        var item = G.bossFollowingItems[i];
        var sx = item.x - cam.x;
        var sy = item.y - cam.y;
        // Orbiting glow
        drawGlow(ctx, sx, sy, 18, COLORS.GOLD, 0.4);
        drawOutlineText(ctx, item.icon || '🚪', sx, sy, 16, COLORS.WHITE, COLORS.BG_DARK, 'center');
    }
}

function renderOverflowMode(ctx) {
    if (G.overflowReplacing < 0) return;
    drawOutlineText(ctx, '点击卡槽替换 | 新卡: ' + (cardsDragCard ? cardsDragCard.name : ''), 180, 620, 11, COLORS.ORANGE, COLORS.BG_DARK, 'center');
}

// ==================== 天赋面板 ====================

function renderTalentPanel(ctx, size) {
    if (!G.talentPanelOpen || G.talentChoices.length === 0) return;

    // Dark backdrop
    ctx.fillStyle = COLORS.BLACK_40;
    ctx.fillRect(0, 0, size.w, size.h);

    var panelW = 300, panelH = 220;
    var px = (size.w - panelW) / 2;
    var py = (size.h - panelH) / 2;

    fillRoundRect(ctx, px, py, panelW, panelH, 12, '#1a1a3a');
    strokeRoundRect(ctx, px, py, panelW, panelH, 12, COLORS.PURPLE, 2);
    drawOutlineText(ctx, '选择天赋 (消耗杀敌数)', px + panelW/2, py + 20, 14, COLORS.WHITE, COLORS.BG_DARK, 'center');

    for (var i = 0; i < G.talentChoices.length; i++) {
        var t = G.talentChoices[i];
        var ty = py + 45 + i * 55;
        fillRoundRect(ctx, px + 15, ty, panelW - 30, 45, 6, COLORS.WHITE_08);
        drawOutlineText(ctx, t.icon + ' ' + t.name, px + 30, ty + 14, 13, COLORS.WHITE, COLORS.BG_DARK);
        drawOutlineText(ctx, t.desc, px + 30, ty + 32, 10, COLORS.WHITE_40, COLORS.BG_DARK);

        // Clickable area — handled by render loop click routing
        if (window._talentRects) window._talentRects[i] = {x:px+15, y:ty, w:panelW-30, h:45};
    }
    window._talentRects = [];
}

// ==================== 修仙专属UI ====================

function renderCultivationUI(ctx) {
    if (!stateIsCultivation() || !G.player) return;

    var hero = stateGetHero();
    var ui = hero.cultivationUI;
    if (!ui) return;

    var cam = cameraGetPos();
    // Floating UI follows player
    var ux = G.player.x - cam.x + 50;
    var uy = G.player.y - cam.y - 60;

    // Cultivation HUD
    fillRoundRect(ctx, ux, uy, 90, 50, 6, COLORS.BLACK_70);
    strokeRoundRect(ctx, ux, uy, 90, 50, 6, COLORS.PURPLE, 1);
    drawOutlineText(ctx, ui.weaponIcon + ' Lv.' + G.cultivationWeaponLevel, ux + 45, uy + 15, 11, COLORS.WHITE, COLORS.BG_DARK, 'center');
    drawOutlineText(ctx, '升级 ' + G.cultivationWeaponUpgrades + '次', ux + 45, uy + 32, 9, COLORS.GREEN, COLORS.BG_DARK, 'center');

    // L2 card progress
    if (G.cultivationL2Path) {
        var l2Pct = Math.max(0, G.cultivationL2Timer / 10000);
        drawProgressBar(ctx, ux, uy + 55, 90, 6, l2Pct, COLORS.GOLD);
        drawOutlineText(ctx, '回收 ' + (10 - Math.ceil(G.cultivationL2Timer/1000)) + 's', ux+45, uy+65, 8, COLORS.WHITE_40, COLORS.BG_DARK, 'center');
    }

    // L2 selection
    if (!G.cultivationL2Path && G.cultivationL2Pool.length > 0 && G.cultivationRecycleCount >= 5) {
        var selY = uy + 70;
        for (var i = 0; i < G.cultivationL2Pool.length; i++) {
            var c2 = G.cultivationL2Pool[i];
            fillRoundRect(ctx, ux, selY + i * 35, 90, 28, 4, COLORS.WHITE_08);
            drawOutlineText(ctx, c2.icon + ' ' + c2.name, ux + 45, selY + i * 35 + 14, 9, COLORS.WHITE, COLORS.BG_DARK, 'center');
        }
        window._cultivationL2Rects = G.cultivationL2Pool.map(function(c,i){return {x:ux, y:selY+i*35, w:90, h:28, index:i};});
    }
}

// ==================== 英雄蓝图侧边栏 ====================

function renderBlueprint(ctx, size) {
    if (!G.blueprintOpen) return;

    // Slide-out panel from right
    var bx = size.w - UI.BLUEPRINT_W;
    fillRoundRect(ctx, bx, 0, UI.BLUEPRINT_W, size.h, 0, 'rgba(10,10,30,0.95)');
    strokeRoundRect(ctx, bx, 0, UI.BLUEPRINT_W, size.h, 0, COLORS.WHITE_08, 2);

    var hero = stateGetHero();
    drawOutlineText(ctx, hero.icon + ' ' + hero.name, bx + 20, 30, 16, hero.color, COLORS.BG_DARK);
    drawOutlineText(ctx, '=== 核心组件 ===', bx + 20, 60, 11, COLORS.WHITE_40, COLORS.BG_DARK);

    // Show cards
    for (var i = 0; i < 6; i++) {
        var card = G.cardSlots[i];
        if (card) {
            drawOutlineText(ctx, card.icon + ' ' + card.name, bx + 30, 85 + i * 22, 10, COLORS.WHITE_60, COLORS.BG_DARK);
        }
    }

    // Talents
    drawOutlineText(ctx, '=== 外挂模块 ===', bx + 20, 85 + 6 * 22 + 10, 11, COLORS.WHITE_40, COLORS.BG_DARK);
    for (i = 0; i < G.talents.length; i++) {
        drawOutlineText(ctx, G.talents[i].icon + ' ' + G.talents[i].name, bx + 30, 85 + 6 * 22 + 35 + i * 20, 10, COLORS.WHITE_60, COLORS.BG_DARK);
    }

    // L3 cards for cultivation
    if (stateIsCultivation() && G.cultivationL3.length > 0) {
        drawOutlineText(ctx, '=== 羁绊回路 ===', bx + 20, 85 + 6 * 22 + 35 + G.talents.length * 20 + 15, 11, COLORS.WHITE_40, COLORS.BG_DARK);
        for (i = 0; i < G.cultivationL3.length; i++) {
            drawOutlineText(ctx, G.cultivationL3[i].icon + ' ' + G.cultivationL3[i].name, bx + 30, 85 + 6 * 22 + 35 + G.talents.length * 20 + 40 + i * 18, 9, COLORS.PURPLE, COLORS.BG_DARK);
        }
    }
}

// ==================== 游戏结束面板 ====================

function renderGameOver(ctx, size) {
    if (G.phase !== 'over') return;

    ctx.fillStyle = COLORS.BLACK_70;
    ctx.fillRect(0, 0, size.w, size.h);

    var pw = 280, ph = 320;
    var px = (size.w - pw) / 2, py = (size.h - ph) / 2;
    fillRoundRect(ctx, px, py, pw, ph, 16, '#1a1a3a');
    strokeRoundRect(ctx, px, py, pw, ph, 16, COLORS.PURPLE, 2);

    var hero = stateGetHero();
    var grade = G.score > 5000 ? 'S' : G.score > 3000 ? 'A' : G.score > 1500 ? 'B' : 'C';

    drawOutlineText(ctx, hero.icon + ' ' + hero.name, px + pw/2, py + 30, 20, hero.color, COLORS.BG_DARK, 'center');
    drawOutlineText(ctx, grade + ' 级评价', px + pw/2, py + 60, 24, COLORS.GOLD, COLORS.BG_DARK, 'center');
    drawOutlineText(ctx, '得分: ' + Math.round(G.score), px + pw/2, py + 90, 14, COLORS.WHITE, COLORS.BG_DARK, 'center');

    drawOutlineText(ctx, '💀 击杀: ' + G.finalKills, px + 40, py + 130, 12, COLORS.WHITE_60, COLORS.BG_DARK);
    drawOutlineText(ctx, '🌊 最高波次: ' + G.finalWave, px + 40, py + 155, 12, COLORS.WHITE_60, COLORS.BG_DARK);
    drawOutlineText(ctx, '⏱️ 存活时间: ' + formatTime(G.finalTime), px + 40, py + 180, 12, COLORS.WHITE_60, COLORS.BG_DARK);
    drawOutlineText(ctx, '⚔️ 难度: ' + (DIFFICULTY[G.difficulty] || {}).name, px + 40, py + 205, 12, COLORS.WHITE_60, COLORS.BG_DARK);

    // Retry button
    var btnX = px + 60, btnY = py + 240, btnW = 160, btnH = 40;
    fillRoundRect(ctx, btnX, btnY, btnW, btnH, 8, COLORS.CYAN);
    drawOutlineText(ctx, '🔄 再来一局', btnX + btnW/2, btnY + btnH/2, 14, COLORS.WHITE, COLORS.CYAN, 'center');
    window._retryRect = {x:btnX, y:btnY, w:btnW, h:btnH};
}

function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

// ==================== 小地图信息 ====================

function renderMiniInfo(ctx) {
    if (G.monsters.length > 0) {
        drawOutlineText(ctx, '怪物: ' + G.monsters.length, 10, 600, 9, COLORS.WHITE_20, COLORS.BG_DARK);
    }
}
