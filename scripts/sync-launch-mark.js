/**
 * Copies resources/icon.png into the iOS LaunchMark asset catalog so LaunchScreen.storyboard
 * can show the mark at a fixed size (not the full-bleed @capacitor/assets splash bitmap).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'resources', 'icon.png');
const IMAGESET = path.join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'LaunchMark.imageset');
const DEST_IMAGE = path.join(IMAGESET, 'LaunchMark.png');

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error('[sync-launch-mark] Missing resources/icon.png');
    process.exit(1);
  }
  fs.mkdirSync(IMAGESET, { recursive: true });
  fs.copyFileSync(SOURCE, DEST_IMAGE);
  console.log('[sync-launch-mark] Updated', path.relative(ROOT, DEST_IMAGE));
}

if (require.main === module) {
  main();
}

module.exports = { main, SOURCE, IMAGESET, DEST_IMAGE };
