/**
 * 不完美作战 v3.0 - 移动端配置编辑器
 */

// ==================== 默认配置 ====================
function defaultConfig(){
  return {
    hero: {
      maxHp:200, maxMp:100, mpRegen:5, mpRegenInterval:200,
      walkSpeed:4, dashDistance:150, dashMpCost:30,
      attackMin:15, attackMax:25, attackRange:55, attackCooldown:400,
      projectileSpeed:400, projectileSize:8, projectileColor:'#ffdd59',
      initialGold:0, hpRestorePerWave:30, mpRestorePerWave:50,
      contactDamage:8, contactInterval:600
    },
    monsters: {
      types: {
        dog:  { name:'小狗', hp:50, speed:2, damage:8,  size:25, color:'#ff6348', score:100 },
        wolf: { name:'狼',  hp:80, speed:2.5, damage:12, size:28, color:'#ffa502', score:150 },
        tank: { name:'重甲', hp:150, speed:1.5, damage:18, size:34, color:'#a855f7', score:200 },
        fast: { name:'刺客', hp:35, speed:4,  damage:10, size:22, color:'#ff4757', score:120 }
      },
      waveDuration:25, spawnCount:1
    },
    waves: [
      { monsters:{dog:8} },
      { monsters:{dog:6,wolf:2} },
      { monsters:{dog:4,wolf:3} },
      { monsters:{wolf:4,tank:1} },
      { monsters:{wolf:3,tank:2,fast:2} },
      { monsters:{wolf:4,tank:3,fast:3} },
      { monsters:{tank:4,fast:4,dog:4} },
      { monsters:{tank:3,wolf:4,fast:5,dog:3} }
    ],
    cards: {
      refreshCost:30, cardsPerRefresh:3, maxSkillBar:8, synergyThreshold:2,
      synergyTypes:{
        warrior:{ name:'狂战士', desc:'+8 攻击力', color:'#ff4757', icon:'😤', threshold:2, apply:{ attackBonus:8 } },
        assassin:{ name:'刺客', desc:'+25% 攻速', color:'#a29bfe', icon:'🗡️', threshold:2, apply:{ attackSpeedBonus:0.25 } },
        mage:{ name:'法师', desc:'+30 射程', color:'#00d4ff', icon:'🔮', threshold:2, apply:{ rangeBonus:30 } },
        ice:{ name:'冰霜', desc:'冰冻减速 40%', color:'#74b9ff', icon:'❄️', threshold:2, apply:{ iceSlow:0.4 } }
      },
      cardPool:[
        { type:'warrior', name:'狂怒', icon:'😤' }, { type:'warrior', name:'斩杀', icon:'⚔️' }, { type:'warrior', name:'战吼', icon:'📯' },
        { type:'assassin', name:'背刺', icon:'🗡️' }, { type:'assassin', name:'暗影步', icon:'🌑' }, { type:'assassin', name:'毒刃', icon:'💚' },
        { type:'mage', name:'火球', icon:'🔥' }, { type:'mage', name:'奥术飞弹', icon:'✨' }, { type:'mage', name:'魔法盾', icon:'🛡️' },
        { type:'ice', name:'冰箭', icon:'❄️' }, { type:'ice', name:'冰霜新星', icon:'🧊' }, { type:'ice', name:'寒冰护甲', icon:'💠' }
      ]
    }
  };
}

let config = defaultConfig();

// ==================== 可编辑字段定义 ====================
const HERO_FIELDS = [
  { id:'max-hp', key:'maxHp', min:50, max:500 },
  { id:'max-mp', key:'maxMp', min:20, max:300 },
  { id:'mp-regen-interval', key:'mpRegenInterval', min:50, max:500, step:10 },
  { id:'walk-speed', key:'walkSpeed', min:1, max:10, step:0.5 },
  { id:'dash-distance', key:'dashDistance', min:30, max:300, step:10 },
  { id:'dash-cost', key:'dashMpCost', min:5, max:80 },
  { id:'atk-min', key:'attackMin', min:5, max:80 },
  { id:'atk-max', key:'attackMax', min:10, max:120 },
  { id:'atk-range', key:'attackRange', min:30, max:300 },
  { id:'atk-cooldown', key:'attackCooldown', min:100, max:2000, step:50 },
  { id:'proj-speed', key:'projectileSpeed', min:100, max:1200, step:20 },
  { id:'init-gold', key:'initialGold', min:0, max:500, step:10 },
  { id:'hp-restore', key:'hpRestorePerWave', min:0, max:200, step:5 },
  { id:'mp-restore', key:'mpRestorePerWave', min:0, max:200, step:5 }
];

