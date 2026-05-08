// fix-html.js — Fix encoding issues in game.html
const fs = require('fs');
const path = 'C:/Users/cpp72/.openclaw-autoclaw/workspace/imperfect-combat/public/game.html';

let content = fs.readFileSync(path, 'utf8');

// Fix 1: sound-icon textContent line
content = content.replace(
  /document\.getElementById\('sound-icon'\)\.textContent\s*=\s*soundOn\s*\?\s*'[^']*'\s*:\s*'[^']*';/,
  "document.getElementById('sound-icon').textContent = soundOn ? '🔊' : '🔇';"
);

// Fix 2: sound-text textContent line  
content = content.replace(
  /document\.getElementById\('sound-text'\)\.textContent\s*=\s*soundOn\s*\?\s*'[^']*'\s*:\s*'[^']*';/,
  "document.getElementById('sound-text').textContent = soundOn ? '音效已开启（点击关闭🔇）' : '音效已关闭（点击开启🔊）';"
);

// Fix 3: HTML sound-text span (broken closing tag)
content = content.replace(
  /<span id="sound-text">[^<]*\/span>/,
  '<span id="sound-text">音效已开启（点击关闭🔇）</span>'
);

// Fix 4: version tag
content = content.replace(
  /<span class="version-tag">v4\.3\.\d+<\/span>/,
  '<span class="version-tag">v4.3.7</span>'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed game.html');
