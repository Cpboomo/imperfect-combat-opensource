/* overlay-v1.js — DOM-based game UI bridge */
/* Reads global G state and updates DOM overlay */
(function() {
'use strict';

// ==================== Configuration ====================
var UPDATE_INTERVAL = 100; // ms between DOM updates
var FIXED_W = 390;
var FIXED_H = 844;

// ==================== Init ====================
var overlay, bottomPanel;
var itemSlotEls = [];
var cardSlotEls = [];
var lastState = '';
var initRan = false;

function init() {
    overlay = document.getElementById('game-ui-overlay');
    bottomPanel = document.getElementById('bottom-panel');
    if (!overlay || !bottomPanel) return;

    // Build slots
    buildSlots('item-slots', 5, 'item-slot', itemSlotEls);
    buildSlots('card-slots', 6, 'card-slot', cardSlotEls);

    // Event handlers — buttons
    byId('btn-draw').addEventListener('click', onDrawClick);
    byId('btn-pause').addEventListener('click', onPauseClick);
    byId('btn-blueprint').addEventListener('click', onBlueprintToggle);
    byId('btn-retry').addEventListener('click', onRetryClick);
    byId('btn-close-blueprint').addEventListener('click', onBlueprintClose);

    initRan = true;
    setInterval(updateAll, UPDATE_INTERVAL);
    updateAll(); // immediate first update
}

// ==================== Slot Builder ====================
function buildSlots(containerId, count, cls, arr) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    for (var i = 0; i < count; i++) {
        var el = document.createElement('div');
        el.className = cls;
        el.dataset.index = i;
        el.addEventListener('click', makeSlotHandler(cls, i));
        el.addEventListener('touchstart', function(){}, {passive: true}); // prevent iOS 300ms delay
        container.appendChild(el);
        arr[i] = el;
    }
}

function makeSlotHandler(cls, idx) {
    return function(e) {
        e.stopPropagation();
        if (cls === 'card-slot') {
            if (typeof gameCardClick === 'function') gameCardClick(idx);
        } else {
            if (typeof gameItemClick === 'function') gameItemClick(idx);
        }
    };
}

// ==================== Button Handlers ====================
function onDrawClick(e) {
    e.stopPropagation();
    if (typeof cardsDraw === 'function') cardsDraw();
}

function onPauseClick(e) {
    e.stopPropagation();
    if (typeof loopTogglePause === 'function') loopTogglePause();
}

function onBlueprintToggle(e) {
    e.stopPropagation();
    if (typeof G !== 'undefined') G.blueprintOpen = true;
}

function onBlueprintClose(e) {
    e.stopPropagation();
    if (typeof G !== 'undefined') G.blueprintOpen = false;
}

function onRetryClick(e) {
    e.stopPropagation();
    if (typeof gameRestart === 'function') gameRestart();
}

// ==================== Main Update ====================
function updateAll() {
    if (!initRan) return;
    try {
        if (typeof G === 'undefined' || !G.player) return;
        syncPosition();
        updateHUD();
        updateCardSlots();
        updateItemSlots();
        updateDrawButton();
        updateTalentPanel();
        updateCultivationPanel();
        updateBlueprintPanel();
        updateGameOverPanel();
    } catch(e) {
        console.warn('[overlay] update error:', e.message);
    }
}

// ==================== Position Sync ====================
function syncPosition() {
    if (!overlay) return;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var scale = Math.min(vw / FIXED_W, vh / FIXED_H);
    var displayW = Math.round(FIXED_W * scale);
    var displayH = Math.round(FIXED_H * scale);
    var offsetX = Math.round((vw - displayW) / 2);
    var offsetY = Math.round((vh - displayH) / 2);

    overlay.style.transform = 'translate(' + offsetX + 'px, ' + offsetY + 'px) scale(' + scale + ')';

    // Adjust bottom panel for Feishu toolbar
    var ua = navigator.userAgent || '';
    var isInApp = /Lark|Feishu/i.test(ua);
    var safeBottom = isInApp ? 100 : 34;
    // Account for viewport bottom being cut off by scale
    var viewBottom = (FIXED_H * scale + offsetY);
    var overflow = viewBottom - vh;
    if (overflow > 0) safeBottom += Math.ceil(overflow / scale);
    if (bottomPanel) bottomPanel.style.bottom = safeBottom + 'px';
}

// ==================== HUD ====================
function updateHUD() {
    var p = G.player;
    if (!p) return;

    var hpPct = clamp01(p.hp / p.maxHp);
    var hpFill = byId('hp-fill');
    hpFill.style.width = (hpPct * 100) + '%';
    hpFill.style.background = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#f59e0b' : '#ef4444';
    byId('hp-text').textContent = '\u2764 ' + Math.round(p.hp) + '/' + p.maxHp;

    var mpPct = clamp01(p.mp / p.maxMp);
    byId('mp-fill').style.width = (mpPct * 100) + '%';
    byId('mp-text').textContent = '\uD83D\uDC8E ' + Math.round(p.mp);

    byId('wave-text').textContent = '\u2694 ' + (G.chapter||1) + '-' + (G.wave||1);

    var gold = G.gold || 0;
    var currentGold = byId('gold-text').textContent;
    if (currentGold !== '\uD83D\uDCB0' + gold) {
        byId('gold-text').textContent = '\uD83D\uDCB0' + gold;
    }

    // Kills
    var diff = (typeof stateGetDifficulty === 'function') ? stateGetDifficulty() : { killsPerTalent: 5 };
    var kt = G.killsTowardTalent || 0;
    byId('kills-text').textContent = '\uD83D\uDC80' + (G.kills||0) + ' (' + kt + '/' + (diff.killsPerTalent||5) + ')';

    // Pause button
    byId('btn-pause').textContent = G.paused ? '\u25B6' : '\u23F8';
}

// ==================== Card Slots ====================
function updateCardSlots() {
    var slots = G.cardSlots;
    if (!slots) return;

    for (var i = 0; i < 6; i++) {
        var el = cardSlotEls[i];
        if (!el) continue;
        var card = slots[i];

        // Clear previous
        el.className = 'card-slot';
        el.innerHTML = '';

        if (card) {
            var rarity = card.rarity || 1;
            var rColor = rarityColor(rarity);
            el.classList.add('has-card', 'rarity-' + rarity);

            var icon = docEl('div', 'card-icon');
            icon.textContent = card.icon || '?';
            icon.style.color = rColor;
            el.appendChild(icon);

            var name = docEl('div', 'card-name');
            name.textContent = card.name || '';
            el.appendChild(name);

            if (card.level && card.level > 1) {
                var lvl = docEl('div', 'card-level');
                lvl.textContent = 'Lv.' + card.level;
                el.appendChild(lvl);
            }
        } else {
            var num = docEl('div', 'slot-num');
            num.textContent = String(i + 1);
            el.appendChild(num);
        }

        // Overflow highlight
        if (G.overflowReplacing >= 0 && i === G.overflowReplacing) {
            el.classList.add('overflow-highlight');
        }
    }
}

// ==================== Item Slots ====================
function updateItemSlots() {
    var slots = G.itemSlots;
    if (!slots) return;

    for (var i = 0; i < 5; i++) {
        var el = itemSlotEls[i];
        if (!el) continue;
        var item = slots[i];

        el.className = 'item-slot';
        el.innerHTML = '';

        if (item) {
            el.classList.add('has-item');

            var icon = docEl('div', 'item-icon');
            icon.textContent = item.icon || '?';
            el.appendChild(icon);

            var name = docEl('div', 'item-name');
            name.textContent = (item.name || '').slice(0, 4);
            el.appendChild(name);
        } else {
            var num = docEl('div', 'slot-num');
            num.textContent = String(i + 1);
            el.appendChild(num);
        }
    }
}

// ==================== Draw Button ====================
function updateDrawButton() {
    var btn = byId('btn-draw');
    var cost = (typeof CARD_DRAW_COST !== 'undefined') ? CARD_DRAW_COST : 20;
    var canDraw = G.gold >= cost;

    btn.className = canDraw ? 'affordable' : 'unaffordable';
    btn.innerHTML = '\uD83D\uDCB0 \u62BD \u5361 \uD83D\uDCB0<br><small>\uD83D\uDCB0' + cost + '</small>';

    if (G.overflowReplacing >= 0) {
        btn.style.opacity = '0.4';
        btn.style.pointerEvents = 'none';
        btn.textContent = '\u6EE1\u4E86\uFF0C\u66FF\u6362\u4E2D...';
    } else {
        btn.style.opacity = '';
        btn.style.pointerEvents = '';
    }
}

// ==================== Talent Panel ====================
function updateTalentPanel() {
    var panel = byId('talent-panel');
    if (!G.talentPanelOpen || !G.talentChoices || G.talentChoices.length === 0) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'flex';
    var container = byId('talent-choices');
    var html = '';
    for (var i = 0; i < G.talentChoices.length; i++) {
        var t = G.talentChoices[i];
        html += '<div class="talent-choice" data-talent="' + i + '">' +
            '<div class="talent-name">' + (t.icon||'') + ' ' + (t.name||'') + '</div>' +
            '<div class="talent-desc">' + (t.desc||'') + '</div>' +
            '</div>';
    }
    container.innerHTML = html;

    // Attach handlers
    var choices = container.querySelectorAll('.talent-choice');
    for (var j = 0; j < choices.length; j++) {
        (function(idx) {
            choices[idx].addEventListener('click', function(e) {
                e.stopPropagation();
                if (typeof talentsSelect === 'function') talentsSelect(idx);
            });
        })(j);
    }
}

// ==================== Cultivation Panel ====================
function updateCultivationPanel() {
    var panel = byId('cultivation-panel');
    var isCult = (typeof stateIsCultivation === 'function') ? stateIsCultivation() : false;

    if (!isCult || !G.player) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'flex';
    var hero = (typeof stateGetHero === 'function') ? stateGetHero() : null;
    var ui = hero ? hero.cultivationUI : null;

    var html = '<div class="cult-weapon-title">' + (ui ? ui.weaponIcon : '') + ' \u4FEE\u4ED9\u6B66\u5668 Lv.' + (G.cultivationWeaponLevel||1) + '</div>' +
        '<div class="cult-weapon-stats">\u5347\u7EA7 ' + (G.cultivationWeaponUpgrades||0) + '\u6B21  |  \u56DE\u6536</div>' +
        '<div class="cult-actions">' +
            '<button class="cult-btn" id="cult-upgrade">\u2B06 \u5347\u7EA7</button>' +
            '<button class="cult-btn" id="cult-recycle">\u267B \u56DE\u6536</button>' +
        '</div>';

    // L2 pool choices
    if (!G.cultivationL2Path && G.cultivationL2Pool && G.cultivationL2Pool.length > 0 && G.cultivationRecycleCount >= 5) {
        for (var i = 0; i < G.cultivationL2Pool.length; i++) {
            var c = G.cultivationL2Pool[i];
            html += '<div class="cult-l2-choice" data-l2="' + i + '">' + (c.icon||'') + ' ' + (c.name||'') + '</div>';
        }
    }

    var content = byId('cultivation-content');
    content.innerHTML = html;

    // Attach handlers
    var upBtn = byId('cult-upgrade');
    if (upBtn) upBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (typeof cultivationUpgradeWeapon === 'function') cultivationUpgradeWeapon();
    });

    var reBtn = byId('cult-recycle');
    if (reBtn) reBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (typeof cultivationRecycleL2 === 'function') cultivationRecycleL2();
    });

    var l2Choices = content.querySelectorAll('.cult-l2-choice');
    for (var j = 0; j < l2Choices.length; j++) {
        (function(idx) {
            l2Choices[idx].addEventListener('click', function(e) {
                e.stopPropagation();
                if (typeof cultivationSelectL2 === 'function') cultivationSelectL2(idx);
            });
        })(j);
    }
}

