const fs = require('fs');
const path = 'C:/Users/cpp72/.openclaw-autoclaw/workspace/imperfect-combat/public/game.html';
let content = fs.readFileSync(path, 'utf8');

let m = content.match(/<span id="sound-text">[^<]*<\/span>/);
if (m) console.log('HTML sound-text:', m[0]);

m = content.match(/<span class="version-tag">[^<]*<\/span>/);
if (m) console.log('Version tag:', m[0]);

m = content.match(/document.getElementById\('sound-icon'\)\.textContent = soundOn \? '[^']*' : '[^']*';/);
if (m) console.log('JS sound-icon:', m[0]);

m = content.match(/document.getElementById\('sound-text'\)\.textContent = soundOn \? '[^']*' : '[^']*';/);
if (m) console.log('JS sound-text:', m[0]);
