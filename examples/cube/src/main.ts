import * as THREE from 'three';
import { steam } from '@kiln/steam';

// Achievement and stat names from Valve's "Spacewar" test app (App ID 480).
// Change them to the API names that you make in Steamworks.
const ACH_FIRST_TEN = 'ACH_WIN_ONE_GAME';
const STAT_GAMES = 'NumGames';
const SAVE_FILE = 'save.json';

interface Save {
  best: number;
}

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const scoreEl = document.querySelector<HTMLDivElement>('#score')!;
const bestEl = document.querySelector<HTMLDivElement>('#best')!;
const statusEl = document.querySelector<HTMLDivElement>('#status')!;

// --- three.js scene -------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d12);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
camera.position.set(0, 0, 12);

scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x202030, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(4, 6, 8);
scene.add(sun);

const geometry = new THREE.BoxGeometry(1, 1, 1);
const cubes: THREE.Mesh[] = [];

function spawnCube(): void {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(Math.random(), 0.7, 0.55),
    roughness: 0.4,
  });
  const cube = new THREE.Mesh(geometry, material);
  cube.position.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 4);
  cube.userData.spin = new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(2);
  scene.add(cube);
  cubes.push(cube);
}
for (let i = 0; i < 8; i++) spawnCube();

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// --- game state + Steam ---------------------------------------------------

let score = 0;
let save: Save = { best: 0 };

function toast(text: string): void {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.append(el);
  setTimeout(() => el.remove(), 2500);
}

function render(): void {
  scoreEl.textContent = String(score);
  bestEl.textContent = `Best: ${save.best}`;
}

async function onScore(): Promise<void> {
  score++;
  if (score > save.best) {
    save.best = score;
    await steam.cloud.writeJson(SAVE_FILE, save);
  }
  if (score === 10 && !(await steam.achievements.isUnlocked(ACH_FIRST_TEN))) {
    await steam.achievements.unlock(ACH_FIRST_TEN);
    const games = (await steam.stats.getInt(STAT_GAMES)) ?? 0;
    await steam.stats.setInt(STAT_GAMES, games + 1);
    await steam.stats.store();
    toast('Achievement unlocked: 10 cubes!');
  }
  render();
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
canvas.addEventListener('pointerdown', (e) => {
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(cubes)[0];
  if (!hit) return;
  const cube = hit.object as THREE.Mesh;
  scene.remove(cube);
  cubes.splice(cubes.indexOf(cube), 1);
  (cube.material as THREE.Material).dispose();
  spawnCube();
  void onScore();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && steam.isDesktop) void steam.app.quit();
});

async function boot(): Promise<void> {
  const status = await steam.ready();
  save = (await steam.cloud.readJson<Save>(SAVE_FILE)) ?? save;
  render();

  const user = await steam.user.get();
  const lines = [
    `shell: ${status.shell}`,
    status.available ? `Steam: app ${status.appId}` : `Steam: off`,
    user ? `player: ${user.name}` : '',
    status.isSteamDeck ? 'Steam Deck' : '',
  ].filter(Boolean);
  statusEl.textContent = lines.join('\n');
  if (!status.available && status.reason) console.info('[game] Steam not available:', status.reason);
  if (status.available) void steam.presence.set('steam_display', '#Status_InGame');
}
void boot();

// --- loop -----------------------------------------------------------------

const timer = new THREE.Timer();
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = timer.getDelta();
  for (const cube of cubes) {
    const s = cube.userData.spin as THREE.Vector3;
    cube.rotation.x += s.x * dt;
    cube.rotation.y += s.y * dt;
    cube.rotation.z += s.z * dt;
  }
  renderer.render(scene, camera);
});

// For automated smoke tests (scripts/smoke.mjs in the kiln repo). You can remove it.
(window as unknown as { __game: unknown }).__game = { score: () => score, onScore };
