/**
 * game-cards.js — v5.0 6格悬浮卡槽系统
 * @module game-cards
 * @description 6-slot floating card system: draw, hover enlarge, overflow replace, sell-back.
 */
'use strict';

/** Cost to draw a card */
var CARD_DRAW_COST = 20;

/** Current hovered card index for enlarged preview */
var cardsHoveredSlot = -1;

/** Card being dragged for replacement */
var cardsDragCard = null;
var cardsDragFrom = -1;

/**
 * Draw a card from the pool (costs gold)
 * @returns {Object|null} Card object or null
 */
function cardsDraw() {
    if (G.gold < CARD_DRAW_COST) return null;
    stateAddGold(-CARD_DRAW_COST);

    var pool = G.drawableCards;
    if (pool.length === 0) return null;

    var card = pool[Math.floor(Math.random() * pool.length)];
    // Shallow clone
    card = Object.assign({}, card);

    // Check rarity bonus from talents
    if (G.talents.some(function(t){return t.id === 't9'})) {
        if (Math.random() < 0.2) {
            // Upgrade to rare
            var rareCards = pool.filter(function(c){return c.rarity >= 3;});
            if (rareCards.length > 0) card = Object.assign({}, rareCards[Math.floor(Math.random() * rareCards.length)]);
        }
    }

    var slot = stateFindEmptyCardSlot();
    if (slot >= 0) {
        G.cardSlots[slot] = card;
        audioPlayCardSelect();
    } else {
        // Overflow — must replace
        cardsOverflowReplace(card);
    }
    return card;
}

/**
 * Enter overflow replace mode
 * @param {Object} card - New card to place
 */
function cardsOverflowReplace(card) {
    cardsDragCard = card;
    G.overflowReplacing = 0;
    audioPlayCardFlip();
}

/**
 * Replace a card in a slot
 * @param {number} slotIndex - Slot to replace
 */
function cardsReplaceSlot(slotIndex) {
    if (!cardsDragCard || slotIndex < 0 || slotIndex >= 6) return;

    var oldCard = G.cardSlots[slotIndex];

    // Sell-back old card
    if (oldCard) {
        var refund = CARD_SELL_BACK[oldCard.rarity] || 5;
        if (G.talents.some(function(t){return t.id === 't6'})) refund *= 2;
        stateAddGold(refund);
        emitParticles(0, 0, {count:5, color:COLORS.GOLD, speed:3, life:10});
    }

    G.cardSlots[slotIndex] = cardsDragCard;
    cardsDragCard = null;
    G.overflowReplacing = -1;
    audioPlayShatter();
}

/**
 * Sell a card directly
 * @param {number} slotIndex
 */
function cardsSell(slotIndex) {
    var card = G.cardSlots[slotIndex];
    if (!card) return;
    var refund = CARD_SELL_BACK[card.rarity] || 5;
    stateAddGold(refund);
    G.cardSlots[slotIndex] = null;
}

/**
 * Update card hover state
 */
function cardsUpdate(dt) {
    if (G.overflowReplacing >= 0) {
        cardsHoveredSlot = -1;
        return;
    }

    cardsHoveredSlot = -1;
    if (!inputState.isPointerDown) {
        var px = inputState.pointerScreenX;
        var py = inputState.pointerScreenY;

        // Use responsive layout (not hardcoded coords)
        var cw = engineCanvas ? engineCanvas.width : 360;
        var ch = engineCanvas ? engineCanvas.height : 640;
        var L = uiLayout(cw, ch);
        var totalW = 6 * L.cardW + 5 * L.cardGap;
        var startX = (cw - totalW) / 2;

        for (var i = 0; i < 6; i++) {
            var sx = startX + i * (L.cardW + L.cardGap);
            if (px >= sx && px <= sx + L.cardW && py >= L.cardY && py <= L.cardY + L.cardH) {
                cardsHoveredSlot = i;
                break;
            }
        }
    }
}
