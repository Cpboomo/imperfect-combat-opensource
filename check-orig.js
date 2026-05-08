const fs = require('fs');
const orig = fs.readFileSync('C:/Users/cpp72/.openclaw-autoclaw/workspace/imperfect-combat/public/game-orig.html', 'utf8');

// Check key parts
const title = orig.match(/<title>[^<]*<\/title>/);
console.log('Title:', title ? title[0] : 'N/A');

const h1 = orig.match(/<h1[^>]*>[^<]*<\/h1>/);
console.log('H1:', h1 ? h1[0] : 'N/A');

const opts = orig.match(/<option[^>]*value="n[0-9]+"[^>]*>[^<]*<\/option>/g);
if (opts) opts.forEach(o => console.log('Option:', o));

const feats = orig.match(/<span class="feature-tag">[^<]*<\/span>/g);
if (feats) feats.forEach(f => console.log('Feature:', f));

const sound = orig.match(/sound-text[^<]*<\/span>/);
console.log('Sound text:', sound ? sound[0] : 'N/A');

// Count corruption patterns
const corruptions = (orig.match(/\uFFFD/g) || []).length;
console.log('Corruption chars (�):', corruptions);
