/**
 * 不完美作战 v5.0 - 移动端配置编辑器
 * 所有变量使用 var（项目规范）
 */

var editorConfig = {}; // 当前编辑中的配置
var editorOriginal = {}; // 初始值（用于比较是否修改过）
var editorDirty = false;  // 是否有未保存修改
var editorCurrentTab = 'heroes';

// ==================== 深拷贝 ====================
function editorDeepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ==================== Toast ====================
function editorShowToast(msg, type) {
  var t = document.getElementById('toast');
  var icon = type === 'error' ? '❌ ' : type === 'warn' ? '⚠️ ' : '✅ ';
  t.textContent = icon + msg;
  t.className = 'toast show toast-' + (type || 'success');
  if (t._timer) clearTimeout(t._timer);
  t._timer = setTimeout(function(){ t.className = 'toast'; }, 2500);
}

// ==================== 标记脏数据 ====================
function editorMarkDirty() {
  if (!editorDirty) {
    editorDirty = true;
    var dirtyEl = document.getElementById('dirty-indicator');
    if (dirtyEl) dirtyEl.style.display = 'inline';
    var saveBtn = document.getElementById('btn-save');
    if (saveBtn) saveBtn.style.boxShadow = '0 0 12px #ffa502';
  }
}

function editorClearDirty() {
  editorDirty = false;
  var dirtyEl = document.getElementById('dirty-indicator');
  if (dirtyEl) dirtyEl.style.display = 'none';
  var saveBtn = document.getElementById('btn-save');
  if (saveBtn) saveBtn.style.boxShadow = 'none';
  editorOriginal = editorDeepClone(editorConfig);
}

// ==================== 初始化 ====================
function editorInit() {
  // 尝试从相对路径加载默认配置
  editorLoadDefaultConfig();
}

function editorLoadDefaultConfig() {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'game-config.json?_=' + Date.now(), true);
  xhr.onload = function() {
    if (xhr.status === 200) {
      try {
        var cfg = JSON.parse(xhr.responseText);
        editorLoadConfig(cfg);
        editorClearDirty();
        editorShowToast('已加载默认配置', 'info');
      } catch(e) {
        editorShowToast('配置解析失败: ' + e.message, 'error');
      }
    } else {
      editorShowToast('无法加载 game-config.json (状态:' + xhr.status + ')', 'error');
    }
  };
  xhr.onerror = function() {
    editorShowToast('网络错误：无法加载配置文件', 'error');
  };
  xhr.send();
}

// ==================== 加载配置 ====================
function editorLoadConfig(config) {
  editorConfig = editorDeepClone(config);
  editorOriginal = editorDeepClone(config);
  editorDirty = false;
  var dirtyEl = document.getElementById('dirty-indicator');
  if (dirtyEl) dirtyEl.style.display = 'none';
  editorRenderCurrentTab();
}

// ==================== Tab 切换 ====================
function editorSwitchTab(tab) {
  editorCurrentTab = tab;
  // 更新 tab 按钮状态
  var tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(function(t) {
    t.classList.toggle('active', t.getAttribute('data-tab') === tab);
  });
  editorRenderCurrentTab();
}

function editorRenderCurrentTab() {
  var main = document.getElementById('editor-content');
  if (!main) return;
  main.innerHTML = '';
  switch (editorCurrentTab) {
    case 'heroes': editorRenderHeroes(); break;
    case 'monsters': editorRenderMonsters(); break;
    case 'waves': editorRenderWaves(); break;
    case 'cards': editorRenderCards(); break;
    case 'talents': editorRenderTalents(); break;
    case 'items': editorRenderItems(); break;
    case 'constants': editorRenderConstants(); break;
  }
}

// ==================== 工具：创建 slider + number 配对 ====================
function editorMakeNumberField(parentKey, key, label, min, max, step, unit) {
  var path = parentKey ? parentKey + '.' + key : key;
  var val = editorGetNested(editorConfig, path);
  if (val === undefined) val = 0;
  step = step || 1;
  if (typeof step === 'number' && step < 1 && (step * 10) % 1 === 0) {
    // 保留步进小数精度
  }

  var html = '<div class="param-group">';
  html += '<label>' + label + '</label>';
  html += '<div class="row">';
  html += '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"';
  html += ' data-path="' + path + '" data-kind="range" oninput="editorOnRangeInput(this)" onchange="editorOnRangeChange(this)">';
  html += '<span class="val" id="val-' + editorPathToId(path) + '">' + val + (unit || '') + '</span>';
  html += '</div></div>';
  return html;
}

