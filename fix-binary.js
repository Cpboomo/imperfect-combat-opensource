const fs = require('fs');
const path = 'C:/Users/cpp72/.openclaw-autoclaw/workspace/imperfect-combat/public/game.html';

let b = fs.readFileSync(path);

// Find all occurrences of EF BF BD 3F (the corrupted pattern: replacement char + ?)
const GARBAGE = Buffer.from([0xEF, 0xBF, 0xBD, 0x3F]);

// Context-based corrections
const corrections = [
  // 不完美作�? → 不完美作品 (operated by 作 = E4 BD 9C)
  { pre: Buffer.from([0xE4, 0xBD, 0x9C]), fix: Buffer.from([0xE5, 0x93, 0x81]) }, // 品
  // 开始作�? → 开始作品
  { pre: Buffer.from([0xA7, 0x8B, 0xE4, 0xBD, 0x9C]), fix: Buffer.from([0xE5, 0x93, 0x81]) }, // 品 after 始作
  // 怪物血�? → 怪物血量 (血 = E8 A1 80)
  { pre: Buffer.from([0xE8, 0xA1, 0x80]), fix: Buffer.from([0xE9, 0x87, 0x8F]) }, // 量
  // 自动��? → 🤖自动攻击
  // 闪现��? → ⚡闪现
];

let total = 0;
while (true) {
  const idx = b.indexOf(GARBAGE);
  if (idx < 0) break;
  
  // Check context before the garbage (4 bytes before)
  let found = false;
  for (const c of corrections) {
    const preIdx = idx - c.pre.length;
    if (preIdx >= 0 && b.subarray(preIdx, idx).equals(c.pre)) {
      b = Buffer.concat([b.subarray(0, idx), c.fix, b.subarray(idx + GARBAGE.length)]);
      total++;
      found = true;
      break;
    }
  }
  if (!found) break; // unknown pattern, stop
}

console.log('Fixed', total, 'corruptions');

// Now fix emoji/special chars that might be broken in feature tags
// Find: <span class="feature-tag">  blocks and check for corruption

fs.writeFileSync(path, b);
console.log('Written');