// ==================== Blueprint Panel ====================
function updateBlueprintPanel() {
    var panel = byId('blueprint-panel');
    if (!G.blueprintOpen) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'flex';
    var hero = (typeof stateGetHero === 'function') ? stateGetHero() : null;

    var html = '';
    if (hero) {
        html += '<div class="blueprint-section"><strong>' + (hero.icon||'') + ' ' + (hero.name||'') + '</strong></div>';
    }

    html += '<div style="font-size:10px;color:rgba(255,255,255,0.3);padding:4px 0">\u2501\u2501 \u5361\u724C\u7EC4\u5408 \u2501\u2501</div>';

    var hasCard = false;
    for (var i = 0; i < 6; i++) {
        var card = G.cardSlots ? G.cardSlots[i] : null;
        if (card) {
            hasCard = true;
            html += '<div class="blueprint-section">' + (card.icon||'') + ' ' + (card.name||'') + '</div>';
        }
    }
    if (!hasCard) {
        html += '<div class="blueprint-section" style="color:rgba(255,255,255,0.15)">(\u7A7A\u7684  \u62BD\u5361\u83B7\u53D6)</div>';
    }

    html += '<div style="font-size:10px;color:rgba(255,255,255,0.3);padding:4px 0">\u2501\u2501 \u5929\u8D4B \u2501\u2501</div>';
    if (G.talents && G.talents.length > 0) {
        for (i = 0; i < G.talents.length; i++) {
            html += '<div class="blueprint-section">' + (G.talents[i].icon||'') + ' ' + (G.talents[i].name||'') + '</div>';
        }
    } else {
        html += '<div class="blueprint-section" style="color:rgba(255,255,255,0.15)">(\u65E0\u5929\u8D4B)</div>';
    }

    if (isCultivationCheck() && G.cultivationL3 && G.cultivationL3.length > 0) {
        html += '<div style="font-size:10px;color:rgba(139,92,246,0.4);padding:4px 0">\u2501\u2501 \u4ED9\u8DEF \u2501\u2501</div>';
        for (i = 0; i < G.cultivationL3.length; i++) {
            html += '<div class="blueprint-section" style="color:#8b5cf6">' + (G.cultivationL3[i].icon||'') + ' ' + (G.cultivationL3[i].name||'') + '</div>';
        }
    }

    byId('blueprint-content').innerHTML = html;
}