const CARD_SLIDER_FIELDS = [
  { id:'card-cost', key:'refreshCost', min:10, max:100, step:5 },
  { id:'card-count', key:'cardsPerRefresh', min:2, max:8 },
  { id:'max-bar', key:'maxSkillBar', min:4, max:16 },
  // { id:'synergy-threshold', key:'synergyThreshold', min:2, max:5 } // 已移到各羁绊类型独立配置
];

// ==================== UI 工具 ====================
function toggle(el){
  el.classList.toggle('open');
  const body = el.nextElementSibling;
  if(body) body.classList.toggle('open');
}

function showToast(msg, sec){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>t.classList.remove('show'), (sec||2)*1000);
}

// ==================== 滑块绑定 ====================
function bindSliders(){
  HERO_FIELDS.forEach(f=>{
    const el = document.getElementById(f.id);
    if(!el) return;
    el.value = config.hero[f.key];
    const vd = document.getElementById(f.id+'-val');
    if(vd) vd.textContent = el.value;
    el.addEventListener('input', ()=>{
      const v = parseFloat(el.value);
      config.hero[f.key] = v;
      if(vd) vd.textContent = v;
    });
  });

  CARD_SLIDER_FIELDS.forEach(f=>{
    const el = document.getElementById(f.id);
    if(!el) return;
    el.value = config.cards[f.key];
    const vd = document.getElementById(f.id+'-val');
    if(vd) vd.textContent = el.value;
    el.addEventListener('input', ()=>{
      const v = parseFloat(el.value);
      config.cards[f.key] = v;
      if(vd) vd.textContent = v;
    });
  });

  const wdEl = document.getElementById('wave-duration');
  if(wdEl){
    wdEl.value = config.monsters.waveDuration || 25;
    const wdV = document.getElementById('wave-duration-val');
    if(wdV) wdV.textContent = wdEl.value;
    wdEl.addEventListener('input', ()=>{
      config.monsters.waveDuration = parseFloat(wdEl.value);
      if(wdV) wdV.textContent = wdEl.value;
    });
  }

  const scEl = document.getElementById('spawn-count');
  if(scEl){
    scEl.value = config.monsters.spawnCount || 1;
    const scV = document.getElementById('spawn-count-val');
    if(scV) scV.textContent = scEl.value;
    scEl.addEventListener('input', ()=>{
      config.monsters.spawnCount = parseInt(scEl.value)||1;
      if(scV) scV.textContent = scEl.value;
    });
  }
}

// ==================== 怪物类型编辑 ====================
function renderMonsterTypes(){
  const el = document.getElementById('monster-list');
  if(!el) return;
  let html = '';
  const keys = Object.keys(config.monsters.types);
  keys.forEach(k=>{
    const m = config.monsters.types[k];
    html += `<div class="card-item-edit">
      <div style="font-size:13px;color:#00d4ff;margin-bottom:6px">${m.name||k}</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr>
          <td style="padding:2px 4px;color:#888;width:50px">血量</td>
          <td style="padding:2px"><input type="number" value="${m.hp}" min="1" max="9999" style="width:60px;background:#0a0a1a;border:1px solid #444;color:#fff;padding:4px;border-radius:3px" onchange="updateMonster('${k}','hp',parseFloat(this.value)||1)"></td>
          <td style="padding:2px 4px;color:#888;width:50px">速度</td>
          <td style="padding:2px"><input type="number" value="${m.speed}" min="0.5" max="20" step="0.5" style="width:60px;background:#0a0a1a;border:1px solid #444;color:#fff;padding:4px;border-radius:3px" onchange="updateMonster('${k}','speed',parseFloat(this.value)||1)"></td>
        </tr>
        <tr>
          <td style="padding:2px 4px;color:#888">伤害</td>
          <td style="padding:2px"><input type="number" value="${m.damage}" min="0" max="999" style="width:60px;background:#0a0a1a;border:1px solid #444;color:#fff;padding:4px;border-radius:3px" onchange="updateMonster('${k}','damage',parseFloat(this.value)||0)"></td>
          <td style="padding:2px 4px;color:#888">金币</td>
          <td style="padding:2px"><input type="number" value="${m.score||100}" min="0" max="9999" style="width:60px;background:#0a0a1a;border:1px solid #444;color:#fff;padding:4px;border-radius:3px" onchange="updateMonster('${k}','score',parseFloat(this.value)||0)"></td>
        </tr>
        <tr>
          <td style="padding:2px 4px;color:#888">大小</td>
          <td style="padding:2px"><input type="number" value="${m.size||25}" min="5" max="100" style="width:60px;background:#0a0a1a;border:1px solid #444;color:#fff;padding:4px;border-radius:3px" onchange="updateMonster('${k}','size',parseFloat(this.value)||10)"></td>
          <td style="padding:2px 4px;color:#888">颜色</td>
          <td style="padding:2px"><input type="color" value="${m.color||'#ff6348'}" style="width:40px;height:30px;background:transparent;border:none;cursor:pointer;padding:0;vertical-align:middle" onchange="updateMonster('${k}','color',this.value)"></td>
        </tr>
      </table>
      <div style="display:flex;gap:6px;margin-top:6px;align-items:center;flex-wrap:wrap">
        <button onclick="renameMonsterType('${k}')" style="padding:6px 10px;background:#252545;border:1px solid #444;color:#fff;border-radius:4px;font-size:11px;cursor:pointer">改名</button>
        <button onclick="deleteMonsterType('${k}')" style="padding:6px 10px;background:#5a1a1a;border:1px solid #ff4757;color:#ff4757;border-radius:4px;font-size:11px;cursor:pointer">×</button>
      </div>
    </div>`;
  });
  el.innerHTML = html;
}

