const fs=require('fs');let b=fs.readFileSync('C:/Users/cpp72/.openclaw-autoclaw/workspace/imperfect-combat/public/game.html');
if(b.indexOf(Buffer.from([0x31,0xEF,0xBF,0xBD,0x3F,0x2F,0x64,0x69,0x76,0x3E]))>=0){
  b=Buffer.concat([b.subarray(0,26623),Buffer.from([0x31,0xE6,0xAC,0xA1,0x3C,0x2F,0x64,0x69,0x76,0x3E]),b.subarray(26623+10)]);
  console.log('Fixed go-wave: 1次</div>');
}
let r=0;for(let i=0;i<b.length;i++){if(b[i]===0xEF&&b[i+1]===0xBF&&b[i+2]===0xBD)r++;}
console.log('Remaining:',r);
fs.writeFileSync('C:/Users/cpp72/.openclaw-autoclaw/workspace/imperfect-combat/public/game.html',b);
