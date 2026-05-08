// Splits game.js into 14 modules
const fs = require('fs');
const path = require('path');

const gs = fs.readFileSync('public/game.js', 'utf8');
const lines = gs.split('\n');
const modDir = 'public/modules';
if (!fs.existsSync(modDir)) fs.mkdirSync(modDir, { recursive: true });

// Build index of top-level constructs (const/let/var/function/class at column 0)
const tops = [];
for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  if (/^(const |let |var |function |class )/.test(t)) {
    tops.push({ line: i + 1, text: t.slice(0, 100) });
  }
}

// Print the top-level constructs for reference
console.log('Top-level constructs:');
tops.forEach(t => console.log(`  L${t.line}: ${t.text}`));

// Define module mapping: each key-value = module-file -> [first_line, last_line]
// We extract contiguous blocks per module.

// Strategy: collect line ranges per module, then merge adjacent ranges

const modules = {};

function addRange(mod, start, end) {
  if (!modules[mod]) modules[mod] = [];
  modules[mod].push({ start, end });
}

// ====== game-config.js ======
// Lines 1-429: everything up to but NOT including HERO_CLASSES
addRange('game-config.js', 1, 429);

// ====== game-hero.js ======
// Lines 431-473: HERO_CLASSES
addRange('game-hero.js', 431, 473);

// ====== game-audio.js ======
// Lines 474-508: audioCtx, initAudio, playSound, SFX, window._soundEnabled
addRange('game-audio.js', 474, 508);

// ====== game-core.js ======
// Lines 509-630: CHEST_CARDS through canvas/ctx
// Lines 632-821: worldToScreen through checkMonsterContact END
// Lines 954-1054: getWaveConfig through end of endWave
// Lines 1614-1701: updateGameOverPanel through formatTime
// Lines 1702-1785: restartGame
// Lines 1889-1968: updateCamera (render-related but independent), updateHUD
// Lines 2882-2940: lastFrameTime declared
// Lines 3074-3094: resizeCanvas
// Lines 3087-3179: getDifficultyFromURL, generateDefaultLevelData, loadLevel, setDifficulty, applyDifficultyToConfig, applyLevelData
addRange('game-core.js', 509, 630);  // CHEST_CARDS to canvas/ctx
addRange('game-core.js', 632, 821);  // coordinate system through checkMonsterContact end
addRange('game-core.js', 954, 1071); // wave system through end of endWave (pre-elite/Boss spawn)

// ====== game-ui.js ======
// Lines 1127-1248: showEqDetailOverlay through triggerVictory (pre-card shop UI)
addRange('game-ui.js', 1127, 1253);
// Lines 1614-1697: updateGameOverPanel through triggerGameOver
addRange('game-ui.js', 1614, 1701);
// Lines 3358-3394: showBondPanel through hideBondDetail
addRange('game-ui.js', 3358, 3394);

// ====== game-cards.js ======
// Lines 1255-1323: showCardShopUI through hideCardShopUI 
// Lines 3396-3420: drawChestIcon, checkChestClick
// Lines 3584-3624: openChestCard, closeChestCardOverlay
addRange('game-cards.js', 1255, 1323);
addRange('game-cards.js', 3396, 3420);
addRange('game-cards.js', 3584, 3492);  // to end

// ====== game-waves.js ======
// Lines 1073-1126: spawnEliteMonsters, spawnBoss
// Lines 1325-1417: updateWaveSystem, spawnWaveMonster
// Lines 3046-3060: updateMonsters
addRange('game-waves.js', 1073, 1126);
addRange('game-waves.js', 1325, 1417);
addRange('game-waves.js', 3046, 3060);

// ====== game-combat.js ======
// Lines 1419-1612: Projectile, Monster classes
// Lines 3302-3322: spawnTowerMonsters
addRange('game-combat.js', 1419, 1612);
addRange('game-combat.js', 3302, 3322);

// ====== game-movement.js ======
// Lines 658-692: ANode through findNearestWalkable
// Lines 693-700: calculateVector (already in core? check)
// Lines 734-765: getMP, canDash, regenMP, findNearestValidPosition, performDash
// Lines 2066-2126: drawDashEffects, drawPath
// Lines 2984-3044: updatePlayerMovement
addRange('game-movement.js', 658, 692);
addRange('game-movement.js', 734, 765);
addRange('game-movement.js', 2066, 2126);
addRange('game-movement.js', 2984, 3044);

// ====== game-render.js ======
// Lines 1969-2057: render start (portal, render fn, drawGrid, drawWalls)
// Lines 2059-2480: drawWalls through end of drawUI
// Lines 3323-3356: drawBondBtnTR, drawTowerButton
// Lines 3422-3582: drawTimeFreezeBtn, checkTimeFreezeClick, activateTimeFreeze
addRange('game-render.js', 1969, 2502); // render through end of drawUI + cultivation UI
addRange('game-render.js', 3323, 3356);
addRange('game-render.js', 3422, 3582);

// ====== game-cultivation.js ======
// Lines 1889-1968: updateCultivation, rollStudyPoint, updateCamera
// Lines 2504-2541: drawCultivationUI
// Lines 2543-2617: drawHiddenSwordPanel
// Lines 2619-2644: findDashSafeSpot
// Lines 3448-3560: handleHiddenSwordClick
addRange('game-cultivation.js', 1889, 1968);
addRange('game-cultivation.js', 2504, 2617);
addRange('game-cultivation.js', 3448, 3560);

// ====== game-ai.js ======
// Lines 2619-2644: findDashSafeSpot (used by AI)
// Lines 2646-2880: updateAI
addRange('game-ai.js', 2619, 2880);

// ====== game-events.js ======
// Lines 1142-1253: pointer interaction & triggerVictory
// Lines 1786-1888: handleCanvasClick, moveToPosition
// Lines 3062-3072: bindEvents
addRange('game-events.js', 1786, 1888);
addRange('game-events.js', 3062, 3072);

// ====== game-loop.js ======
// Lines 2882-3060: lastFrameTime, gameLoop, updatePlayerMovement, updateMonsters
// Lines 3181-3256: init, restartGameWithDifficulty, init() call
addRange('game-loop.js', 2882, 3044);
addRange('game-loop.js', 3181, 3256);

// Print what we have
console.log('\nModule ranges:');
for (const [mod, ranges] of Object.entries(modules)) {
  console.log(`  ${mod}: ${ranges.map(r => `${r.start}-${r.end}`).join(', ')}`);
}

// Now write each module by extracting those line ranges
for (const [mod, ranges] of Object.entries(modules)) {
  const outLines = [`// ${mod} — extracted from game.js`, ''];
  for (const { start, end } of ranges) {
    for (let i = start - 1; i < end; i++) {
      if (i < lines.length) outLines.push(lines[i]);
    }
  }
  const outPath = path.join(modDir, mod);
  fs.writeFileSync(outPath, outLines.join('\n'), 'utf8');
  console.log(`Wrote ${outPath}: ${outLines.length} lines`);
}