// 简化的 inline 更新
function updateMonster(key, field, val){
  if(field==='hp'||field==='speed'||field==='damage'||field==='size'||field==='score') val=parseFloat(val)||0;
  config.monsters.types[key][field] = val;
}

function renameMonsterType(oldKey){
  const newName = prompt('输入新的怪物key（英文字母）:', oldKey);
  if(!newName||newName===oldKey) return;
  config.monsters.types[newName] = config.monsters.types[oldKey];
  delete config.monsters.types[oldKey];
  // 同时更新所有波次中的引用
  config.waves.forEach(w=>{
    if(w.monsters[oldKey]!==undefined){
      w.monsters[newName] = w.monsters[oldKey];
      delete w.monsters[oldKey];
    }
  });
  renderAll();
}

function deleteMonsterType(key){
  if(!confirm(`删除怪物类型 "${config.monsters.types[key].name||key}"？`)) return;
  delete config.monsters.types[key];
  config.waves.forEach(w=>{ delete w.monsters[key]; });
  renderAll();
}

function addMonsterType(){
  const name = prompt('输入怪物key（英文，如 dragon）:', 'dragon');
  if(!name) return;
  if(config.monsters.types[name]) return showToast('该key已存在',2);
  config.monsters.types[name] = { name:'新怪物', hp:60, speed:2, damage:10, size:26, color:'#ff6348', score:120 };
  renderAll();
}

// ==================== 波次配置 ====================
function renderWaves(){
  const el = document.getElementById('wave-list');
  if(!el) return;
  let html = '';
  const mkeys = Object.keys(config.monsters.types);
  config.waves.forEach((w,i)=>{
    html += `<div class="card-item-edit">
      <div style="font-size:13px;color:#f1c40f;margin-bottom:6px">第 ${i+1} 波</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">`;
    mkeys.forEach(k=>{
      const val = w.monsters[k]||0;
      html += `<div style="display:flex;align-items:center;gap:4px;background:#1a1a2e;padding:4px 8px;border-radius:4px">
        <span style="font-size:11px;color:#888">${config.monsters.types[k].name||k}</span>
        <input type="number" value="${val}" min="0" max="99" style="width:40px;background:#0a0a1a;border:1px solid #444;color:#fff;padding:4px;border-radius:3px;font-size:12px;text-align:center"
          onchange="updateWave(${i},'${k}',parseInt(this.value)||0)">
      </div>`;
    });
    html += `</div>
      <button onclick="deleteWave(${i})" style="margin-top:6px;padding:4px 10px;background:#5a1a1a;border:1px solid #ff4757;color:#ff4757;border-radius:4px;font-size:11px;cursor:pointer">删除本波</button>
    </div>`;
  });
  el.innerHTML = html;
}

function updateWave(idx, type, val){
  if(val<=0) delete config.waves[idx].monsters[type];
  else config.waves[idx].monsters[type] = val;
}

function deleteWave(idx){
  if(config.waves.length<=1) return showToast('至少保留一波',2);
  config.waves.splice(idx,1);
  renderWaves();
}

function addWave(){
  const last = config.waves[config.waves.length-1]||{monsters:{}};
  const newWave = { monsters:{} };
  Object.keys(last.monsters).forEach(k=>{
    newWave.monsters[k] = Math.min(Math.round((last.monsters[k]||0)*1.2), 30);
  });
  config.waves.push(newWave);
  renderWaves();
}

