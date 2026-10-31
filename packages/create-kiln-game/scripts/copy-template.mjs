// Copy examples/cube into template/ (the example is the starter game).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../../../examples/cube');
const dest = path.resolve(here, '../template');
const skip = new Set(['node_modules', 'dist', '.kiln', 'smoke.png']);

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true, filter: (s) => !skip.has(path.basename(s)) });
// npm drops .gitignore from packages, so ship it under another name.
fs.writeFileSync(path.join(dest, '_gitignore'), 'node_modules/\ndist/\n.kiln/\n');
console.log('template copied from examples/cube');
