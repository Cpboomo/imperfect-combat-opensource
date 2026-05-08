const fs = require('fs');
const path = 'C:/Users/cpp72/.openclaw-autoclaw/workspace/imperfect-combat/public/game.html';
let b = fs.readFileSync(path);

// Find the difficulty-select block
const selectStart = b.indexOf(Buffer.from('<select id="difficulty-select">'));
const selectEnd = b.indexOf(Buffer.from('</select>'), selectStart);
console.log('Select block:', selectStart, 'to', selectEnd);

// Build clean options
const cleanOptions = `<select id="difficulty-select">
                    <option value="n1" selected>🟢 入门</option>
                    <option value="n2">🟢 简单</option>
                    <option value="n3">🟢 普通</option>
                    <option value="n4">🔵 进阶</option>
                    <option value="n5">🔵 困难</option>
                    <option value="n6">🔵 噩梦</option>
                    <option value="n7">🟠 地狱</option>
                    <option value="n8">🟠 深渊</option>
                    <option value="n9">🔴 炼狱</option>
                    <option value="n10">🔴 不可能</option>
                </select>`;

// Replace the old select with clean version
b = Buffer.concat([
  b.subarray(0, selectStart),
  Buffer.from(cleanOptions),
  b.subarray(selectEnd + Buffer.from('</select>').length)
]);

// Fix difficulty-info
const diffInfo = b.indexOf(Buffer.from('difficulty-info'));
if (diffInfo >= 0) {
  // Find the content between > and <
  const gtPos = b.indexOf(0x3E, diffInfo); // >
  const ltPos = b.indexOf(0x3C, gtPos);     // <
  console.log('Difficulty info content:', b.subarray(gtPos+1, ltPos).toString());
  
  // Replace with clean text
  const cleanInfo = '怪物血量 ×1.0 | 刷怪速度 ×1.0 | 怪物速度 ×1.0';
  b = Buffer.concat([
    b.subarray(0, gtPos + 1),
    Buffer.from(cleanInfo),
    b.subarray(ltPos)
  ]);
}

// Also fix H1 - find it
const h1Start = b.indexOf(Buffer.from('<h1 class="game-title">'));
if (h1Start >= 0) {
  const h1End = b.indexOf(Buffer.from('</h1>'), h1Start);
  console.log('H1 current:', b.subarray(h1Start + 22, h1End).toString());
  b = Buffer.concat([
    b.subarray(0, h1Start + 22),
    Buffer.from('不完美作品'),
    b.subarray(h1End)
  ]);
}

fs.writeFileSync(path, b);
console.log('\nFixed select and info');