function editorMakeNumberFieldEx(parentKey, key, label, min, max, step, unit, extraAttrs) {
  var path = parentKey ? parentKey + '.' + key : key;
  var val = editorGetNested(editorConfig, path);
  if (val === undefined) val = 0;
  step = step || 1;
  extraAttrs = extraAttrs || '';

  var html = '<div class="param-group">';
  html += '<label>' + label + '</label>';
  html += '<div class="row">';
  html += '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"';
  html += ' data-path="' + path + '" data-kind="range" oninput="editorOnRangeInput(this)" onchange="editorOnRangeChange(this)" ' + extraAttrs + '>';
  html += '<span class="val" id="val-' + editorPathToId(path) + '">' + val + (unit || '') + '</span>';
  html += '</div></div>';
  return html;
}

function editorMakeTextField(parentKey, key, label, placeholder) {
  var path = parentKey ? parentKey + '.' + key : key;
  var val = editorGetNested(editorConfig, path) || '';
  var html = '<div class="param-group">';
  html += '<label>' + label + '</label>';
  html += '<input type="text" class="input-text" value="' + editorEscapeHtml(String(val)) + '"';
  html += ' data-path="' + path + '" data-kind="text" onchange="editorOnTextChange(this)"';
  if (placeholder) html += ' placeholder="' + editorEscapeHtml(placeholder) + '"';
  html += '>';
  html += '</div>';
  return html;
}

function editorMakeColorField(parentKey, key, label) {
  var path = parentKey ? parentKey + '.' + key : key;
  var val = editorGetNested(editorConfig, path) || '#888888';
  var html = '<div class="param-group" style="display:flex;align-items:center;gap:12px">';
  html += '<label style="margin:0;flex:1">' + label + '</label>';
  html += '<input type="color" class="input-color" value="' + val + '"';
  html += ' data-path="' + path + '" data-kind="color" onchange="editorOnColorChange(this)">';
  html += '<span style="font-size:12px;color:#888;min-width:55px">' + val + '</span>';
  html += '</div>';
  return html;
}

function editorMakeBoolField(parentKey, key, label) {
  var path = parentKey ? parentKey + '.' + key : key;
  var val = editorGetNested(editorConfig, path) || false;
  var html = '<div class="param-group" style="display:flex;align-items:center;gap:12px">';
  html += '<label style="margin:0;flex:1">' + label + '</label>';
  html += '<label class="toggle-switch">';
  html += '<input type="checkbox" ' + (val ? 'checked' : '') + ' data-path="' + path + '" data-kind="bool" onchange="editorOnBoolChange(this)">';
  html += '<span class="toggle-slider"></span>';
  html += '</label>';
  html += '</div>';
  return html;
}

function editorMakeSectionHeader(title, icon) {
  return '<div class="sub-section-header">' + (icon || '') + ' ' + title + '</div>';
}

// ==================== 路径工具 ====================
function editorGetNested(obj, path) {
  var parts = path.split('.');
  var cur = obj;
  for (var i = 0; i < parts.length; i++) {
    if (cur === undefined || cur === null) return undefined;
    if (Array.isArray(cur) && /^\d+$/.test(parts[i])) {
      cur = cur[parseInt(parts[i])];
    } else {
      cur = cur[parts[i]];
    }
  }
  return cur;
}

