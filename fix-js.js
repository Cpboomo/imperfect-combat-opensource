const fs = require('fs');
const path = 'C:/Users/cpp72/.openclaw-autoclaw/workspace/imperfect-combat/public/game.html';
let content = fs.readFileSync(path, 'utf8');

// Fix sound-text JS line - the emoji is corrupted
const oldLine = /document\.getElementById\('sound-text'\)\.textContent\s*=\s*soundOn\s*\?\s*'[^']*'\s*:\s*'[^']*';/;
content = content.replace(oldLine, 
  "document.getElementById('sound-text').textContent = soundOn ? '音效已开启（点击关闭🔇）' : '音效已关闭（点击开启🔊）';"
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed JS sound-text line');

// Verify
let m = content.match(/sound-text.*textContent[^;]*;/);
console.log('Result:', m ? m[0] : 'NOT FOUND');
