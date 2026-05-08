const fs = require('fs');
const c = fs.readFileSync('C:/Users/cpp72/.openclaw-autoclaw/workspace/imperfect-combat/public/game.html', 'utf8');

// Check key elements
const h1 = c.match(/<h1[^>]*>[^<]*<\/h1>/);
console.log('H1:', h1 ? h1[0] : 'N/A');

const opts = c.match(/<option value="n\d+"[^>]*>[^<]*<\/option>/g);
if (opts) opts.forEach(o => console.log(o));

const startBtn = c.match(/开始[^<]*/);
if (startBtn) console.log('Start:', startBtn[0].substring(0, 30));

const feat = c.match(/<span class="feature-tag">[^<]*<\/span>/g);
if (feat) feat.forEach(f => console.log('Feature:', f));
