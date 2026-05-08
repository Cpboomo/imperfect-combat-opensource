const fs = require('fs');
const path = 'C:/Users/cpp72/.openclaw-autoclaw/workspace/imperfect-combat/public/game.html';
let content = fs.readFileSync(path, 'utf8');

// Find the sound-text line by exact substring search
const marker = "sound-text').textContent";
const idx = content.indexOf(marker);
if (idx >= 0) {
  const end = content.indexOf(';', idx);
  const oldLine = content.substring(idx - 55, end + 1); // include "document.getElementById('" prefix
  console.log('Old line:', JSON.stringify(oldLine));
  
  // Replace with clean version
  const newLine = "document.getElementById('sound-text').textContent = soundOn ? '音效已开启（点击关闭🔇）' : '音效已关闭（点击开启🔊）';";
  content = content.split(oldLine).join(newLine);
  
  fs.writeFileSync(path, content, 'utf8');
  console.log('Replaced');
  
  // Verify
  const idx2 = content.indexOf(marker);
  const end2 = content.indexOf(';', idx2);
  console.log('New line:', content.substring(idx2 - 55, end2 + 1));
} else {
  console.log('Marker not found');
}
