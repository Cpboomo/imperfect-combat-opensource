const fs = require('fs');
let b = fs.readFileSync('C:/Users/cpp72/.openclaw-autoclaw/workspace/imperfect-combat/public/game.html');
let pat = Buffer.from('value="n1"');
let idx = b.indexOf(pat);
console.log('n1 at:', idx);
// Show 50 bytes from n1 start
console.log('Hex:', b.subarray(idx, idx+50).toString('hex'));
// Show ASCII-safe chars
let s = '';
for (let i = idx; i < idx + 50; i++) {
  if (b[i] >= 32 && b[i] < 127) s += String.fromCharCode(b[i]);
  else s += '.'; 
}
console.log('ASCII:', s);