function editorSetNested(obj, path, val) {
  var parts = path.split('.');
  var cur = obj;
  for (var i = 0; i < parts.length - 1; i++) {
    var key = parts[i];
    if (cur[key] === undefined || cur[key] === null) {
      cur[key] = /^\d+$/.test(parts[i+1]) ? [] : {};
    }
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = val;
}

function editorPathToId(path) {
  return path.replace(/\./g, '-').replace(/\[/g, '-').replace(/\]/g, '');
}

function editorEscapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==================== 值变更回调 ====================
function editorOnRangeInput(el) {
  var path = el.getAttribute('data-path');
  var val = parseFloat(el.value);
  editorSetNested(editorConfig, path, val);
  var vid = document.getElementById('val-' + editorPathToId(path));
  if (vid) vid.textContent = val;
  editorMarkDirty();
}

function editorOnRangeChange(el) {
  // 确保值同步
  var path = el.getAttribute('data-path');
  var val = parseFloat(el.value);
  editorSetNested(editorConfig, path, val);
}

function editorOnTextChange(el) {
  var path = el.getAttribute('data-path');
  editorSetNested(editorConfig, path, el.value);
  editorMarkDirty();
}

function editorOnColorChange(el) {
  var path = el.getAttribute('data-path');
  editorSetNested(editorConfig, path, el.value);
  // 更新旁边的颜色值显示
  var next = el.nextElementSibling;
  if (next) next.textContent = el.value;
  editorMarkDirty();
}

function editorOnBoolChange(el) {
  var path = el.getAttribute('data-path');
  editorSetNested(editorConfig, path, el.checked);
  editorMarkDirty();
}

function editorOnNumberInput(el) {
  var path = el.getAttribute('data-path');
  var val = parseFloat(el.value);
  if (isNaN(val)) val = 0;
  editorSetNested(editorConfig, path, val);
  // 同步 range
  var rangeEl = document.querySelector('input[type="range"][data-path="' + path + '"]');
  if (rangeEl) {
    rangeEl.value = val;
    var vid = document.getElementById('val-' + editorPathToId(path));
    if (vid) vid.textContent = val;
  }
  editorMarkDirty();
}

// ==================== 同步所有输入到 range ====================
function editorSyncRangeFromNumber(numEl) {
  var path = numEl.getAttribute('data-path-sync');
  if (!path) return;
  var val = parseFloat(numEl.value);
  if (isNaN(val)) val = 0;
  editorSetNested(editorConfig, path, val);
  var rangeEl = document.querySelector('input[type="range"][data-path="' + path + '"]');
  if (rangeEl) {
    rangeEl.value = val;
    var vid = document.getElementById('val-' + editorPathToId(path));
    if (vid) vid.textContent = val;
  }
  editorMarkDirty();
}

// ==================== 渲染：英雄 ====================
function editorRenderHeroes() {
  var heroes = editorConfig.heroes || {};
  var heroIds = Object.keys(heroes);
  var el = document.getElementById('editor-content');
  var html = '';

  heroIds.forEach(function(hid) {
    var hero = heroes[hid];
    html += '<div class="card-section">';
    html += '<div class="card-section-header" onclick="editorToggleCard(this)">';
    html += '<span>' + (hero.icon || '') + ' ' + (hero.name || hid) + '</span>';
    html += '<span class="card-badge" style="background:' + (hero.color || '#666') + '">' + (hero.type || '') + '</span>';
    html += '<span class="arrow">▼</span>';
    html += '</div>';
    html += '<div class="card-section-body open">';

    var prefix = 'heroes.' + hid;
    html += editorMakeTextField(prefix, 'name', '名称');
    html += editorMakeTextField(prefix, 'icon', '图标(emoji)');
    html += editorMakeTextField(prefix, 'type', '类型 (precision/cultivation)');
    html += editorMakeColorField(prefix, 'color', '颜色');
    html += editorMakeNumberField(prefix, 'hp', '生命值 HP', 50, 500, 10);
    html += editorMakeNumberField(prefix, 'mp', '法力值 MP', 20, 400, 10);
    html += editorMakeNumberField(prefix, 'atkMin', '最小攻击力', 5, 50, 1);
    html += editorMakeNumberField(prefix, 'atkMax', '最大攻击力', 10, 80, 1);
    html += editorMakeNumberField(prefix, 'range', '攻击射程', 30, 300, 10);

    // cultivation type extras
    if (hero.type === 'cultivation' && hero.cultivationUI) {
      var cu = hero.cultivationUI;
      var cups = prefix + '.cultivationUI';
      html += editorMakeSectionHeader('⚔️ 修仙UI配置', '');
      html += editorMakeTextField(cups, 'weaponIcon', '武器图标');
      html += editorMakeTextField(cups, 'weaponName', '武器名称');
      html += editorMakeNumberField(cups, 'maxLevel', '最大等级', 1, 20, 1);
      html += editorMakeNumberField(cups, 'upgradeSuccessBase', '升级基础成功率', 0.1, 1.0, 0.05);
      html += editorMakeNumberField(cups, 'L2LifetimeMs', 'L2 存活时间 (ms)', 1000, 60000, 1000);
      html += editorMakeNumberField(cups, 'L2RecoveryTimeMs', 'L2 回收时间 (ms)', 1000, 60000, 1000);
    }

    html += '</div></div>';
  });
  el.innerHTML = html;
}

// ==================== 渲染：怪物 ====================
function editorRenderMonsters() {
  var monsters = editorConfig.monsterTypes || {};
  var mIds = Object.keys(monsters);
  var el = document.getElementById('editor-content');
  var html = '';

  mIds.forEach(function(mid) {
    var m = monsters[mid];
    html += '<div class="card-section">';
    html += '<div class="card-section-header" onclick="editorToggleCard(this)">';
    html += '<span>' + (m.icon || '') + ' ' + (m.name || mid) + '</span>';
    html += '<span class="card-badge" style="background:' + (m.color || '#666') + '">' + mid + '</span>';
    html += '<span class="arrow">▼</span>';
    html += '</div>';
    html += '<div class="card-section-body open">';

    var prefix = 'monsterTypes.' + mid;
    html += editorMakeTextField(prefix, 'name', '名称');
    html += editorMakeTextField(prefix, 'icon', '图标(emoji)');
    html += editorMakeNumberField(prefix, 'hp', '生命值 HP', 10, 500, 5);
    html += editorMakeNumberField(prefix, 'speed', '移动速度', 0.1, 5, 0.1);
    html += editorMakeNumberField(prefix, 'atk', '攻击力', 0, 60, 1);
    html += editorMakeNumberField(prefix, 'gold', '金币掉落', 0, 200, 5);
    html += editorMakeNumberField(prefix, 'size', '大小', 5, 50, 1);
    html += editorMakeColorField(prefix, 'color', '颜色');
    html += editorMakeBoolField(prefix, 'dropsStat', '掉落状态道具');
    html += editorMakeBoolField(prefix, 'dropsGold', '掉落金币');

    html += '</div></div>';
  });
  el.innerHTML = html;
}

// ==================== 渲染：波次 ====================
function editorRenderWaves() {
  var waves = editorConfig.waveTemplates || [];
  var el = document.getElementById('editor-content');
  var html = '';

  waves.forEach(function(w, wi) {
    html += '<div class="card-section">';
    html += '<div class="card-section-header" onclick="editorToggleCard(this)">';
    html += '<span>🌊 第 ' + (w.chapter || 0) + '章 · 第 ' + (w.wave || 0) + '波</span>';
    html += '<span class="card-badge">' + (w.duration || 0) + '秒</span>';
    html += '<span class="arrow">▼</span>';
    html += '</div>';
    html += '<div class="card-section-body">';

    var prefix = 'waveTemplates.' + wi;
    html += editorMakeNumberField(prefix, 'chapter', '章节', 1, 10, 1);
    html += editorMakeNumberField(prefix, 'wave', '波次编号', 1, 30, 1);
    html += editorMakeNumberField(prefix, 'duration', '时长 (秒)', 10, 120, 5);

    html += editorMakeSectionHeader('👾 怪物组合', '');
    var monsters = w.monsters || [];
    monsters.forEach(function(m, mi) {
      var mp = prefix + '.monsters.' + mi;
      var mtype = m.type || '?';
      html += '<div class="monster-wave-row">';
      html += '<span class="monster-wave-type">' + (editorConfig.monsterTypes && editorConfig.monsterTypes[mtype] ? (editorConfig.monsterTypes[mtype].icon || '') + ' ' + editorConfig.monsterTypes[mtype].name : mtype) + '</span>';
      html += '<span class="monster-wave-field"><label>数量</label><input type="number" value="' + (m.count || 0) + '" data-path="' + mp + '.count" onchange="editorOnNumberInput(this)" class="input-number-sm"></span>';
      html += '<span class="monster-wave-field"><label>间隔(s)</label><input type="number" value="' + (m.interval || 1.5) + '" step="0.1" data-path="' + mp + '.interval" onchange="editorOnNumberInput(this)" class="input-number-sm"></span>';
      html += '</div>';
    });

    html += '</div></div>';
  });
  el.innerHTML = html;
}

// ==================== 渲染：卡牌 ====================
function editorRenderCards() {
  var cards = editorConfig.cards || {};
  var el = document.getElementById('editor-content');
  var html = '';

  // Worker 卡
  html += '<div class="card-section">';
  html += '<div class="card-section-header open" onclick="editorToggleCard(this)">';
  html += '<span>💼 打工卡 (' + ((cards.worker || []).length) + '张)</span><span class="arrow">▼</span>';
  html += '</div><div class="card-section-body open">';
  (cards.worker || []).forEach(function(c, ci) {
    var prefix = 'cards.worker.' + ci;
    html += '<div class="card-item-edit">';
    html += '<div class="card-item-title">' + (c.icon || '') + ' ' + (c.name || '?') + ' <span class="rarity r' + (c.rarity || 1) + '">R' + (c.rarity || 1) + '</span></div>';
    html += '<div class="card-item-fields">';
    html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(c.name || '') + '" data-path="' + prefix + '.name" onchange="editorOnTextChange(this)" placeholder="名称">';
    html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(c.icon || '') + '" data-path="' + prefix + '.icon" onchange="editorOnTextChange(this)" placeholder="图标" style="width:50px">';
    html += '<input type="number" class="input-number-xs" value="' + (c.rarity || 1) + '" data-path="' + prefix + '.rarity" onchange="editorOnNumberInput(this)" placeholder="稀有度" min="1" max="5" style="width:45px">';
    html += '</div>';
    html += '<div class="card-item-fields" style="margin-top:4px">';
    // Dynamic bonus fields
    var bonusKeys = [];
    var skipKeys = ['id','name','rarity','icon','desc'];
    for (var k in c) {
      if (c.hasOwnProperty(k) && skipKeys.indexOf(k) < 0) {
        bonusKeys.push(k);
      }
    }
    bonusKeys.forEach(function(bk) {
      html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(String(c[bk])) + '" data-path="' + prefix + '.' + bk + '" onchange="editorOnTextChange(this)" placeholder="' + bk + '" style="width:80px">';
    });
    html += '</div>';
    html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(c.desc || '') + '" data-path="' + prefix + '.desc" onchange="editorOnTextChange(this)" placeholder="描述" style="margin-top:4px;width:100%">';
    html += '</div>';
  });
  html += '</div></div>';

  // 修仙 L2
  html += '<div class="card-section">';
  html += '<div class="card-section-header" onclick="editorToggleCard(this)">';
  html += '<span>🔮 修仙 L2</span><span class="arrow">▼</span>';
  html += '</div><div class="card-section-body">';
  var l2 = cards.cultivationL2 || {};
  var l2Heroes = ['immortal','sword_hidden'];
  l2Heroes.forEach(function(hid) {
    if (!l2[hid]) return;
    var heroName = editorConfig.heroes && editorConfig.heroes[hid] ? editorConfig.heroes[hid].name : hid;
    html += '<div style="font-size:13px;color:#00d4ff;margin:8px 0 4px">' + heroName + '</div>';
    l2[hid].forEach(function(c, ci) {
      var prefix = 'cards.cultivationL2.' + hid + '.' + ci;
      html += '<div class="card-item-edit">';
      html += '<div class="card-item-title">' + (c.icon || '') + ' ' + (c.name || '?') + ' <span class="rarity r4">R4</span></div>';
      html += '<div class="card-item-fields">';
      html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(c.name || '') + '" data-path="' + prefix + '.name" onchange="editorOnTextChange(this)" placeholder="名称">';
      html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(c.icon || '') + '" data-path="' + prefix + '.icon" onchange="editorOnTextChange(this)" placeholder="图标" style="width:50px">';
      html += '</div>';
      var l2bonusKeys = [];
      var l2skipKeys = ['id','name','rarity','icon','desc'];
      for (var l2k in c) {
        if (c.hasOwnProperty(l2k) && l2skipKeys.indexOf(l2k) < 0) {
          l2bonusKeys.push(l2k);
        }
      }
      html += '<div class="card-item-fields" style="margin-top:4px">';
      l2bonusKeys.forEach(function(bk) {
        html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(String(c[bk])) + '" data-path="' + prefix + '.' + bk + '" onchange="editorOnTextChange(this)" placeholder="' + bk + '" style="width:80px">';
      });
      html += '</div>';
      html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(c.desc || '') + '" data-path="' + prefix + '.desc" onchange="editorOnTextChange(this)" placeholder="描述" style="margin-top:4px;width:100%">';
      html += '</div>';
    });
  });
  html += '</div></div>';

  // 修仙 L3 辅助
  html += '<div class="card-section">';
  html += '<div class="card-section-header" onclick="editorToggleCard(this)">';
  html += '<span>🔧 修仙 L3 辅助 (' + ((cards.cultivationL3Support || []).length) + '张)</span><span class="arrow">▼</span>';
  html += '</div><div class="card-section-body">';
  (cards.cultivationL3Support || []).forEach(function(c, ci) {
    var prefix = 'cards.cultivationL3Support.' + ci;
    html += '<div class="card-item-edit">';
    html += '<div class="card-item-title">' + (c.icon || '') + ' ' + (c.name || '?') + ' <span class="rarity r' + (c.rarity || 4) + '">R' + (c.rarity || 4) + '</span></div>';
    html += '<div class="card-item-fields">';
    html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(c.name || '') + '" data-path="' + prefix + '.name" onchange="editorOnTextChange(this)" placeholder="名称">';
    html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(c.icon || '') + '" data-path="' + prefix + '.icon" onchange="editorOnTextChange(this)" placeholder="图标" style="width:50px">';
    html += '<input type="number" class="input-number-xs" value="' + (c.rarity || 4) + '" data-path="' + prefix + '.rarity" onchange="editorOnNumberInput(this)" min="1" max="5" style="width:45px">';
    html += '</div>';
    var l3sSkipKeys = ['id','name','rarity','icon','desc'];
    var l3sBonusKeys = [];
    for (var l3sk in c) {
      if (c.hasOwnProperty(l3sk) && l3sSkipKeys.indexOf(l3sk) < 0) {
        l3sBonusKeys.push(l3sk);
      }
    }
    if (l3sBonusKeys.length > 0) {
      html += '<div class="card-item-fields" style="margin-top:4px">';
      l3sBonusKeys.forEach(function(bk) {
        html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(String(c[bk])) + '" data-path="' + prefix + '.' + bk + '" onchange="editorOnTextChange(this)" placeholder="' + bk + '" style="width:80px">';
      });
      html += '</div>';
    }
    html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(c.desc || '') + '" data-path="' + prefix + '.desc" onchange="editorOnTextChange(this)" placeholder="描述" style="margin-top:4px;width:100%">';
    html += '</div>';
  });
  html += '</div></div>';

  // 修仙 L3 核心
  html += '<div class="card-section">';
  html += '<div class="card-section-header" onclick="editorToggleCard(this)">';
  html += '<span>⚡ 修仙 L3 核心 (' + ((cards.cultivationL3Core || []).length) + '张)</span><span class="arrow">▼</span>';
  html += '</div><div class="card-section-body">';
  (cards.cultivationL3Core || []).forEach(function(c, ci) {
    var prefix = 'cards.cultivationL3Core.' + ci;
    html += '<div class="card-item-edit">';
    html += '<div class="card-item-title">' + (c.icon || '') + ' ' + (c.name || '?') + ' <span class="rarity r5">R5</span></div>';
    html += '<div class="card-item-fields">';
    html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(c.name || '') + '" data-path="' + prefix + '.name" onchange="editorOnTextChange(this)" placeholder="名称">';
    html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(c.icon || '') + '" data-path="' + prefix + '.icon" onchange="editorOnTextChange(this)" placeholder="图标" style="width:50px">';
    html += '</div>';
    var l3cSkipKeys = ['id','name','rarity','icon','desc'];
    var l3cBonusKeys = [];
    for (var l3ck in c) {
      if (c.hasOwnProperty(l3ck) && l3cSkipKeys.indexOf(l3ck) < 0) {
        l3cBonusKeys.push(l3ck);
      }
    }
    if (l3cBonusKeys.length > 0) {
      html += '<div class="card-item-fields" style="margin-top:4px">';
      l3cBonusKeys.forEach(function(bk) {
        html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(String(c[bk])) + '" data-path="' + prefix + '.' + bk + '" onchange="editorOnTextChange(this)" placeholder="' + bk + '" style="width:80px">';
      });
      html += '</div>';
    }
    html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(c.desc || '') + '" data-path="' + prefix + '.desc" onchange="editorOnTextChange(this)" placeholder="描述" style="margin-top:4px;width:100%">';
    html += '</div>';
  });
  html += '</div></div>';

  el.innerHTML = html;
}

// ==================== 渲染：天赋 ====================
function editorRenderTalents() {
  var talents = editorConfig.talents || [];
  var el = document.getElementById('editor-content');
  var html = '';

  html += '<div class="card-section">';
  html += '<div class="card-section-header open" onclick="editorToggleCard(this)">';
  html += '<span>⭐ 天赋列表 (' + talents.length + '个)</span><span class="arrow">▼</span>';
  html += '</div><div class="card-section-body open">';

  talents.forEach(function(t, ti) {
    var prefix = 'talents.' + ti;
    var rarityColor = t.rarity === 'legendary' ? '#ff6b6b' : t.rarity === 'epic' ? '#a855f7' : t.rarity === 'rare' ? '#00d4ff' : '#888';
    html += '<div class="card-item-edit">';
    html += '<div class="card-item-title">' + (t.icon || '') + ' ' + (t.name || '?') + ' <span style="color:' + rarityColor + ';font-size:11px">' + (t.rarity || '') + '</span></div>';
    html += '<div class="card-item-fields">';
    html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(t.name || '') + '" data-path="' + prefix + '.name" onchange="editorOnTextChange(this)" placeholder="名称">';
    html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(t.icon || '') + '" data-path="' + prefix + '.icon" onchange="editorOnTextChange(this)" placeholder="图标" style="width:50px">';
    html += '<select class="input-select-sm" data-path="' + prefix + '.rarity" onchange="editorOnTextChange(this)">';
    var rarities = ['common','rare','epic','legendary'];
    rarities.forEach(function(r) {
      html += '<option value="' + r + '"' + (t.rarity === r ? ' selected' : '') + '>' + r + '</option>';
    });
    html += '</select>';
    html += '</div>';
    html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(t.desc || '') + '" data-path="' + prefix + '.desc" onchange="editorOnTextChange(this)" placeholder="效果描述" style="margin-top:4px;width:100%">';
    html += '</div>';
  });

  html += '</div></div>';
  el.innerHTML = html;
}

// ==================== 渲染：道具 ====================
function editorRenderItems() {
  var items = editorConfig.itemPool || {};
  var el = document.getElementById('editor-content');
  var html = '';

  var sections = [
    { key: 'consumable', title: '💊 消耗品', icon: '' },
    { key: 'passive', title: '🔰 被动道具', icon: '' },
    { key: 'boss', title: '👑 Boss 掉落', icon: '' }
  ];

  sections.forEach(function(sec) {
    var itemList = items[sec.key] || [];
    html += '<div class="card-section">';
    html += '<div class="card-section-header open" onclick="editorToggleCard(this)">';
    html += '<span>' + sec.title + ' (' + itemList.length + '个)</span><span class="arrow">▼</span>';
    html += '</div><div class="card-section-body open">';

    itemList.forEach(function(it, ii) {
      var prefix = 'itemPool.' + sec.key + '.' + ii;
      html += '<div class="card-item-edit">';
      html += '<div class="card-item-title">' + (it.icon || '') + ' ' + (it.name || '?') + ' <span class="rarity r' + (it.rarity || 1) + '">R' + (it.rarity || 1) + '</span></div>';
      html += '<div class="card-item-fields">';
      html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(it.name || '') + '" data-path="' + prefix + '.name" onchange="editorOnTextChange(this)" placeholder="名称">';
      html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(it.icon || '') + '" data-path="' + prefix + '.icon" onchange="editorOnTextChange(this)" placeholder="图标" style="width:50px">';
      html += '<input type="number" class="input-number-xs" value="' + (it.rarity || 1) + '" data-path="' + prefix + '.rarity" onchange="editorOnNumberInput(this)" min="1" max="5" style="width:45px">';
      html += '</div>';
      html += '<input type="text" class="input-text-sm" value="' + editorEscapeHtml(it.desc || '') + '" data-path="' + prefix + '.desc" onchange="editorOnTextChange(this)" placeholder="描述" style="margin-top:4px;width:100%">';
      html += '</div>';
    });

    html += '</div></div>';
  });

  el.innerHTML = html;
}

// ==================== 渲染：常数 ====================
function editorRenderConstants() {
  var constants = editorConfig.constants || {};
  var el = document.getElementById('editor-content');
  var html = '';

  html += '<div class="card-section">';
  html += '<div class="card-section-header open" onclick="editorToggleCard(this)">';
  html += '<span>⚙️ 全局常数</span><span class="arrow">▼</span>';
  html += '</div><div class="card-section-body open">';

  html += editorMakeNumberField('constants', 'cardDrawCost', '抽卡费用 (金币)', 5, 100, 5);
  html += editorMakeNumberField('constants', 'cardSlotsMax', '卡槽上限', 4, 16, 1);
  html += editorMakeNumberField('constants', 'itemSlotsMax', '道具槽上限', 3, 10, 1);

  // 卡牌稀有度
  html += editorMakeSectionHeader('📊 卡牌稀有度等级', '');
  var rarity = constants.cardRarity || {};
  var rkeys = Object.keys(rarity);
  rkeys.forEach(function(rk) {
    html += editorMakeNumberField('constants.cardRarity', rk, rk, 1, 10, 1);
  });

  // 卡牌回收价
  html += editorMakeSectionHeader('💰 卡牌回收价', '');
  var sellBack = constants.cardSellBack || {};
  var sbKeys = Object.keys(sellBack);
  sbKeys.forEach(function(sk) {
    html += editorMakeNumberField('constants.cardSellBack', sk, '稀有度 ' + sk + ' 回收价', 1, 200, 5);
  });

  html += '</div></div>';
  el.innerHTML = html;
}

// ==================== 折叠卡片 ====================
function editorToggleCard(header) {
  header.classList.toggle('open');
  var body = header.nextElementSibling;
  if (body) body.classList.toggle('open');
}

// ==================== 保存到服务器 ====================
function editorSave() {
  var data = editorDeepClone(editorConfig);
  var xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/config/save', true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onload = function() {
    if (xhr.status === 200) {
      try {
        var resp = JSON.parse(xhr.responseText);
        if (resp.status === 'success') {
          editorClearDirty();
          editorShowToast('保存成功！', 'success');
        } else {
          editorShowToast('保存失败: ' + (resp.message || '未知错误'), 'error');
        }
      } catch(e) {
        editorShowToast('响应解析失败', 'error');
      }
    } else {
      editorShowToast('保存失败 (HTTP ' + xhr.status + ')', 'error');
    }
  };
  xhr.onerror = function() {
    editorShowToast('网络错误，无法连接服务器', 'error');
  };
  xhr.send(JSON.stringify(data));
}

