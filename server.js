const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '1mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
  }
}));

// Data directory for editor saves
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Helper: read/write versioned config
const VERSIONS_FILE = path.join(DATA_DIR, 'versions.json');
function readVersions() {
  try { return JSON.parse(fs.readFileSync(VERSIONS_FILE, 'utf-8')); }
  catch { return { latest: null, items: {} }; }
}
function writeVersions(v) {
  fs.writeFileSync(VERSIONS_FILE, JSON.stringify(v, null, 2));
}

// API: Load config (latest or by versionId)
app.get('/api/load', (req, res) => {
  const v = readVersions();
  const versionId = req.query.versionId || v.latest;
  if (!versionId || !v.items[versionId]) {
    return res.json({ status: 'success', data: generateDefaultConfig() });
  }
  try {
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, versionId + '.json'), 'utf-8'));
    res.json({ status: 'success', data });
  } catch (e) {
    res.json({ status: 'error', message: 'Failed to load config' });
  }
});

// API: Save config
app.post('/api/save', (req, res) => {
  const v = readVersions();
  const versionId = Date.now().toString();
  const timestamp = new Date().toISOString();
  v.items[versionId] = { versionId, timestamp, label: timestamp };
  v.latest = versionId;
  writeVersions(v);
  fs.writeFileSync(path.join(DATA_DIR, versionId + '.json'), JSON.stringify(req.body, null, 2));
  res.json({ status: 'success', versionId });
});

// API: List versions
app.get('/api/versions', (req, res) => {
  const v = readVersions();
  const list = Object.values(v.items).sort((a, b) => b.versionId.localeCompare(a.versionId));
  res.json({ status: 'success', versions: list });
});

// API: Delete version
app.post('/api/delete', (req, res) => {
  const v = readVersions();
  const versionId = req.body.versionId;
  if (!versionId || !v.items[versionId]) {
    return res.json({ status: 'error', message: 'Version not found' });
  }
  delete v.items[versionId];
  if (v.latest === versionId) v.latest = null;
  writeVersions(v);
  try { fs.unlinkSync(path.join(DATA_DIR, versionId + '.json')); } catch {}
  res.json({ status: 'success' });
});

// Fallback: default config
function generateDefaultConfig() {
  return {
    hero: { maxHp: 200, maxMp: 100, mpRegen: 5, mpRegenInterval: 200, walkSpeed: 4,
      dashDistance: 150, dashMpCost: 30, attackMin: 15, attackMax: 25, attackRange: 55,
      attackCooldown: 400, projectileSpeed: 400, projectileSize: 8, projectileColor: '#ffdd59',
      initialGold: 0, hpRestorePerWave: 30, mpRestorePerWave: 50, contactDamage: 8, contactInterval: 600 },
    monsters: { types: {
      dog: { name: '小狗', hp: 50, speed: 2, damage: 8, size: 25, color: '#ff6348', score: 100 },
      wolf: { name: '狼', hp: 80, speed: 2.5, damage: 12, size: 28, color: '#ffa502', score: 150 },
      tank: { name: '重甲', hp: 150, speed: 1.5, damage: 18, size: 34, color: '#a855f7', score: 200 },
      fast: { name: '刺客', hp: 35, speed: 4, damage: 10, size: 22, color: '#ff4757', score: 120 }
    }, waveDuration: 25, spawnCount: 1 },
    waves: [{ monsters: { dog: 8 } }, { monsters: { dog: 6, wolf: 2 } }, { monsters: { dog: 4, wolf: 3 } },
      { monsters: { wolf: 4, tank: 1 } }, { monsters: { wolf: 3, tank: 2, fast: 2 } },
      { monsters: { wolf: 4, tank: 3, fast: 3 } }, { monsters: { tank: 4, fast: 4, dog: 4 } },
      { monsters: { tank: 3, wolf: 4, fast: 5, dog: 3 } }],
    cards: { refreshCost: 30, cardsPerRefresh: 3, maxSkillBar: 8, synergyThreshold: 2,
      cardPool: [{ type: 'warrior', name: '狂怒', icon: '😤' }, { type: 'warrior', name: '斩杀', icon: '⚔️' },
        { type: 'warrior', name: '战吼', icon: '📯' }, { type: 'assassin', name: '背刺', icon: '🗡️' },
        { type: 'assassin', name: '暗影步', icon: '🌑' }, { type: 'assassin', name: '毒刃', icon: '💚' },
        { type: 'mage', name: '火球', icon: '🔥' }, { type: 'mage', name: '奥术飞弹', icon: '✨' },
        { type: 'mage', name: '魔法盾', icon: '🛡️' }, { type: 'ice', name: '冰箭', icon: '❄️' },
        { type: 'ice', name: '冰霜新星', icon: '🧊' }, { type: 'ice', name: '寒冰护甲', icon: '💠' }] }
  };
}

// Favicon fallback
app.get('/favicon.ico', (req, res) => res.status(204).end());

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 不完美作战 v4.3.1`);
  console.log(`   Game:    http://localhost:${PORT}/game.html`);
  console.log(`   Editor:  http://localhost:${PORT}/editor.html`);
});