// ==================== 卡牌池 / 羁绊 ====================
function renderSynergyTypes(){
  const el = document.getElementById('synergy-list');
  if(!el) return;
  const st = config.cards.synergyTypes;
  const keys = Object.keys(st);
  let html = '';
  keys.forEach(k=>{
    const s = st[k];
    html += `<div class="card-item-edit">
      <div style="font-size:13px;font-weight:600">${s.icon||''} ${s.name} <span style="color:#666;font-weight:400">(${k})</span></div>
      <div class="inline-grid" style="margin-top:6px">
        <input type="text" class="input-text" value="${s.desc}" placeholder="描述" onchange="updateSynergy('${k}','desc',this.value)">
        <input type="text" class="input-text" value="${s.color}" placeholder="#颜色" onchange="updateSynergy('${k}','color',this.value)">
      </div>
      <div style="margin-top:6px;display:flex;align-items:center;gap:8px">
        <span style="font-size:11px;color:#888">激活需</span>
        <input type="number" class="input-text" style="width:50px" value="${s.threshold||2}" min="2" max="6" onchange="updateSynergy('${k}','threshold',parseInt(this.value)||2)">
        <span style="font-size:11px;color:#888">张同类型卡</span>
      </div>
      <div class="inline-grid-3" style="margin-top:6px">
        <input type="text" class="input-text" value="${s.apply.attackBonus||0}" placeholder="攻击加成" onchange="updateSynergyApply('${k}','attackBonus',this.value)">
        <input type="text" class="input-text" value="${s.apply.attackSpeedBonus||0}" placeholder="攻速(如0.25)" onchange="updateSynergyApply('${k}','attackSpeedBonus',this.value)">
        <input type="text" class="input-text" value="${s.apply.rangeBonus||0}" placeholder="射程加成" onchange="updateSynergyApply('${k}','rangeBonus',this.value)">
      </div>
      <div style="margin-top:6px">
        <input type="text" class="input-text" value="${s.apply.iceSlow||''}" placeholder="冰霜减速(如0.4)" onchange="updateSynergyApply('${k}','iceSlow',this.value)">
      </div>
    </div>`;
  });
  el.innerHTML = html;
}

function updateSynergy(key, field, val){
  config.cards.synergyTypes[key][field] = val;
}

function updateSynergyApply(key, field, val){
  config.cards.synergyTypes[key].apply[field] = parseFloat(val)||0;
}

function renderCardPool(){
  const el = document.getElementById('card-pool-list');
  if(!el) return;
  const st = config.cards.synergyTypes;
  const typeOptions = Object.keys(st).map(k=>`<option value="${k}">${st[k].icon||''} ${st[k].name||k}</option>`).join('');
  let html = '';
  config.cards.cardPool.forEach((c,i)=>{
    html += `<div class="card-item-edit">
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <select onchange="updateCard(${i},'type',this.value)" style="background:#1a1a2e;border:1px solid #444;color:#fff;padding:6px;border-radius:4px;font-size:12px">${typeOptions.replace(`value="${c.type}"`, `value="${c.type}" selected`)}</select>
        <input type="text" value="${c.name}" placeholder="卡牌名" style="background:#1a1a2e;border:1px solid #444;color:#fff;padding:6px;border-radius:4px;font-size:12px;flex:1;min-width:60px" onchange="updateCard(${i},'name',this.value)">
        <input type="text" value="${c.icon}" placeholder="图标" style="width:40px;background:#1a1a2e;border:1px solid #444;color:#fff;padding:6px;border-radius:4px;font-size:12px;text-align:center" onchange="updateCard(${i},'icon',this.value)">
        <input type="text" value="${c.effect||''}" placeholder="个体效果说明" style="background:#1a1a2e;border:1px solid #555;color:#aaa;padding:6px;border-radius:4px;font-size:11px;flex:1;min-width:80px" onchange="updateCard(${i},'effect',this.value)">
        <button onclick="deleteCard(${i})" style="padding:6px 10px;background:#5a1a1a;border:1px solid #ff4757;color:#ff4757;border-radius:4px;font-size:11px;cursor:pointer">×</button>
      </div>
    </div>`;
  });
  el.innerHTML = html;
}

function updateCard(idx, field, val){
  config.cards.cardPool[idx][field] = val;
}

function deleteCard(idx){
  if(config.cards.cardPool.length<=1) return showToast('至少保留一张卡',2);
  config.cards.cardPool.splice(idx,1);
  renderCardPool();
}

function addCard(){
  const defaultType = Object.keys(config.cards.synergyTypes)[0]||'warrior';
  config.cards.cardPool.push({ type:defaultType, name:'新卡牌', icon:'🃏' });
  renderCardPool();
}