// ==================== 从服务器加载 ====================
function editorLoadFromServer() {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', '/api/config?_=' + Date.now(), true);
  xhr.onload = function() {
    if (xhr.status === 200) {
      try {
        var resp = JSON.parse(xhr.responseText);
        if (resp.status === 'success' && resp.data) {
          editorLoadConfig(resp.data);
          editorShowToast('已从服务器加载配置', 'success');
        } else if (resp.data) {
          editorLoadConfig(resp.data);
          editorShowToast('已从服务器加载配置', 'success');
        } else {
          editorShowToast('服务器返回空数据', 'warn');
        }
      } catch(e) {
        editorShowToast('响应解析失败: ' + e.message, 'error');
      }
    } else {
      editorShowToast('加载失败 (HTTP ' + xhr.status + ')', 'error');
    }
  };
  xhr.onerror = function() {
    editorShowToast('网络错误，无法连接服务器', 'error');
  };
  xhr.send();
}

// ==================== 导出 JSON ====================
function editorExport() {
  var data = editorDeepClone(editorConfig);
  var json = JSON.stringify(data, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'game-config-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  editorShowToast('配置已导出', 'success');
}

// ==================== 导入 JSON ====================
function editorImport() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var cfg = JSON.parse(ev.target.result);
        editorLoadConfig(cfg);
        editorShowToast('导入成功', 'success');
      } catch(err) {
        editorShowToast('JSON 解析失败: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ==================== 恢复默认 ====================
function editorReset() {
  if (editorDirty) {
    if (!confirm('当前有未保存修改，确定恢复默认配置？')) return;
  } else {
    if (!confirm('确定恢复为 game-config.json 的初始值？')) return;
  }
  editorLoadDefaultConfig();
}

// ==================== 从 URL 加载 ====================
function editorLoadFromUrl() {
  var url = prompt('输入 JSON 配置文件的 URL:', '');
  if (!url) return;
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url + '?_=' + Date.now(), true);
  xhr.onload = function() {
    if (xhr.status === 200) {
      try {
        var cfg = JSON.parse(xhr.responseText);
        editorLoadConfig(cfg);
        editorShowToast('已从 URL 加载配置', 'success');
      } catch(e) {
        editorShowToast('JSON 解析失败: ' + e.message, 'error');
      }
    } else {
      editorShowToast('加载失败 (HTTP ' + xhr.status + ')', 'error');
    }
  };
  xhr.onerror = function() {
    editorShowToast('网络错误或跨域限制', 'error');
  };
  xhr.send();
}

console.log('⚙️ 不完美作战 v5.0 配置编辑器已就绪');
