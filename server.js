const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3456;

// ==================== 目录配置 ====================
const PUBLIC_DIR = path.join(__dirname, 'public-v5');
const SERVER_DATA_DIR = path.join(__dirname, 'server-data');
const VERSIONS_DIR = path.join(SERVER_DATA_DIR, 'versions');
const HISTORY_FILE = path.join(SERVER_DATA_DIR, 'history.json');
const CONFIG_FILE = path.join(PUBLIC_DIR, 'game-config.json');

// ==================== 启动时创建必要目录 ====================
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('📁 创建目录:', path.relative(__dirname, dir));
  }
}
ensureDir(SERVER_DATA_DIR);
ensureDir(VERSIONS_DIR);

// ==================== Express 中间件 ====================
app.use(express.json({ limit: '10mb' }));

// JS/HTML 不缓存，保障版本更新立即生效
app.use((req, res, next) => {
  if (req.path.endsWith('.js') || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});

// 静态文件服务，根目录指向 public-v5/
app.use(express.static(PUBLIC_DIR));

// ==================== 工具函数 ====================

/** 生成时间戳文件名（用于版本备份） */
function generateVersionFilename() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
    Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  ].join('');
  return `config-${timestamp}.json`;
}

/** 从备份文件名中解析时间 */
function parseVersionInfo(filename) {
  // 格式: config-YYYYMMDDHHmmssSSS.json
  const match = filename.match(/^config-(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})\.json$/);
  if (!match) return null;
  const [, y, m, d, h, min, s, ms] = match;
  const date = new Date(`${y}-${m}-${d}T${h}:${min}:${s}.${ms}+08:00`);
  return {
    filename,
    date: date.toISOString(),
    label: `${y}-${m}-${d} ${h}:${min}:${s}`,
    size: null // 延迟计算
  };
}

// ==================== API: 配置 ====================

/** GET /api/config — 返回当前游戏配置 */
app.get('/api/config', (req, res) => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const data = JSON.parse(content);
      return res.json({ status: 'success', data });
    }
    res.json({ status: 'error', message: '配置文件不存在，请先通过编辑器保存' });
  } catch (error) {
    console.error('读取配置失败:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** POST /api/config/save — 保存配置并创建版本备份 */
app.post('/api/config/save', (req, res) => {
  try {
    const config = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ status: 'error', message: '无效的配置数据' });
    }

    // 1. 写入 game-config.json
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    console.log('💾 配置已写入 game-config.json');

    // 2. 创建时间戳备份到 server-data/versions/
    const versionFilename = generateVersionFilename();
    const versionPath = path.join(VERSIONS_DIR, versionFilename);
    fs.writeFileSync(versionPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log('📦 版本备份已创建:', versionFilename);

    res.json({
      status: 'success',
      version: versionFilename,
      timestamp: Date.now(),
      message: '配置已保存并创建版本备份'
    });
  } catch (error) {
    console.error('保存配置失败:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==================== API: 版本管理 ====================

/** GET /api/versions — 返回所有版本列表 */
app.get('/api/versions', (req, res) => {
  try {
    const files = fs.readdirSync(VERSIONS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const info = parseVersionInfo(f);
        if (!info) return null;
        try {
          const stat = fs.statSync(path.join(VERSIONS_DIR, f));
          info.size = stat.size;
          info.mtime = stat.mtime.toISOString();
        } catch {}
        return info;
      })
      .filter(Boolean)
      .sort((a, b) => b.filename.localeCompare(a.filename));

    console.log('📋 返回版本列表:', files.length, '个版本');
    res.json({ status: 'success', versions: files });
  } catch (error) {
    console.error('获取版本列表失败:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** GET /api/versions/:filename — 返回指定版本的内容 */
app.get('/api/versions/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    // 安全检查：防止路径穿越
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ status: 'error', message: '无效的文件名' });
    }
    const filePath = path.join(VERSIONS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ status: 'error', message: '版本不存在' });
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    res.json({ status: 'success', data, filename });
  } catch (error) {
    console.error('读取版本失败:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==================== API: 战绩历史 ====================

/** POST /api/history — 保存战绩 */
app.post('/api/history', (req, res) => {
  try {
    const { score, kills, wave, hero, difficulty, date } = req.body;
    if (score == null) {
      return res.status(400).json({ status: 'error', message: '缺少必填字段: score' });
    }

    // 读取现有战绩
    let history = [];
    if (fs.existsSync(HISTORY_FILE)) {
      try {
        history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
        if (!Array.isArray(history)) history = [];
      } catch { history = []; }
    }

    // 添加新记录
    const record = {
      id: Date.now().toString() + '_' + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
      score: score || 0,
      kills: kills || 0,
      wave: wave || 1,
      hero: hero || 'unknown',
      difficulty: difficulty || 'normal',
      date: date || new Date().toISOString(),
      savedAt: new Date().toISOString()
    };
    history.push(record);

    // 写入文件（只保留最近 200 条）
    if (history.length > 200) {
      history = history.slice(-200);
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
    console.log('🏆 战绩已保存:', record.id, '得分:', record.score);

    res.json({ status: 'success', record });
  } catch (error) {
    console.error('保存战绩失败:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** GET /api/history — 返回战绩历史 */
app.get('/api/history', (req, res) => {
  try {
    let history = [];
    if (fs.existsSync(HISTORY_FILE)) {
      try {
        history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
        if (!Array.isArray(history)) history = [];
      } catch { history = []; }
    }

    // 按时间倒序
    history.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

    // 支持分页
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const total = history.length;
    const start = (page - 1) * pageSize;
    const items = history.slice(start, start + pageSize);

    res.json({
      status: 'success',
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      records: items
    });
  } catch (error) {
    console.error('获取战绩失败:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==================== 根路径 ====================
app.get('/', (req, res) => {
  res.redirect('/index.html');
});

// Favicon 忽略
app.get('/favicon.ico', (req, res) => res.status(204).end());

// ==================== 启动服务器 ====================
app.listen(PORT, '0.0.0.0', () => {
  console.log('═══════════════════════════════════════');
  console.log('🎮 不完美作战 v5.0 — 后端服务已启动');
  console.log('═══════════════════════════════════════');
  console.log(`   端口:     ${PORT}`);
  console.log(`   游戏:     http://localhost:${PORT}/`);
  console.log(`   数据目录: server-data/`);
  console.log(`   版本备份: server-data/versions/`);
  console.log(`   战绩存储: server-data/history.json`);
  console.log(`   配置文件: public-v5/game-config.json`);
  console.log('═══════════════════════════════════════');
});
