// Runs before `pnpm install`. Written in old JavaScript so that it runs on any Node.js version.
var parts = process.versions.node.split('.').map(Number);
var ok = parts[0] > 22 || (parts[0] === 22 && parts[1] >= 12) || (parts[0] === 20 && parts[1] >= 19) || parts[0] === 21;
if (!ok) {
  console.error('\n  cartridge.js needs Node.js 20.19+ or 22.12+. This shell uses Node.js ' + process.versions.node + ' (' + process.execPath + ').');
  console.error('  Fix: "nvm install && nvm use" (reads .nvmrc), or install Node.js 22 from https://nodejs.org\n');
  process.exit(1);
}
