const fs = require('fs');
const path = 'C:/Users/cpp72/.openclaw-autoclaw/workspace/imperfect-combat/public/game.html';
const b = fs.readFileSync(path);

// Find all remaining EF BF BD patterns and their context
let count = 0;
for (let i = 0; i < b.length - 2; i++) {
  if (b[i] === 0xEF && b[i+1] === 0xBF && b[i+2] === 0xBD) {
    let ctx = b.subarray(Math.max(0,i-10), Math.min(b.length,i+15));
    // Show ASCII-safe string
    let s = '';
    for (let j = 0; j < ctx.length; j++) {
      let byte = ctx[j];
      if (byte >= 32 && byte < 127) s += String.fromCharCode(byte);
      else s += '.'; 
    }
    console.log(count + ': byte=' + i + ' hex=' + ctx.toString('hex').substring(0,30) + ' ascii=' + s);
    count++;
    if (count > 30) break;
  }
}
console.log('\nTotal: ' + count);

// Check H1 tag
const h1 = b.indexOf(Buffer.from('<h1 class="game-title">'));
if (h1 >= 0) {
  const h1End = b.indexOf(Buffer.from('</h1>'), h1);
  console.log('H1:', b.subarray(h1, h1End+5).toString());
}