// ==================== 全量渲染 ====================
function renderAll(){
  renderMonsterTypes();
  renderWaves();
  renderSynergyTypes();
  renderCardPool();
}

// ==================== 保存 / 加载 ====================
function buildSaveData(){
  return {
    params: {
      maxHp: config.hero.maxHp, maxMp: config.hero.maxMp,
      walkSpeed: config.hero.walkSpeed, dashDistance: config.hero.dashDistance,
      dashMpCost: config.hero.dashMpCost, attackMin: config.hero.attackMin,
      attackMax: config.hero.attackMax, attackRange: config.hero.attackRange,
      attackCooldown: config.hero.attackCooldown, projectileSpeed: config.hero.projectileSpeed,
      initialGold: config.hero.initialGold
    },
    gameConfig: JSON.parse(JSON.stringify(config)),
    levelName: (document.getElementById('config-name')||{}).value||'默认配置',
    versionDesc: '配置编辑 - ' + new Date().toLocaleString()
  };
}

async function saveConfig(){
  const data = buildSaveData();
  try{
    const r = await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const j = await r.json();
    if(j.status==='success'){
      showToast('✅ 保存成功!', 2);
      (async ()=>{ await loadLatest(); })();
loadVersionList();
    } else showToast('❌ 保存失败: '+j.message,3);
  }catch(e){ showToast('❌ 网络错误: '+e.message,3); }
}

async function loadLatest(){
  try{
    const r = await fetch('/api/versions');
    const j = await r.json();
    if(j.status!=='success'||!j.versions||!j.versions.length) return showToast('暂无保存',2);
    const latest = j.versions[0];
    const r2 = await fetch('/api/load?versionId='+latest.versionId);
    const j2 = await r2.json();
    if(j2.status!=='success'||!j2.data) return showToast('读取失败',2);
    const d = j2.data;
    if(d.gameConfig){ config = d.gameConfig; }
    else if(d.params){
      // 兼容旧数据
      config = defaultConfig();
      Object.assign(config.hero, d.params);
    }
    if(d.levelName){
      const nameInput = document.getElementById('config-name');
      if(nameInput) nameInput.value = d.levelName;
    }
    bindSliders();
    renderAll();
    showToast('✅ 已加载: '+(d.versionDesc||'最新配置'),2);
  }catch(e){ showToast('❌ 加载失败: '+e.message,3); }
}

// ==================== 版本列表 ====================
async function loadVersionList(){
  try{
    const r = await fetch('/api/versions');
    const j = await r.json();
    if(j.status!=='success') return;
    const el = document.getElementById('version-list');
    el.innerHTML = j.versions.map(v=>`
      <div class="version-item" style="display:flex;justify-content:space-between;align-items:center">
        <div style="flex:1" onclick='loadVersionById("${v.versionId}")'>
          <div>${v.levelName||'未命名'}</div>
          <div class="date">${new Date(v.createdAt).toLocaleString()}</div>
        </div>
        <button onclick='event.stopPropagation();deleteVersion("${v.versionId}")' style="padding:4px 10px;background:#5a1a1a;border:1px solid #ff4757;color:#ff4757;border-radius:4px;font-size:11px;cursor:pointer;margin-left:8px">删除</button>
      </div>
    `).join('');
  }catch(e){}
}

async function deleteVersion(vid){
  if(!confirm('确定删除此版本？')) return;
  try{
    const r = await fetch('/api/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({versionId:vid})});
    const j = await r.json();
    if(j.status==='success'){ showToast('✅ 已删除',2); (async ()=>{ await loadLatest(); })();
loadVersionList(); }
    else showToast('❌ '+j.message,3);
  }catch(e){ showToast('❌ 删除失败: '+e.message,3); }
}

async function loadVersionById(vid){
  try{
    const r = await fetch('/api/load?versionId='+vid);
    const j = await r.json();
    if(j.status!=='success'||!j.data) return showToast('读取失败',2);
    const d = j.data;
    if(d.gameConfig) config = d.gameConfig;
    else if(d.params){ config = defaultConfig(); Object.assign(config.hero, d.params); }
    if(d.levelName){ const ni = document.getElementById('config-name'); if(ni) ni.value = d.levelName; }
    bindSliders();
    renderAll();
    showToast('✅ 已加载: '+(d.versionDesc||''),2);
  }catch(e){ showToast('❌ 加载失败: '+e.message,3); }
}

// ==================== 启动 ====================
bindSliders();
renderAll();
(async ()=>{ await loadLatest(); })();
loadVersionList();
console.log('⚙️ 不完美作战 配置编辑器 v3.0');