function isCultivationCheck() {
    return (typeof stateIsCultivation === 'function') ? stateIsCultivation() : false;
}

// ==================== Game Over Panel ====================
function updateGameOverPanel() {
    var panel = byId('gameover-panel');
    if (G.phase !== 'over') {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'flex';
    var hero = (typeof stateGetHero === 'function') ? stateGetHero() : {icon:'?',name:'?',color:'#fff'};
    var grade = G.score > 5000 ? 'S' : G.score > 3000 ? 'A' : G.score > 1500 ? 'B' : 'C';
    var gColor = grade === 'S' ? '#ffd700' : grade === 'A' ? '#8b5cf6' : grade === 'B' ? '#06b6d4' : '#999';

    var diff = (typeof stateGetDifficulty === 'function') ? stateGetDifficulty() : {name:'?'};

    var html = '<h3>' + (hero.icon||'') + ' ' + (hero.name||'?') + '</h3>' +
        '<div class="grade" style="color:' + gColor + '">' + grade + ' \u7EA7\u8BC4\u4EF7</div>' +
        '<div style="font-size:14px;margin-bottom:12px">\u5F97\u5206: ' + Math.round(G.score||0) + '</div>' +
        '<div class="stat-row"><span>\uD83D\uDC80 \u51FB\u6740</span><span>' + (G.finalKills||0) + '</span></div>' +
        '<div class="stat-row"><span>\uD83C\uDF0A \u6700\u9AD8\u6CE2\u6570</span><span>' + (G.finalWave||0) + '</span></div>' +
        '<div class="stat-row"><span>\u23F1 \u751F\u5B58\u65F6\u95F4</span><span>' + formatTime(G.finalTime||0) + '</span></div>' +
        '<div class="stat-row"><span>\u2694 \u96BE\u5EA6</span><span>' + (diff.name||'?') + '</span></div>';

    byId('gameover-content').innerHTML = html;
}

function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

// ==================== Helpers ====================
function byId(id) { return document.getElementById(id); }
function docEl(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

function rarityColor(r) {
    switch(r) {
        case 2: return '#22c55e';
        case 3: return '#3b82f6';
        case 4: return '#8b5cf6';
        case 5: return '#ffd700';
        default: return '#555';
    }
}

// ==================== Drag Support (items) ====================
// Allow dragging item slots to move items
var dragItem = null;
var dragEl = null;

document.addEventListener('DOMContentLoaded', function() {
    // Slight delay to ensure overlay DOM is ready
    setTimeout(function() {
        init();
        setupDragSupport();
    }, 500);
});

function setupDragSupport() {
    for (var i = 0; i < 5; i++) {
        var el = itemSlotEls[i];
        if (!el) continue;
        el.addEventListener('touchstart', function(e) {
            var idx = parseInt(this.dataset.index);
            if (G && G.itemSlots && G.itemSlots[idx]) {
                dragItem = idx;
            }
        }, {passive: false});

        el.addEventListener('touchend', function(e) {
            if (dragItem !== null) {
                dragItem = null;
                if (dragEl) { dragEl.remove(); dragEl = null; }
            }
        });
    }
}

// Wait for DOM then init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(init, 500);
    });
} else {
    setTimeout(init, 500);
}

})();
