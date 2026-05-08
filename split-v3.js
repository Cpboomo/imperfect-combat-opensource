// split-v3.js — 4-module contiguous split
const fs = require('fs');
const path = require('path');

const BASE = __dirname;
const src = fs.readFileSync(path.join(BASE, 'public', 'game.js'), 'utf8');
const lines = src.split('\n');

const modules = [
  { file: 'modules/game-data.js',    start: 1,    end: 629,  header: '// game-data.js — Config, heroes, audio, boss configs, game state\n\n' },
  { file: 'modules/game-logic.js',   start: 628,  end: 1968, header: '// game-logic.js — Coordinates, pathfinding, movement, combat, waves, cards, cultivation\n\n' },
  { file: 'modules/game-render.js',  start: 1969, end: 2881, header: '// game-render.js — All draw functions + cultivation UI + AI bot\n\n' },
  { file: 'modules/game-main.js',    start: 2882, end: 3492, header: '// game-main.js — Game loop, events, init, tower, bonds, chest, time freeze\n\n' },
];

fs.mkdirSync(path.join(BASE, 'public', 'modules'), { recursive: true });

modules.forEach(mod => {
  let out = mod.header;
  for (let i = mod.start - 1; i < mod.end && i < lines.length; i++) {
    out += lines[i] + '\n';
  }
  fs.writeFileSync(path.join(BASE, 'public', mod.file), out, 'utf8');
  console.log(`OK: ${mod.file} (${out.split('\n').length} lines)`);
});

// Update game.html
let html = fs.readFileSync(path.join(BASE, 'public', 'game.html'), 'utf8');
const order = ['modules/game-data.js', 'modules/game-logic.js', 'modules/game-render.js', 'modules/game-main.js'];
const tags = order.map(s => `    <script src="${s}"></script>`).join('\n');
html = html.replace(/<script src="game\.js[^"]*"><\/script>/, tags);
fs.writeFileSync(path.join(BASE, 'public', 'game.html'), html, 'utf8');

fs.renameSync(path.join(BASE, 'public', 'game.js'), path.join(BASE, 'public', 'game.js.bak'));
console.log('\nUpdated game.html with 4 module scripts');
console.log('Backed up game.js');
