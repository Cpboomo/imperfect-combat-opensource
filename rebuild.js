const fs = require('fs');
const path = 'C:/Users/cpp72/.openclaw-autoclaw/workspace/imperfect-combat/public/game.html';

// Read as latin1 to preserve raw bytes
let content = fs.readFileSync(path, 'latin1');

// Find the start screen section
const startMarker = '<!-- ===== 启动画面 ===== -->';
const startIdx = content.indexOf(startMarker);
if (startIdx < 0) {
  console.log('Start screen marker not found');
  process.exit(1);
}

// Find the end of the start screen (the next major section after game canvas)
const gameCanvas = '<canvas id="gameCanvas"></canvas>';
const canvasIdx = content.indexOf(gameCanvas);
console.log('Start screen:', startIdx, 'Canvas:', canvasIdx);

// Extract everything: before start-screen, after start-screen
const before = content.substring(0, startIdx);
const after = content.substring(canvasIdx + gameCanvas.length);

// Build clean start screen
const cleanStartScreen = `<!-- ===== 启动画面 ===== -->
        <div id="start-screen">
            <h1 class="game-title">不完美作品</h1>
            <p class="game-subtitle">IMPERFECT COMBAT</p>
            <span class="version-tag">v4.3.7</span>
            <div class="feature-tags">
                <span class="feature-tag">🤖 自动战斗</span>
                <span class="feature-tag">🌊 波次生存</span>
                <span class="feature-tag">⚡ 闪现</span>
                <span class="feature-tag">🎵 音效</span>
            </div>
            <div class="difficulty-section">
                <label>🎯 选择难度</label>
                <select id="difficulty-select">
                    <option value="n1" selected>🟢 n1</option>
                    <option value="n2">🟢 n2</option>
                    <option value="n3">🟢 n3</option>
                    <option value="n4">🔵 n4</option>
                    <option value="n5">🔵 n5</option>
                    <option value="n6">🔵 n6</option>
                    <option value="n7">🟠 n7</option>
                    <option value="n8">🟠 n8</option>
                    <option value="n9">🔴 n9</option>
                    <option value="n10">🔴 n10</option>
                </select>
                <div class="difficulty-info" id="difficulty-info">
                    怪物血量 ×1.0 | 刷怪速度 ×1.0 | 怪物速度 ×1.0
                </div>
            </div>
            <button class="start-button" id="start-button">
                <span class="start-button-text">🎮 开始作品</span>
            </button>
            <div class="sound-toggle" id="sound-toggle">
                <span id="sound-icon">🔊</span>
                <span id="sound-text">音效已开启（点击关闭🔇）</span>
            </div>
        </div>`;

// Rebuild the file
const newContent = before + cleanStartScreen + '\n' + gameCanvas + after;

// Write as binary to preserve encoding
fs.writeFileSync(path, Buffer.from(newContent, 'latin1'));
console.log('Wrote clean start screen');

// Verify
const verify = fs.readFileSync(path, 'utf8');
const titleMatch = verify.match(/<title>[^<]*<\/title>/);
const h1Match = verify.match(/<h1[^>]*>[^<]*<\/h1>/);
console.log('Title:', titleMatch ? titleMatch[0] : 'NOT FOUND');
console.log('H1:', h1Match ? h1Match[0] : 'NOT FOUND');

const options = verify.match(/<option[^>]*>[^<]*<\/option>/g);
console.log('Options:', options ? options.length : 0);
if (options) options.forEach(o => console.log(' ', o));
