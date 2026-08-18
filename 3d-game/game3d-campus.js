// =========================================================================
// Classroom of the Elite — 3D Campus World
// Purpose-Driven NPC Daily Routine, Schedule, Seating Reservation & AI Engine
// =========================================================================
import * as THREE from 'three';

// ---------- Config & AI ----------
const MODEL = 'agnes-2.5-flash';
const API_BASE = 'https://router.bynara.id/v1';
const BASE_STATS = { trust: 50, love: 10, respect: 50, wisdom: 70, courage: 40 };
const STAT_ICONS = { trust: '🤝', love: '❤️', respect: '🏅', wisdom: '🧠', courage: '💪' };
const STAT_COLORS = { trust: '#10b981', love: '#ec4899', respect: '#f59e0b', wisdom: '#8b5cf6', courage: '#ef4444' };
const MAX_MEMORY_TURNS = 24;

// Persisted State
let apiKey = localStorage.getItem('naraApiKey') || '';
let canTalk = false;
let stats = load('cote3dStats', { ...BASE_STATS });
let memory = load('cote3dConvos', {});
let story = load('cote3dStory', { i: -1, active: false, narrated: {} });
let storyConvo = load('cote3dStoryConvo', []);

function load(key, def) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? def; } catch { return def; } }
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.warn(e); } }
function toChatMessages(msgs) { return msgs.map(m => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.parts?.[0]?.text ?? '' })); }

// Runtime
let activeNPC = null;
let convo = [];
let camMode = 'free';

// ---------- DOM Elements ----------
const $ = id => document.getElementById(id);
const overlay = $('overlay'), keyInput = $('key-input');
const statsEl = $('stats'), sceneLabel = $('scene-label'), promptEl = $('prompt'), crosshair = $('crosshair');
const objectiveEl = $('objective'), ovText = $('ov-text');
const dialogue = $('dialogue'), dlgName = $('dlg-name'), dlgLog = $('dlg-log');
const dlgChoices = $('dlg-choices'), dlgInput = $('dlg-input'), dlgThinking = $('dlg-thinking');
const storyEl = $('story'), storySpeaker = $('story-speaker'), storyText = $('story-text'), storyThinking = $('story-thinking');
const debugPanel = $('debug-panel'), dbgRosterList = $('dbg-roster-list');
if (apiKey) keyInput.value = apiKey;

const toast = document.createElement('div');
toast.style.cssText = 'position:absolute;top:70px;left:50%;transform:translateX(-50%);background:rgba(13,16,24,.92);border:1px solid rgba(59,130,246,.4);color:#f1f5f9;padding:10px 18px;border-radius:10px;font-size:14px;display:none;backdrop-filter:blur(10px);box-shadow:0 10px 30px rgba(0,0,0,.5);z-index:100;';
$('hud').appendChild(toast);
let toastTimer = null;
function showToast(msg, ms = 4500) { toast.textContent = msg; toast.style.display = 'block'; clearTimeout(toastTimer); if (ms) toastTimer = setTimeout(() => toast.style.display = 'none', ms); }

// ---------- Character Voices (speechSynthesis) ----------
const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
let ttsOn = load('cote3dTTS', true);
let voicesReady = false;
let speakPriority = 0;
let speakingNpc = null;

const VOICE_STYLE = {
  Horikita:   { female: true,  pitch: 0.98, rate: 0.97, slot: 0 },
  Kushida:    { female: true,  pitch: 1.28, rate: 1.12, slot: 1 },
  Chabashira: { female: true,  pitch: 0.82, rate: 0.92, slot: 2 },
  Sudou:      { female: false, pitch: 0.86, rate: 1.12, slot: 0 },
  Kouenji:    { female: false, pitch: 1.02, rate: 0.86, slot: 1 },
  Hirata:     { female: false, pitch: 1.05, rate: 1.02, slot: 2 },
  Karuizawa:  { female: true,  pitch: 1.22, rate: 1.10, slot: 3 },
  Yukimura:   { female: false, pitch: 0.92, rate: 0.95, slot: 0 },
  Sakura:     { female: true,  pitch: 1.15, rate: 0.88, slot: 1 },
  Ike:        { female: false, pitch: 1.18, rate: 1.15, slot: 1 },
  Yamauchi:   { female: false, pitch: 0.90, rate: 1.08, slot: 2 },
  Narrator:   { female: false, pitch: 0.95, rate: 1.0,  slot: 2 },
};
const FEMALE_NAMES = /aria|jenny|michelle|ana|emma|zira|hazel|susan|samantha|nanami|mizuki|sonia|libby|maisie|natasha|clara|amber|ashley|cora|elizabeth|monica|sara|luna|karen|moira|tessa|fiona|victoria|female|woman|girl/i;
const MALE_NAMES = /guy|davis|andrew|brian|christopher|eric|jacob|roger|steffan|tony|ryan|thomas|david|mark|alex|daniel|george|liam|william|keita|fred|rishi|arthur|oliver|male|man|boy/i;
const voicePool = { female: [], male: [] };

function loadVoices() {
  if (!synth) return;
  const all = synth.getVoices();
  if (!all.length) return;
  const score = v => (/natural|online/i.test(v.name) ? 4 : 0) + (/^en[-_]/i.test(v.lang) ? 2 : 0) + (v.localService ? 0 : 1);
  const sorted = all.slice().sort((a, b) => score(b) - score(a));
  voicePool.female = sorted.filter(v => FEMALE_NAMES.test(v.name));
  voicePool.male = sorted.filter(v => MALE_NAMES.test(v.name) && !FEMALE_NAMES.test(v.name));
  const rest = sorted.filter(v => !voicePool.female.includes(v) && !voicePool.male.includes(v));
  if (!voicePool.female.length) voicePool.female = rest.slice();
  if (!voicePool.male.length) voicePool.male = rest.slice().reverse();
  if (!voicePool.female.length) voicePool.female = sorted.slice();
  if (!voicePool.male.length) voicePool.male = sorted.slice();
  voicesReady = true;
}
function voiceFor(name) {
  const st = VOICE_STYLE[name] || VOICE_STYLE.Narrator;
  const pool = st.female ? voicePool.female : voicePool.male;
  return pool.length ? pool[st.slot % pool.length] : null;
}
if (synth) { loadVoices(); synth.addEventListener?.('voiceschanged', loadVoices); synth.onvoiceschanged = loadVoices; }

function cleanForSpeech(text) {
  return String(text || '')
    .replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ')
    .replace(/[*_`#>~|]/g, ' ')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ')
    .replace(/[—–]/g, ', ')
    .replace(/\s+/g, ' ').trim().slice(0, 400);
}

function speakAs(name, text, priority = 2, npc = null) {
  if (!synth || !ttsOn) return;
  if (!voicesReady) loadVoices();
  const line = cleanForSpeech(text);
  if (!line) return;
  if (synth.speaking && priority < speakPriority) return;
  if (synth.speaking || synth.pending) synth.cancel();
  const st = VOICE_STYLE[name] || VOICE_STYLE.Narrator;
  const u = new SpeechSynthesisUtterance(line);
  const v = voiceFor(name);
  if (v) { u.voice = v; u.lang = v.lang; }
  u.pitch = st.pitch; u.rate = st.rate; u.volume = 1;
  speakPriority = priority;
  u.onstart = () => { speakingNpc = npc; if (npc) npc.speaking = true; };
  u.onend = u.onerror = () => { if (npc) npc.speaking = false; if (speakingNpc === npc) speakingNpc = null; speakPriority = 0; };
  try { synth.speak(u); } catch (e) { console.warn('TTS failed:', e); }
}
function stopSpeech() {
  if (!synth) return;
  try { synth.cancel(); } catch {}
  npcs.forEach(n => n.speaking = false);
  speakingNpc = null; speakPriority = 0;
}

const soundChip = document.createElement('div');
soundChip.style.cssText = 'background:rgba(13,16,24,.88);border:1px solid var(--border);border-radius:10px;padding:8px 14px;font-size:13px;backdrop-filter:blur(10px);pointer-events:auto;cursor:pointer;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.5);';
soundChip.title = 'Character voices on/off (M)';
function refreshSoundChip() { soundChip.textContent = ttsOn ? '🔊 Voices on' : '🔇 Voices off'; }
function toggleTTS() {
  ttsOn = !ttsOn; save('cote3dTTS', ttsOn); refreshSoundChip();
  if (!ttsOn) stopSpeech();
  showToast(ttsOn ? '🔊 Character voices on' : '🔇 Character voices off', 2200);
}
soundChip.onclick = toggleTTS;
refreshSoundChip();
$('topright').appendChild(soundChip);

// ---------- Three.js WebGL Engine ----------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd6e8f8, 140, 520);
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 1000);
const EYE = 1.7;
camera.position.set(0, EYE, 40);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Lighting
const hemi = new THREE.HemisphereLight(0xeef7ff, 0x8a9890, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff6e5, 2.5);
sun.position.set(110, 190, 80);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -170; sun.shadow.camera.right = 170;
sun.shadow.camera.top = 170; sun.shadow.camera.bottom = -170;
sun.shadow.camera.near = 10; sun.shadow.camera.far = 480;
sun.shadow.bias = -0.0004;
scene.add(sun);

// Sky Dome
const skyMat = new THREE.ShaderMaterial({
  uniforms: { topC: { value: new THREE.Color(0x4f93d1) }, botC: { value: new THREE.Color(0xe9f3fb) } },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 topC; uniform vec3 botC; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*0.5+0.5, 0.0, 1.0); gl_FragColor = vec4(mix(botC, topC, pow(h, 0.75)), 1.0); }',
  side: THREE.BackSide, depthWrite: false, fog: false
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(650, 32, 16), skyMat);
scene.add(skyDome);

// ---------- Material & Texture Helpers ----------
const std = (o) => new THREE.MeshStandardMaterial(o);
const phys = (o) => new THREE.MeshPhysicalMaterial(o);
function rand(a, b) { return a + Math.random() * (b - a); }

function noiseTexture(base, shades, n, repeat = 1) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = shades[Math.random() * shades.length | 0];
    ctx.globalAlpha = 0.1 + Math.random() * 0.15;
    const s = 1 + Math.random() * 3;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, s, s);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function tileTexture(base1, base2, tiles = 8) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const s = 256 / tiles;
  for (let i = 0; i < tiles; i++) {
    for (let j = 0; j < tiles; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? base1 : base2;
      ctx.fillRect(i * s, j * s, s, s);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2;
      ctx.strokeRect(i * s, j * s, s, s);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function brickTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const bw = 64, bh = 26;
  for (let row = 0; row < 128 / bh; row++) {
    for (let col = -1; col < 256 / bw + 1; col++) {
      const l = 1 + rand(-0.12, 0.12);
      g.fillStyle = `rgb(${Math.round(145 * l)}, ${Math.round(72 * l)}, ${Math.round(24 * l)})`;
      const off = row % 2 === 1 ? bw / 2 : 0;
      g.fillRect(col * bw + off, row * bh, bw - 2, bh - 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function textSignTexture(text, px, color = '#FFD700', bg = '#0E1420') {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = 'rgba(255,215,0,0.3)'; ctx.lineWidth = 6; ctx.strokeRect(10, 10, 1004, 236);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = color; ctx.shadowBlur = 20; ctx.fillStyle = color;
  ctx.font = `bold ${px}px Arial, sans-serif`;
  ctx.fillText(text, 512, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- Collision System ----------
const colliders = [];
function addCollider(x, z, w, d) { colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 }); }
function collidesAt(x, z, r) {
  for (const c of colliders) {
    if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true;
  }
  return false;
}

function makeBox(w, h, d, mat, x, y, z, parent = scene, cast = true, recv = true, collide = false) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = recv;
  parent.add(m);
  if (collide) {
    const wp = new THREE.Vector3();
    m.getWorldPosition(wp);
    addCollider(wp.x, wp.z, w, d);
  }
  return m;
}

function findFreeSpot(x, z, r = 0.55) {
  if (!collidesAt(x, z, r)) return { x, z };
  for (let ring = 1; ring <= 16; ring++) {
    for (let a = 0; a < 20; a++) {
      const ang = (a / 20) * Math.PI * 2, d = ring * 0.9;
      const nx = x + Math.cos(ang) * d, nz = z + Math.sin(ang) * d;
      if (!collidesAt(nx, nz, r)) return { x: nx, z: nz };
    }
  }
  return { x, z };
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function makeLabel(text, x, y, z, color = 0xffffff, scale = 1.6) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(10,12,18,0.78)'; roundRect(ctx, 6, 30, 500, 68, 20); ctx.fill();
  ctx.font = 'bold 50px Segoe UI, sans-serif'; ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  spr.position.set(x, y, z); spr.scale.set(scale * 2, scale * 0.5, 1); scene.add(spr); return spr;
}

// =========================================================================
// CENTRAL SCHOOL SCHEDULE SYSTEM (CONFIGURABLE TIMETABLE)
// =========================================================================
export const SCHOOL_SCHEDULE = [
  { id: 'ARRIVAL',      start: '07:30', end: '08:15', activity: 'ARRIVING_AT_SCHOOL', label: 'School Arrival' },
  { id: 'CLASS_1',      start: '08:15', end: '10:00', activity: 'CLASS',              label: 'Morning Class 1' },
  { id: 'BREAK',        start: '10:00', end: '10:15', activity: 'BREAK',              label: 'Morning Break' },
  { id: 'CLASS_2',      start: '10:15', end: '12:00', activity: 'CLASS',              label: 'Morning Class 2' },
  { id: 'LUNCH',        start: '12:00', end: '13:00', activity: 'LUNCH',              label: 'Lunch Break' },
  { id: 'CLASS_3',      start: '13:00', end: '15:00', activity: 'AFTERNOON_CLASS',    label: 'Afternoon Class' },
  { id: 'ACTIVITIES',   start: '15:00', end: '17:30', activity: 'PERSONAL_ACTIVITY',  label: 'Clubs & Activities' },
  { id: 'EVENING',      start: '17:30', end: '20:00', activity: 'EVENING_LEISURE',    label: 'Evening Leisure' },
  { id: 'DORM_STUDY',   start: '20:00', end: '22:30', activity: 'DORM_TIME',          label: 'Dormitory Free Time' },
  { id: 'NIGHT_REST',   start: '22:30', end: '07:30', activity: 'NIGHT_REST',         label: 'Curfew & Rest' }
];

function timeStrToMin(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

function getCurrentScheduleEvent(min) {
  const normalized = ((min % 1440) + 1440) % 1440;
  for (const evt of SCHOOL_SCHEDULE) {
    const s = timeStrToMin(evt.start), e = timeStrToMin(evt.end);
    if (s < e) {
      if (normalized >= s && normalized < e) return evt;
    } else {
      // Wraps overnight (e.g. 22:30 - 07:30)
      if (normalized >= s || normalized < e) return evt;
    }
  }
  return SCHOOL_SCHEDULE[0];
}

// =========================================================================
// CAMPUS LOCATIONS & INTERACTIVE SEATING REGISTRY
// =========================================================================
export const campusLocations = {
  courtyard:   { label: 'Central Courtyard',           c: [0, 8],     node: 'courtA' },
  class1d:     { label: 'Class 1-D (West Wing)',       c: [-62, -20], node: 'classA' },
  library:     { label: 'Memorial Library (West Wing)',c: [-62, 22],  node: 'libA' },
  hall:        { label: 'Main Hall & Academic Center', c: [0, -56],   node: 'hallA' },
  council:     { label: 'Student Council Room',        c: [26, -56],  node: 'councilA' },
  cafeteria:   { label: 'Cafeteria (East Wing)',       c: [62, -20],  node: 'cafA' },
  gym:         { label: 'Gymnasium (East Wing)',       c: [62, 22],   node: 'gymA' },
  field:       { label: 'Sports Field & Track',        c: [-62, 60],  node: 'fieldW' },
  aquatic:     { label: 'Olympic Aquatic Center',      c: [-62, 92],  node: 'aquaW' },
  dorm:        { label: 'Dormitory Tower',             c: [-34, 58],  node: 'dormA' },
  room401:     { label: 'Room 401 (Ayanokouji Dorm)',  c: [-50, 58],  node: 'roomA' },
  store:       { label: 'Convenience Store & SIV',     c: [34, 54],   node: 'storeA' },
  cafe:        { label: 'Palette Café',                c: [54, 54],   node: 'cafeA' },
  mall:        { label: 'Keyaki Mall & Atrium',        c: [44, 78],   node: 'mallA' },
  gate:        { label: 'Front Gate',                  c: [0, 95],    node: 'gateN' },
  seaside:     { label: 'Seaside Coastal Promenade',   c: [0, -145],  node: 'seaN' }
};
const LOC = campusLocations;

// Spatial Interactive Spots Registry (Seats, Desks, Tables, Drill stations)
export const SPOTS = {};

function registerSpot(id, loc, x, y, z, facing, type = 'seat', extra = {}) {
  SPOTS[id] = { id, loc, x, y, z, facing, type, reservedBy: null, occupiedBy: null, ...extra };
}

// 1. Generate Class 1-D Desks (25 Seats in 5x5 layout + Teacher podium)
// In buildClassroom1D, group at (-62, 0.2, -20) rotated -PI/2.
// dx = -3.6 + col * 1.8; dz = -1.6 + row * 1.3;
// In world coordinates: X = -62 + (dz + 0.42), Z = -20 - dx.
for (let row = 0; row < 5; row++) {
  for (let col = 0; col < 5; col++) {
    const seatNum = row * 5 + col + 1;
    const seatId = `CLASS_1D_SEAT_${String(seatNum).padStart(2, '0')}`;
    const dx = -3.6 + col * 1.8;
    const dz = -1.6 + row * 1.3;
    const wx = -62 + (dz + 0.42);
    const wz = -20 - dx;
    registerSpot(seatId, 'class1d', wx, 0, wz, -Math.PI / 2, 'desk_seat', {
      deskPos: { x: -62 + dz, y: 0.72, z: -20 - dx },
      row, col
    });
  }
}
registerSpot('CLASS_1D_TEACHER', 'class1d', -65.2, 0, -20, Math.PI / 2, 'podium');

// 2. Generate Cafeteria Dining Tables (6 tables x 4 seats = 24 seats)
// Cafeteria at (62, 0, -20) rotated PI/2.
// tx = -7 + c * 14, tz = -2 + r * 4.5;
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 2; c++) {
    const tableNum = r * 2 + c + 1;
    const tx = -7 + c * 14, tz = -2 + r * 4.5;
    // 4 seats per table along benches: (tx - 2.5, tz - 1.1), (tx + 2.5, tz - 1.1), (tx - 2.5, tz + 1.1), (tx + 2.5, tz + 1.1)
    const seatOffsets = [
      { sx: tx - 2.5, sz: tz - 1.1, f: Math.PI / 2 },
      { sx: tx + 2.5, sz: tz - 1.1, f: Math.PI / 2 },
      { sx: tx - 2.5, sz: tz + 1.1, f: -Math.PI / 2 },
      { sx: tx + 2.5, sz: tz + 1.1, f: -Math.PI / 2 }
    ];
    seatOffsets.forEach((so, si) => {
      const sId = `CAFETERIA_T${tableNum}_S${si + 1}`;
      // Rotated by PI/2: worldX = 62 - so.sz, worldZ = -20 + so.sx
      const wx = 62 - so.sz, wz = -20 + so.sx;
      registerSpot(sId, 'cafeteria', wx, 0, wz, so.f + Math.PI / 2, 'dining_seat', { table: tableNum });
    });
  }
}

// 3. Generate Memorial Library Study Desks (12 reading seats)
for (let i = 0; i < 12; i++) {
  const sId = `LIBRARY_DESK_${String(i + 1).padStart(2, '0')}`;
  const ang = (i / 12) * Math.PI * 1.5 + 0.3;
  const rad = 7.5;
  const wx = -62 + Math.cos(ang) * rad;
  const wz = 22 + Math.sin(ang) * rad;
  registerSpot(sId, 'library', wx, 0, wz, ang + Math.PI, 'library_seat');
}

// 4. Generate Gymnasium Stations
registerSpot('GYM_HOOP_N', 'gym', 62, 0, 8, -Math.PI / 2, 'sport_drill');
registerSpot('GYM_HOOP_S', 'gym', 62, 0, 36, Math.PI / 2, 'sport_drill');
registerSpot('GYM_COURT_MID', 'gym', 62, 0, 22, 0, 'sport_drill');
for (let b = 1; b <= 4; b++) {
  registerSpot(`GYM_BENCH_${b}`, 'gym', 51.5 + b * 1.2, 0, 22, -Math.PI / 2, 'bench');
}

// 5. Generate Sports Field & Aquatic Stations
registerSpot('FIELD_PITCH_N', 'field', -62, 0, 50, 0, 'sport_drill');
registerSpot('FIELD_PITCH_S', 'field', -62, 0, 70, Math.PI, 'sport_drill');
registerSpot('FIELD_TRACK_1', 'field', -44, 0, 60, Math.PI / 2, 'sport_drill');
registerSpot('AQUA_DECK_1', 'aquatic', -62, 0, 82, 0, 'sport_drill');
registerSpot('AQUA_DECK_2', 'aquatic', -62, 0, 102, Math.PI, 'sport_drill');

// 6. Generate Commercial & Leisure Spots
registerSpot('CAFE_T1_S1', 'cafe', 51.6, 0, 53.0, 0, 'cafe_seat');
registerSpot('CAFE_T1_S2', 'cafe', 56.4, 0, 53.0, Math.PI, 'cafe_seat');
registerSpot('MALL_SOFA_1', 'mall', 56, 0, 82, -Math.PI / 2, 'social_seat');
registerSpot('MALL_SOFA_2', 'mall', 56, 0, 74, -Math.PI / 2, 'social_seat');
registerSpot('SIV_COUNTER', 'store', 34, 0, 54, 0, 'inspect_spot');
registerSpot('DORM_ROOM_401', 'room401', -50, 0, 58, 0, 'dorm_desk');

// 7. Central Courtyard Benches
for (let i = 1; i <= 6; i++) {
  const bSpots = [[-8, 28], [8, 28], [-8, 2], [8, 2], [-8, 38], [8, 60]];
  registerSpot(`COURTYARD_BENCH_${i}`, 'courtyard', bSpots[i - 1][0], 0, bSpots[i - 1][1], 0, 'park_bench');
}

// Reservation Manager
export const ReservationManager = {
  reserve(spotId, npcId) {
    const spot = SPOTS[spotId];
    if (!spot) return false;
    if (spot.reservedBy && spot.reservedBy !== npcId) return false;
    spot.reservedBy = npcId;
    return true;
  },
  release(spotId, npcId) {
    const spot = SPOTS[spotId];
    if (spot && spot.reservedBy === npcId) {
      spot.reservedBy = null;
      spot.occupiedBy = null;
    }
  },
  releaseAllForNPC(npcId) {
    for (const spot of Object.values(SPOTS)) {
      if (spot.reservedBy === npcId) {
        spot.reservedBy = null;
        spot.occupiedBy = null;
      }
    }
  },
  findAvailableSpot(locKey, type = null, filterFn = null) {
    for (const spot of Object.values(SPOTS)) {
      if (spot.loc !== locKey) continue;
      if (type && spot.type !== type) continue;
      if (spot.reservedBy) continue;
      if (filterFn && !filterFn(spot)) continue;
      return spot;
    }
    return null;
  }
};

// =========================================================================
// NAVIGATION GRAPH & WAYPOINT PATHFINDING
// =========================================================================
const NAV_NODES = {
  hub: [0, 0], courtA: [0, 8], fountW: [-9, 8], fountE: [9, 8],
  plazaN: [0, 22], plazaS: [0, -20], hallA: [0, -40], councilA: [20, -40],
  wMid: [-46, 0], classA: [-46, -20], classDoor: [-56, -20], libA: [-46, 22], libDoor: [-50, 22],
  eMid: [46, 0], cafA: [46, -20], cafDoor: [52, -20], gymA: [46, 22], gymDoor: [50, 22], eNorth: [46, 44],
  northA: [0, 44], northB: [0, 70], gateN: [0, 90],
  dormA: [-34, 44], dormDoor: [-34, 50], roomA: [-50, 44], roomDoor: [-50, 52],
  fieldW: [-62, 44], aquaW: [-62, 76],
  storeA: [34, 44], storeDoor: [34, 48], cafeA: [54, 44], cafeDoor: [54, 48], mallA: [44, 66], mallDoor: [44, 72],
  seaN: [0, -125], seaWalk: [0, -140]
};

const NAV_EDGES = [
  ['hub', 'fountW'], ['hub', 'fountE'], ['fountW', 'courtA'], ['fountE', 'courtA'],
  ['hub', 'plazaS'], ['hub', 'plazaN'], ['hub', 'wMid'], ['hub', 'eMid'],
  ['plazaS', 'hallA'], ['hallA', 'councilA'], ['hallA', 'seaN'], ['seaN', 'seaWalk'],
  ['plazaN', 'northA'], ['northA', 'northB'], ['northB', 'gateN'],
  ['wMid', 'classA'], ['classA', 'classDoor'], ['wMid', 'libA'], ['libA', 'libDoor'],
  ['eMid', 'cafA'], ['cafA', 'cafDoor'], ['eMid', 'gymA'], ['gymA', 'gymDoor'],
  ['northA', 'dormA'], ['dormA', 'dormDoor'], ['dormA', 'roomA'], ['roomA', 'roomDoor'],
  ['dormA', 'fieldW'], ['fieldW', 'aquaW'],
  ['northA', 'storeA'], ['storeA', 'storeDoor'], ['storeA', 'cafeA'], ['cafeA', 'cafeDoor'], ['storeA', 'eNorth'],
  ['eNorth', 'mallA'], ['mallA', 'mallDoor'], ['eNorth', 'gymA']
];

const NAV_ADJ = {};
for (const k of Object.keys(NAV_NODES)) NAV_ADJ[k] = [];
for (const [a, b] of NAV_EDGES) { NAV_ADJ[a].push(b); NAV_ADJ[b].push(a); }

function navPath(from, to) {
  if (from === to) return [to];
  const prev = { [from]: null }, q = [from];
  while (q.length) {
    const cur = q.shift();
    if (cur === to) break;
    for (const nb of NAV_ADJ[cur] || []) if (!(nb in prev)) { prev[nb] = cur; q.push(nb); }
  }
  if (!(to in prev)) return [to];
  const out = []; for (let c = to; c; c = prev[c]) out.unshift(c);
  return out;
}

function nearestNode(x, z) {
  let best = null, bd = Infinity;
  for (const [k, p] of Object.entries(NAV_NODES)) {
    const d = Math.hypot(p[0] - x, p[1] - z);
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

function resolveLoc(str) {
  const s = (str || '').toLowerCase();
  if (/librar/.test(s)) return 'library';
  if (/cafeteria|canteen|dining|lunch/.test(s)) return 'cafeteria';
  if (/caf[eé]|coffee/.test(s)) return 'cafe';
  if (/class/.test(s)) return 'class1d';
  if (/hall|auditor|ceremony|assembly|academic/.test(s)) return 'hall';
  if (/council|president/.test(s)) return 'council';
  if (/dorm|room/.test(s)) return 'dorm';
  if (/gym/.test(s)) return 'gym';
  if (/field|sport|track|soccer|playground/.test(s)) return 'field';
  if (/pool|swim|aquatic|diving/.test(s)) return 'aquatic';
  if (/mall|shop|atrium|karaoke/.test(s)) return 'mall';
  if (/store|conven|camera|siv/.test(s)) return 'store';
  if (/gate|bus|entrance/.test(s)) return 'gate';
  if (/seaside|ocean|beach|coast|boulevard/.test(s)) return 'seaside';
  if (/court|yard|plaza|fountain/.test(s)) return 'courtyard';
  return LOC[s] ? s : null;
}

// =========================================================================
// 15-MODEL HIGH-FIDELITY 3D CAMPUS ENVIRONMENT
// =========================================================================
const campus = new THREE.Group();
const grpGround = new THREE.Group();
const grpCentralPark = new THREE.Group();
const grpAcademicNorth = new THREE.Group();
const grpWestWing = new THREE.Group();
const grpEastWing = new THREE.Group();
const grpAthleticsWest = new THREE.Group();
const grpResidentialSW = new THREE.Group();
const grpCommercialSE = new THREE.Group();
const grpSeasideNorth = new THREE.Group();

campus.add(
  grpGround, grpCentralPark, grpAcademicNorth, grpWestWing, grpEastWing,
  grpAthleticsWest, grpResidentialSW, grpCommercialSE, grpSeasideNorth
);
scene.add(campus);

let waterUniforms = null;
let oceanUniforms = null;

function buildCampusFoundation() {
  const grassMat = std({ map: noiseTexture('#7aa84f', ['#6c9842', '#5f8838', '#86b65a'], 2400, 48), roughness: 0.95 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), grassMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  grpGround.add(ground);

  const paveMat = std({ map: tileTexture('#e4dfd0', '#d8d1c0', 8), roughness: 0.55 });
  paveMat.map.repeat.set(12, 12);

  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), paveMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.01, 8);
  plaza.receiveShadow = true;
  grpGround.add(plaza);

  const nsProm = new THREE.Mesh(new THREE.PlaneGeometry(14, 180), paveMat);
  nsProm.rotation.x = -Math.PI / 2;
  nsProm.position.set(0, 0.012, 20);
  nsProm.receiveShadow = true;
  grpGround.add(nsProm);

  const ewProm = new THREE.Mesh(new THREE.PlaneGeometry(230, 14), paveMat);
  ewProm.rotation.x = -Math.PI / 2;
  ewProm.position.set(0, 0.012, 0);
  ewProm.receiveShadow = true;
  grpGround.add(ewProm);

  [-46, 46].forEach(px => {
    const sideP = new THREE.Mesh(new THREE.PlaneGeometry(14, 96), paveMat);
    sideP.rotation.x = -Math.PI / 2;
    sideP.position.set(px, 0.012, 0);
    sideP.receiveShadow = true;
    grpGround.add(sideP);
  });

  const crossSt = new THREE.Mesh(new THREE.PlaneGeometry(120, 14), paveMat);
  crossSt.rotation.x = -Math.PI / 2;
  crossSt.position.set(0, 0.012, 44);
  crossSt.receiveShadow = true;
  grpGround.add(crossSt);
}

function buildCentralPark() {
  const g = grpCentralPark;
  g.position.set(0, 0, 8);

  const matGranite = std({ color: 0x8e8d8a, roughness: 0.5, metalness: 0.05 });
  const fountBase = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.8, 0.9, 36), matGranite);
  fountBase.position.y = 0.45;
  fountBase.castShadow = true; fountBase.receiveShadow = true;
  g.add(fountBase);
  addCollider(0, 8, 8.0, 8.0);

  const fountWater = new THREE.Mesh(new THREE.CircleGeometry(7.0, 36), phys({ color: 0x22a6b3, transmission: 0.85, roughness: 0.1, ior: 1.33 }));
  fountWater.rotation.x = -Math.PI / 2;
  fountWater.position.y = 0.8;
  g.add(fountWater);

  const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.0, 1.4, 28), matGranite);
  tier2.position.y = 1.3;
  tier2.castShadow = true;
  g.add(tier2);

  const centerCol = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 3.2, 20), matGranite);
  centerCol.position.y = 2.8;
  centerCol.castShadow = true;
  g.add(centerCol);

  const topSpire = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.8, 16), matGranite);
  topSpire.position.y = 4.8;
  g.add(topSpire);

  const sakuraMat = std({ color: 0xfda4af, roughness: 0.9 });
  const trunkMat = std({ color: 0x5a3a22, roughness: 0.85 });

  const treeSpots = [
    [-22, 26], [22, 26], [-22, -8], [22, -8], [-26, 36], [26, 36],
    [18, -30], [-18, -30], [-70, 34], [70, 34], [14, 62], [-14, 62]
  ];
  treeSpots.forEach(([tx, tz]) => {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 4.5, 8), trunkMat);
    trunk.position.set(tx, 2.25, tz);
    trunk.castShadow = true;
    g.add(trunk);
    const canopy = new THREE.Mesh(new THREE.DodecahedronGeometry(3.0, 1), sakuraMat);
    canopy.position.set(tx, 5.8, tz);
    canopy.castShadow = true;
    g.add(canopy);
    addCollider(tx, tz + 8, 1.0, 1.0);
  });

  const benchSpots = [[-8, 20], [8, 20], [-8, -6], [8, -6], [-8, 30], [8, 52]];
  benchSpots.forEach(([bx, bz]) => {
    makeBox(2.4, 0.45, 0.7, matGranite, bx, 0.225, bz, g);
    addCollider(bx, bz + 8, 2.4, 0.7);
  });

  const lampSpots = [[-10, 18], [10, 18], [-10, -12], [10, -12], [-40, 8], [40, 8], [-10, 38], [10, 38]];
  lampSpots.forEach(([lx, lz]) => {
    makeBox(0.25, 4.2, 0.25, std({ color: 0x3a3f47 }), lx, 2.1, lz, g);
    makeBox(0.6, 0.2, 0.4, std({ color: 0xffffff, emissive: 0xfff3d4, emissiveIntensity: 1.8 }), lx, 4.2, lz, g);
    addCollider(lx, lz + 8, 0.5, 0.5);
  });
}

function buildAcademicBuilding() {
  const g = grpAcademicNorth;
  g.position.set(0, 0, -56);

  const M = {
    steel: std({ color: 0x3a3d40, roughness: 0.3, metalness: 0.85 }),
    glass: phys({ color: 0xa8c2d4, transmission: 0.88, roughness: 0.1, ior: 1.5 }),
    concrete: std({ color: 0xb0b0b0, roughness: 0.45 }),
    concreteDark: std({ color: 0x808388, roughness: 0.55 }),
    roofGrey: std({ color: 0x71747a, roughness: 0.7 })
  };

  const BLD = { L: 60, D: 26, H: 17, stories: 4 };

  for (let k = 0; k <= BLD.stories; k++) {
    makeBox(BLD.L, 0.4, BLD.D, M.concreteDark, 0, 4.25 * k + 0.2, 0, g);
  }

  const rows = 4, bays = 12;
  const bayW = BLD.L / bays, glassH = 3.8;
  for (let r = 0; r < rows; r++) {
    for (let b = 0; b < bays; b++) {
      const bx = -BLD.L / 2 + bayW * (b + 0.5);
      const by = 2.2 + 4.25 * r;
      makeBox(bayW - 0.1, glassH, 0.05, M.glass, bx, by, BLD.D / 2, g, false);
      makeBox(bayW - 0.1, glassH, 0.05, M.glass, bx, by, -BLD.D / 2, g, false);
    }
  }

  for (let b = 0; b <= bays; b++) {
    const px = -BLD.L / 2 + bayW * b;
    makeBox(0.6, BLD.H, 0.6, M.steel, px, BLD.H / 2, BLD.D / 2 + 0.1, g);
    makeBox(0.6, BLD.H, 0.6, M.steel, px, BLD.H / 2, -BLD.D / 2 - 0.1, g);
  }

  makeBox(18, 0.4, 6, M.concrete, 0, 6.4, BLD.D / 2 + 3.2, g);
  makeBox(0.5, 6.4, 0.5, M.steel, -7.5, 3.2, BLD.D / 2 + 5.8, g);
  makeBox(0.5, 6.4, 0.5, M.steel, 7.5, 3.2, BLD.D / 2 + 5.8, g);
  makeBox(14, 0.8, 5, M.concrete, 0, 0.4, BLD.D / 2 + 2.5, g);

  makeBox(8, 3.2, 8, M.concreteDark, 0, BLD.H + 1.6, 0, g);
  makeBox(5, 1.8, 3.5, M.roofGrey, -16, BLD.H + 0.9, -4, g);
  makeBox(4, 1.5, 3.0, M.roofGrey, 16, BLD.H + 0.75, 4, g);

  addCollider(0, -56 - 13, 60, 1.0);
  addCollider(-30, -56, 1.0, 26);
  addCollider(30, -56, 1.0, 26);
  addCollider(-20, -56 + 13, 20, 1.0);
  addCollider(20, -56 + 13, 20, 1.0);

  makeLabel('MAIN HALL & ACADEMIC', 0, 18.5, -56 + 13.5, 0xffffff, 3.0);
}

function buildClassroom1D() {
  const g = new THREE.Group();
  g.position.set(-62, 0.2, -20);
  g.rotation.y = -Math.PI / 2;

  const matFloor = std({ map: tileTexture('#d6c7b2', '#c4b59f', 6), roughness: 0.5 });
  const matWall = std({ color: 0xf0ede6, roughness: 0.9 });
  const matBoard = std({ color: 0x1f4738, roughness: 0.6 });
  const matDesk = std({ color: 0xcca872, roughness: 0.5 });
  const matSteel = std({ color: 0x3a3f45, roughness: 0.4, metalness: 0.8 });

  makeBox(12, 0.1, 9, matFloor, 0, 0, 0, g, false, true);
  makeBox(12, 3.5, 0.15, matWall, 0, 1.75, -4.5, g);
  makeBox(0.15, 3.5, 9, matWall, -6.0, 1.75, 0, g);

  makeBox(6.5, 1.4, 0.05, matBoard, 0, 1.8, -4.42, g);
  makeBox(1.6, 1.0, 0.9, matDesk, 0, 0.5, -3.2, g);

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const dx = -3.6 + col * 1.8;
      const dz = -1.6 + row * 1.3;
      makeBox(0.9, 0.04, 0.55, matDesk, dx, 0.72, dz, g);
      makeBox(0.04, 0.7, 0.04, matSteel, dx - 0.4, 0.35, dz - 0.22, g);
      makeBox(0.04, 0.7, 0.04, matSteel, dx + 0.4, 0.35, dz - 0.22, g);
      makeBox(0.42, 0.03, 0.4, matDesk, dx, 0.45, dz + 0.42, g);
      makeBox(0.42, 0.4, 0.03, matDesk, dx, 0.75, dz + 0.6, g);
    }
  }

  addCollider(-62, -20 - 4.5, 9, 0.5);
  addCollider(-62, -20 + 4.5, 9, 0.5);
  addCollider(-62 - 6.0, -20, 0.5, 12);
  makeLabel('CLASS 1-D', -62 + 6.2, 3.5, -20, 0xffffff, 2.2);

  grpWestWing.add(g);
}

function buildMemorialLibrary() {
  const g = new THREE.Group();
  g.position.set(-62, 0, 22);
  g.rotation.y = -Math.PI / 2;

  const matWood = std({ color: 0x5c3a21, roughness: 0.5 });
  const matFloor = std({ map: tileTexture('#8a6238', '#6b4a2c', 8), roughness: 0.5 });
  const matGlass = phys({ color: 0xf7ead2, transmission: 0.85, roughness: 0.1 });
  const matBanker = std({ color: 0x1b4d3e, emissive: 0x37c46e, emissiveIntensity: 1.5 });

  const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 48), matFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.04;
  g.add(floor);

  const wallGeo = new THREE.CylinderGeometry(14, 14, 7, 36, 1, true, 0, Math.PI * 1.5);
  const wallMesh = new THREE.Mesh(wallGeo, matGlass);
  wallMesh.position.y = 3.5;
  g.add(wallMesh);

  for (let a = 0.2; a < Math.PI * 1.3; a += 0.45) {
    const rx = Math.cos(a) * 9.5, rz = Math.sin(a) * 9.5;
    const shelf = makeBox(4.2, 4.5, 0.8, matWood, rx, 2.25, rz, g);
    shelf.rotation.y = -a + Math.PI / 2;
  }

  const desk = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.0, 1.1, 24, 1, true), matWood);
  desk.position.y = 0.55;
  g.add(desk);

  for (const sx of [-5, 5]) {
    makeBox(3.5, 0.75, 1.2, matWood, sx, 0.38, 2, g);
    makeBox(0.4, 0.2, 0.2, matBanker, sx, 0.85, 2, g);
  }

  addCollider(-62, 22 - 14, 14, 1);
  addCollider(-62, 22 + 14, 14, 1);
  addCollider(-62 - 14, 22, 1, 28);
  makeLabel('MEMORIAL LIBRARY', -62 + 8, 4.5, 22, 0xffffff, 2.2);

  grpWestWing.add(g);
}

function buildCouncilRoom() {
  const g = new THREE.Group();
  g.position.set(26, 0.2, -56);

  const matCarpet = std({ color: 0x2b2d38, roughness: 0.95 });
  const matMahogany = phys({ color: 0x3d1c06, roughness: 0.2, metalness: 0.1, clearcoat: 0.8 });
  const matLeather = std({ color: 0x181818, roughness: 0.3 });
  const matWall = std({ color: 0x383430, roughness: 0.85 });

  makeBox(12, 0.1, 8, matCarpet, 0, 0, 0, g);
  makeBox(12, 3.2, 0.15, matWall, 0, 1.6, -4.0, g);
  makeBox(0.15, 3.2, 8, matWall, 6.0, 1.6, 0, g);

  makeBox(6.0, 0.06, 1.2, matMahogany, 0, 0.75, -1.8, g);
  makeBox(1.2, 0.06, 3.6, matMahogany, -2.4, 0.75, 0.4, g);
  makeBox(1.2, 0.06, 3.6, matMahogany, 2.4, 0.75, 0.4, g);

  for (const cx of [-2.4, -1.2, 0, 1.2, 2.4]) {
    makeBox(0.55, 0.08, 0.55, matLeather, cx, 0.48, -2.6, g);
    makeBox(0.55, 0.75, 0.08, matLeather, cx, 0.88, -2.9, g);
  }

  makeBox(2.2, 2.0, 0.04, std({ color: 0x8b0000 }), 0, 2.0, -3.92, g);
  makeBox(4.5, 2.4, 0.6, std({ color: 0x1f242d }), 5.6, 1.2, 0, g);

  makeLabel('STUDENT COUNCIL', 26 - 6.2, 3.2, -56, 0xffffff, 2.0);
  grpAcademicNorth.add(g);
}

function buildSchoolCafeteria() {
  const g = new THREE.Group();
  g.position.set(62, 0, -20);
  g.rotation.y = Math.PI / 2;

  const matFloor = phys({ color: 0xe5d3b3, roughness: 0.15, clearcoat: 0.6 });
  const matSteel = std({ color: 0xc6c9ce, roughness: 0.25, metalness: 0.9 });
  const matTable = std({ color: 0xd6c49a, roughness: 0.5 });
  const matWall = std({ color: 0xf2efe8, roughness: 0.9 });

  makeBox(30, 0.1, 20, matFloor, 0, 0, 0, g);
  makeBox(30, 5, 0.2, matWall, 0, 2.5, -10, g);
  makeBox(0.2, 5, 20, matWall, 15, 2.5, 0, g);

  makeBox(22, 1.1, 1.8, matSteel, 0, 0.55, -7.5, g);
  makeBox(22, 0.05, 0.6, phys({ color: 0xffffff, transmission: 0.9 }), 0, 1.4, -6.8, g);

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      const tx = -7 + c * 14, tz = -2 + r * 4.5;
      makeBox(8, 0.06, 1.4, matTable, tx, 0.75, tz, g);
      makeBox(8, 0.05, 0.45, matTable, tx, 0.45, tz - 1.1, g);
      makeBox(8, 0.05, 0.45, matTable, tx, 0.45, tz + 1.1, g);
    }
  }

  for (let v = 0; v < 4; v++) {
    const col = [0xd63031, 0x0984e3, 0x00b894, 0x6c5ce7][v];
    makeBox(1.2, 2.1, 0.9, std({ color: col }), -13 + v * 1.8, 1.05, 8.5, g);
  }

  addCollider(62, -20 - 15, 20, 1);
  addCollider(62, -20 + 15, 20, 1);
  addCollider(62 + 10, -20, 1, 30);
  makeLabel('CAFETERIA', 62 - 8, 4.5, -20, 0xffffff, 2.2);

  grpEastWing.add(g);
}

function buildGymnasium() {
  const g = grpEastWing;
  g.position.set(62, 0, 22);
  g.rotation.y = Math.PI / 2;

  const matCourt = phys({ map: tileTexture('#e3c08d', '#d9b37e', 16), roughness: 0.15, clearcoat: 0.6 });
  const matConcrete = std({ color: 0x9a9da0, roughness: 0.9 });
  const matTruss = std({ color: 0x8f979e, metalness: 0.7, roughness: 0.35 });
  const matGlass = phys({ color: 0xdfeaf4, transmission: 0.85, roughness: 0.1 });

  makeBox(25, 0.2, 35, matCourt, 0, 0, 0, g);

  makeBox(25.4, 6.0, 0.4, matConcrete, 0, 3.0, -17.5, g);
  makeBox(25.4, 6.0, 0.4, matConcrete, 0, 3.0, 17.5, g);
  makeBox(0.4, 6.0, 35.4, matConcrete, -12.5, 3.0, 0, g);
  makeBox(0.4, 6.0, 35.4, matConcrete, 12.5, 3.0, 0, g);

  makeBox(25.2, 4.2, 0.1, matGlass, 0, 8.1, -17.5, g);
  makeBox(25.2, 4.2, 0.1, matGlass, 0, 8.1, 17.5, g);
  makeBox(0.1, 4.2, 35.2, matGlass, -12.5, 8.1, 0, g);
  makeBox(0.1, 4.2, 35.2, matGlass, 12.5, 8.1, 0, g);

  for (let z = -14; z <= 14; z += 7) {
    makeBox(25, 0.8, 0.2, matTruss, 0, 10.4, z, g);
  }

  for (const s of [-1, 1]) {
    makeBox(0.2, 4.2, 0.2, matTruss, 0, 2.1, s * 16.2, g);
    makeBox(2.2, 1.4, 0.08, phys({ color: 0xffffff, transmission: 0.9 }), 0, 3.6, s * 14.8, g);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 8, 16), std({ color: 0xe65100 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 3.05, s * 14.2);
    g.add(rim);
  }

  for (let b = 0; b < 4; b++) {
    makeBox(1.2, 0.45 * (b + 1), 28, matConcrete, -10.5 + b * 1.2, 0.225 * (b + 1), 0, g);
  }

  addCollider(62, 22 - 12.5, 35, 1);
  addCollider(62, 22 + 12.5, 35, 1);
  addCollider(62 + 17.5, 22, 1, 25);
  makeLabel('GYMNASIUM', 62 - 12.5, 6.0, 22, 0xffffff, 2.2);
}

function buildAthleticsWest() {
  const g = grpAthleticsWest;
  g.position.set(-62, 0, 60);

  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(36, 24), std({ color: 0x5a9c42, roughness: 0.9 }));
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.set(0, 0.02, 0);
  g.add(pitch);

  const track = new THREE.Mesh(new THREE.RingGeometry(18, 22, 32), std({ color: 0xc45c38, roughness: 0.8 }));
  track.rotation.x = -Math.PI / 2;
  track.position.set(0, 0.015, 0);
  g.add(track);

  for (const gz of [-10, 10]) {
    makeBox(0.2, 3.0, 0.2, std({ color: 0xffffff }), -4, 1.5, gz, g);
    makeBox(0.2, 3.0, 0.2, std({ color: 0xffffff }), 4, 1.5, gz, g);
    makeBox(8.2, 0.2, 0.2, std({ color: 0xffffff }), 0, 3.0, gz, g);
  }
  makeLabel('SPORTS FIELD', -62, 4.5, 60 - 12, 0xffffff, 2.2);

  const aqG = new THREE.Group();
  aqG.position.set(0, 0, 32);

  const matDeck = std({ map: tileTexture('#b7d4ec', '#e9f2fa', 8), roughness: 0.2 });
  makeBox(26, 0.2, 44, matDeck, 0, 0, 0, aqG);

  const poolFloor = new THREE.Mesh(new THREE.PlaneGeometry(20, 38), std({ map: tileTexture('#2882b8', '#1c6fa3', 10), roughness: 0.4 }));
  poolFloor.rotation.x = -Math.PI / 2;
  poolFloor.position.set(0, -2.0, 0);
  aqG.add(poolFloor);

  waterUniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x00a88f) },
    uDeep: { value: new THREE.Color(0x024a3c) }
  };
  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    transparent: true,
    opacity: 0.85,
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      void main() {
        vec3 p = position;
        p.z += sin(p.x * 0.4 + uTime * 1.5) * 0.04 + cos(p.y * 0.3 + uTime * 1.2) * 0.04;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uDeep;
      varying vec3 vWorldPos;
      void main() {
        gl_FragColor = vec4(mix(uDeep, uColor, 0.65), 0.82);
      }
    `
  });
  const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(20, 38), waterMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(0, -0.05, 0);
  aqG.add(waterMesh);

  const towerMat = std({ color: 0xd8dde4, roughness: 0.4 });
  makeBox(2.2, 10.5, 3.2, towerMat, 0, 5.25, -17.5, aqG);
  makeBox(2.6, 0.2, 4.5, towerMat, 0, 10.5, -16, aqG);
  makeBox(2.2, 0.2, 3.8, towerMat, -2.4, 5.0, -16.5, aqG);
  makeBox(2.2, 0.2, 3.5, towerMat, 2.4, 3.0, -16.5, aqG);

  addCollider(-62, 92 - 17.5, 3, 3);
  makeLabel('AQUATIC CENTER', -62, 5.5, 92 - 14, 0xffffff, 2.2);

  g.add(aqG);
}

function buildResidentialSector() {
  const g = grpResidentialSW;
  g.position.set(-34, 0, 58);

  const matConcrete = std({ map: tileTexture('#e2e8f0', '#cbd5e1', 4), roughness: 0.5 });
  const matBalconyGlass = phys({ color: 0x94a3b8, transmission: 0.7, roughness: 0.2 });
  const matDarkGlass = phys({ color: 0x1e293b, transmission: 0.3, roughness: 0.2 });

  const FLOORS = 15, FH = 3.2;
  const TOWER_H = FLOORS * FH;

  makeBox(24, TOWER_H, 24, matConcrete, 0, TOWER_H / 2, 0, g);

  const COLS = [-6.5, 0, 6.5];
  for (let f = 1; f < FLOORS; f++) {
    const y = f * FH;
    for (const cx of COLS) {
      makeBox(4.4, 0.14, 1.5, matConcrete, cx, y, 12.8, g);
      makeBox(4.4, 1.1, 0.05, matBalconyGlass, cx, y + 0.6, 13.5, g);
      makeBox(4.2, 2.2, 0.05, matDarkGlass, cx, y + 1.1, 12.0, g);

      makeBox(4.4, 0.14, 1.5, matConcrete, cx, y, -12.8, g);
      makeBox(4.4, 1.1, 0.05, matBalconyGlass, cx, y + 0.6, -13.5, g);
      makeBox(4.2, 2.2, 0.05, matDarkGlass, cx, y + 1.1, -12.0, g);

      makeBox(1.5, 0.14, 4.4, matConcrete, 12.8, y, cx, g);
      makeBox(0.05, 1.1, 4.4, matBalconyGlass, 13.5, y + 0.6, cx, g);
      makeBox(0.05, 2.2, 4.2, matDarkGlass, 12.0, y + 1.1, cx, g);

      makeBox(1.5, 0.14, 4.4, matConcrete, -12.8, y, cx, g);
      makeBox(0.05, 1.1, 4.4, matBalconyGlass, -13.5, y + 0.6, cx, g);
      makeBox(0.05, 2.2, 4.2, matDarkGlass, -12.0, y + 1.1, cx, g);
    }
  }

  makeBox(28, 4.0, 28, matConcrete, 0, 2.0, 0, g);
  makeBox(14, 3.2, 0.1, phys({ color: 0xffffff, transmission: 0.9 }), 0, 1.6, -14.1, g);

  for (const bx of [-18, 18]) {
    makeBox(8, 2.6, 3.5, std({ color: 0x475569, metalness: 0.7 }), bx, 1.3, -10, g);
  }

  const r401 = new THREE.Group();
  r401.position.set(-16, 0, 0);

  const matTatami = std({ color: 0xb5a67c, roughness: 0.9 });
  const matWood = std({ color: 0x7c5332, roughness: 0.6 });
  const matSheet = std({ color: 0xf8fafc, roughness: 0.85 });

  makeBox(6, 0.08, 6, matTatami, 0, 0.04, 0, r401);
  makeBox(6, 2.8, 0.1, std({ color: 0xf1f5f9 }), 0, 1.4, -3.0, r401);
  makeBox(0.1, 2.8, 6, std({ color: 0xf1f5f9 }), -3.0, 1.4, 0, r401);

  makeBox(1.2, 0.4, 2.2, matWood, 1.8, 0.2, -1.5, r401);
  makeBox(1.15, 0.18, 2.1, matSheet, 1.8, 0.48, -1.5, r401);
  makeBox(1.6, 0.75, 0.8, matWood, -1.8, 0.375, -1.8, r401);
  makeBox(0.4, 0.02, 0.3, std({ color: 0x1e293b, metalness: 0.9 }), -1.8, 0.76, -1.8, r401);

  makeBox(3.2, 0.1, 1.6, std({ color: 0x94a3b8 }), 0, 0.05, 3.8, r401);
  makeBox(3.2, 1.1, 0.05, phys({ color: 0xdbeafe, transmission: 0.85 }), 0, 0.6, 4.6, r401);

  addCollider(-34 - 14, 58, 1, 28);
  addCollider(-34 + 14, 58, 1, 28);
  addCollider(-34, 58 + 14, 28, 1);
  addCollider(-34 - 10, 58 - 14, 8, 1);
  addCollider(-34 + 10, 58 - 14, 8, 1);

  makeLabel('DORMITORY TOWER', -34, 20.0, 58 - 14.5, 0xffffff, 2.8);
  makeLabel('ROOM 401', -50, 3.2, 58, 0xffffff, 1.8);

  g.add(r401);
}

function buildCommercialSector() {
  const g = grpCommercialSE;

  const sivG = new THREE.Group();
  sivG.position.set(34, 0, 54);

  const matFloor = std({ map: tileTexture('#374151', '#1f2937', 8), roughness: 0.3 });
  const matCase = phys({ color: 0xffffff, transmission: 0.85, roughness: 0.1 });
  const matTech = std({ color: 0x111827, metalness: 0.85, roughness: 0.2 });
  const matCCTV = std({ color: 0xffffff, emissive: 0xef4444, emissiveIntensity: 1.8 });
  const matSignSIV = std({ map: textSignTexture('SIVCAMERA', 140, '#38BDF8', '#081B2E'), emissive: 0xffffff, emissiveIntensity: 0.8 });

  makeBox(12, 0.1, 10, matFloor, 0, 0.05, 0, sivG);
  makeBox(12, 4.0, 0.14, std({ color: 0x22262d }), 0, 2.0, 5.0, sivG);

  makeBox(1.2, 1.0, 4.5, matCase, -2.4, 0.5, 0, sivG);
  makeBox(4.5, 2.2, 0.4, matTech, 0, 1.1, 4.7, sivG);
  for (let i = -1.5; i <= 1.5; i += 1.0) {
    const cam = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), matCCTV);
    cam.position.set(i, 1.7, 4.4);
    sivG.add(cam);
  }
  makeBox(7.5, 1.4, 0.1, matSignSIV, 0, 4.2, -5.0, sivG);
  addCollider(34, 54 + 5.0, 12, 1);
  addCollider(34 - 6.0, 54, 1, 10);
  addCollider(34 + 6.0, 54, 1, 10);
  g.add(sivG);

  const cafeG = new THREE.Group();
  cafeG.position.set(54, 0, 54);

  const matWood = std({ color: 0x6e4a2c, roughness: 0.6 });
  const matPink = std({ color: 0xf472b6, roughness: 0.5 });
  const matSignCafe = std({ map: textSignTexture('Palette Cafe', 130, '#F472B6', '#1E1B2E'), emissive: 0xffffff, emissiveIntensity: 0.8 });

  makeBox(12, 0.1, 10, std({ map: tileTexture('#e5e7eb', '#d1d5db', 8), roughness: 0.4 }), 0, 0.05, 0, cafeG);
  makeBox(7.5, 1.1, 1.4, matWood, -1.8, 0.55, 3.2, cafeG);
  makeBox(1.2, 0.8, 0.8, std({ color: 0x222222, metalness: 0.8 }), -1.8, 1.5, 3.2, cafeG);

  for (const cx of [-2.4, 2.4]) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.05, 16), matWood);
    top.position.set(cx, 0.75, -1.0);
    cafeG.add(top);
    makeBox(0.42, 0.45, 0.42, matPink, cx - 0.7, 0.225, -1.0, cafeG);
    makeBox(0.42, 0.45, 0.42, matPink, cx + 0.7, 0.225, -1.0, cafeG);
  }
  makeBox(7.2, 1.5, 0.1, matSignCafe, 0, 4.2, -5.0, cafeG);
  addCollider(54, 54 + 5.0, 12, 1);
  addCollider(54 - 6.0, 54, 1, 10);
  addCollider(54 + 6.0, 54, 1, 10);
  g.add(cafeG);

  const mallG = new THREE.Group();
  mallG.position.set(44, 0, 78);

  const M = {
    concreteDark: std({ color: 0x3a3f47, roughness: 0.5 }),
    chrome: std({ color: 0xd0d5dd, roughness: 0.2, metalness: 0.9 }),
    glass: phys({ color: 0x9ec0db, transmission: 0.9, roughness: 0.1, ior: 1.5 }),
    signGold: std({ map: textSignTexture('KEYAKI MALL', 120), emissive: 0xffffff, emissiveIntensity: 0.8 })
  };

  const BLD = { L: 52, D: 28, H: 18, tiers: 3 };

  for (let k = 0; k <= BLD.tiers; k++) {
    makeBox(BLD.L, 0.5, BLD.D, M.concreteDark, 0, 6.0 * k + 0.25, 0, mallG);
  }

  const bays = 8, bayW = BLD.L / bays;
  for (let t = 0; t < BLD.tiers; t++) {
    for (let b = 0; b < bays; b++) {
      const bx = -BLD.L / 2 + bayW * (b + 0.5);
      makeBox(bayW - 0.15, 5.5, 0.05, M.glass, bx, 3.2 + 6.0 * t, -BLD.D / 2, mallG, false);
      makeBox(bayW - 0.15, 5.5, 0.05, M.glass, bx, 3.2 + 6.0 * t, BLD.D / 2, mallG, false);
    }
  }

  const pyrGeo = new THREE.ConeGeometry(14 * Math.SQRT2, 9, 4, 1, true);
  const pyrMesh = new THREE.Mesh(pyrGeo, M.glass);
  pyrMesh.position.y = BLD.H + 4.5;
  pyrMesh.rotation.y = Math.PI / 4;
  mallG.add(pyrMesh);

  makeBox(18, 0.35, 5, M.concreteDark, 0, 5.4, -BLD.D / 2 - 2.5, mallG);
  makeBox(12, 2.2, 0.2, M.signGold, 0, 5.0, -BLD.D / 2 - 2.7, mallG);

  const karaG = new THREE.Group();
  karaG.position.set(12, 0.1, 4);
  makeBox(5.5, 0.5, 1.2, std({ color: 0x7c2d12 }), 0, 0.25, 2.0, karaG);
  makeBox(3.0, 0.4, 1.2, phys({ color: 0x050508, transmission: 0.6 }), 0, 0.2, 0.2, karaG);
  makeBox(3.8, 2.0, 0.08, std({ color: 0x000000, emissive: 0x38bdf8, emissiveIntensity: 0.8 }), 0, 1.6, -3.2, karaG);
  mallG.add(karaG);

  addCollider(44, 78 + 14, 52, 1);
  addCollider(44 - 26, 78, 1, 28);
  addCollider(44 + 26, 78, 1, 28);
  addCollider(44 - 18, 78 - 14, 16, 1);
  addCollider(44 + 18, 78 - 14, 16, 1);

  g.add(mallG);
}

function buildMainEntrance() {
  const g = new THREE.Group();
  g.position.set(0, 0, 95);

  const matStone = std({ color: 0x94a3b8, roughness: 0.6 });

  makeBox(2.0, 6.0, 2.0, matStone, -14, 3.0, 0, g);
  makeBox(2.0, 6.0, 2.0, matStone, 14, 3.0, 0, g);
  makeBox(30, 1.0, 1.0, matStone, 0, 6.2, 0, g);
  makeBox(4.2, 1.8, 0.3, std({ map: textSignTexture('ANHS HIGH SCHOOL', 90, '#FFFFFF', '#0F172A') }), 0, 7.5, 0, g);

  addCollider(-14, 95, 2.2, 2.2);
  addCollider(14, 95, 2.2, 2.2);

  const busG = new THREE.Group();
  busG.position.set(-10, 0, 6);
  makeBox(9, 3.2, 2.6, std({ color: 0xded4c0 }), 0, 1.6, 0, busG);
  makeBox(8, 1.2, 2.5, std({ color: 0x2b3242 }), 0, 2.3, 0.05, busG);
  makeBox(9.05, 0.6, 2.65, std({ color: 0x2b4a8a }), 0, 0.5, 0, busG);
  addCollider(-10, 101, 9.2, 2.8);
  g.add(busG);

  makeLabel('FRONT GATE', 0, 7.8, 95, 0xffffff, 2.8);
  makeLabel('🚌 BUS', -10, 3.8, 101, 0xffffff, 2.0);

  grpGround.add(g);
}

function buildSeasideBoulevard() {
  const g = grpSeasideNorth;
  g.position.set(0, 0, -145);

  const matBrick = std({ map: brickTexture(), roughness: 0.6 });
  const matRock = std({ map: noiseTexture('#475569', ['#334155', '#1e293b'], 1000, 10), roughness: 0.95 });
  const matIron = std({ color: 0x0f172a, roughness: 0.3, metalness: 0.85 });

  const boardwalk = new THREE.Mesh(new THREE.PlaneGeometry(280, 8), matBrick);
  boardwalk.rotation.x = -Math.PI / 2;
  boardwalk.position.set(0, 0.04, 0);
  boardwalk.receiveShadow = true;
  g.add(boardwalk);

  makeBox(280, 3.5, 4, matRock, 0, -1.75, -5.5, g);
  addCollider(0, -145 - 4.5, 280, 2.0);

  for (let x = -138; x <= 138; x += 3) {
    makeBox(0.08, 1.1, 0.08, matIron, x, 0.55, -3.8, g);
  }
  makeBox(280, 0.06, 0.06, matIron, 0, 1.1, -3.8, g);

  for (let x = -120; x <= 120; x += 30) {
    makeBox(0.2, 4.5, 0.2, matIron, x, 2.25, 2.5, g);
    makeBox(0.6, 0.12, 0.3, std({ color: 0xffffff, emissive: 0xfff3d4, emissiveIntensity: 1.5 }), x, 4.5, 2.5, g);
    makeBox(2.2, 0.45, 0.7, std({ color: 0x4a3a28 }), x + 6, 0.225, 1.8, g);
  }

  oceanUniforms = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(0x003f5c) },
    uShallow: { value: new THREE.Color(0x2f899e) }
  };
  const oceanMat = new THREE.ShaderMaterial({
    uniforms: oceanUniforms,
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      void main() {
        vec3 p = position;
        p.z += sin(p.x * 0.06 + uTime * 0.8) * 0.4 + cos(p.y * 0.05 + uTime * 0.6) * 0.3;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      varying vec3 vWorldPos;
      void main() {
        gl_FragColor = vec4(mix(uDeep, uShallow, 0.6), 0.95);
      }
    `
  });
  const oceanMesh = new THREE.Mesh(new THREE.PlaneGeometry(360, 100), oceanMat);
  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.position.set(0, -3.2, -50);
  g.add(oceanMesh);

  makeLabel('SEASIDE PROMENADE', 0, 3.5, -143, 0xffffff, 2.5);
}

// Assemble campus architecture
buildCampusFoundation();
buildCentralPark();
buildAcademicBuilding();
buildClassroom1D();
buildMemorialLibrary();
buildCouncilRoom();
buildSchoolCafeteria();
buildGymnasium();
buildAthleticsWest();
buildResidentialSector();
buildCommercialSector();
buildMainEntrance();
buildSeasideBoulevard();

// =========================================================================
// CHARACTER RIGGING & PROCEDURAL JOINT POSE ENGINE
// =========================================================================
const capCache = new Map(), cylCache = new Map(), sphCache = new Map();
function geoCap(r, l) { const k = `${r},${l}`; if (!capCache.has(k)) capCache.set(k, new THREE.CapsuleGeometry(r, l, 4, 10)); return capCache.get(k); }
function geoCyl(rt, rb, h) { const k = `${rt},${rb},${h}`; if (!cylCache.has(k)) cylCache.set(k, new THREE.CylinderGeometry(rt, rb, h, 14)); return cylCache.get(k); }
function geoSph(r) { const k = `${r}`; if (!sphCache.has(k)) sphCache.set(k, new THREE.SphereGeometry(r, 18, 14)); return sphCache.get(k); }

function addPart(parent, geo, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(geo, std({ color, roughness: 0.6 }));
  m.position.set(x, y, z); m.castShadow = !opts.noShadow;
  if (opts.scale) m.scale.set(...opts.scale);
  if (opts.rot) m.rotation.set(...opts.rot);
  parent.add(m);
  return m;
}
function segment(parent, jx, jy, jz, r, len, color) {
  const pivot = new THREE.Group(); pivot.position.set(jx, jy, jz); parent.add(pivot);
  addPart(pivot, geoCap(r, len), color, 0, -len / 2, 0);
  return pivot;
}

function buildFace(head, cfg) {
  const skin = cfg.skin ?? 0xf1c9a5;
  const eyes = [];
  for (const ex of [-0.058, 0.058]) {
    const g = new THREE.Group(); g.position.set(ex, 0.012, 0.098); head.add(g);
    addPart(g, geoSph(0.032), 0xfbfbfd, 0, 0, 0, { noShadow: true, scale: [1, 1.12, 0.5] });
    addPart(g, geoSph(0.019), cfg.eyes ?? 0x3b2f2a, 0, 0, 0.016, { noShadow: true, scale: [1, 1.1, 0.6] });
    addPart(g, geoSph(0.009), 0x120f14, 0, 0, 0.026, { noShadow: true });
    addPart(g, geoSph(0.006), 0xffffff, 0.011, 0.014, 0.03, { noShadow: true });
    eyes.push(g);
    addPart(head, new THREE.BoxGeometry(0.052, 0.011, 0.014), cfg.hair, ex, 0.062, 0.104, { noShadow: true, rot: [0, 0, ex > 0 ? -0.14 : 0.14] });
  }
  addPart(head, geoCap(0.016, 0.03), skin, 0, -0.028, 0.113, { noShadow: true, rot: [0.3, 0, 0] });
  const mouth = addPart(head, new THREE.BoxGeometry(0.05, 0.014, 0.012), 0xb4685f, 0, -0.088, 0.108, { noShadow: true });
  for (const ex of [-0.125, 0.125]) addPart(head, geoSph(0.028), skin, ex, -0.02, 0.01, { noShadow: true, scale: [0.6, 1, 0.8] });
  return { eyes, mouth };
}

function buildHair(head, cfg) {
  const c = cfg.hair, S = cfg.hairStyle;
  addPart(head, geoSph(0.132), c, 0, 0.012, -0.008, { scale: [1.06, 1.0, 1.06] });
  addPart(head, new THREE.BoxGeometry(0.23, 0.055, 0.075), c, 0, 0.088, 0.085, { rot: [0.16, 0, 0] });
  if (S === 'long') {
    addPart(head, new THREE.BoxGeometry(0.235, 0.44, 0.1), c, 0, -0.19, -0.085);
    for (const ex of [-0.115, 0.115]) addPart(head, new THREE.BoxGeometry(0.06, 0.3, 0.075), c, ex, -0.11, 0.045);
  } else if (S === 'medium') {
    for (const ex of [-0.125, 0.125]) addPart(head, new THREE.BoxGeometry(0.062, 0.22, 0.16), c, ex, -0.055, 0.02);
    addPart(head, new THREE.BoxGeometry(0.225, 0.16, 0.1), c, 0, -0.075, -0.08);
    for (const ex of [-0.15, 0.15]) addPart(head, geoSph(0.05), c, ex, -0.16, -0.02, { scale: [0.8, 1.3, 0.8] });
  } else if (S === 'spiky') {
    for (const [sx, sz, sy] of [[-0.07, -0.06, 0.16], [0.07, -0.06, 0.16], [0, 0.02, 0.185], [-0.1, 0.05, 0.14], [0.1, 0.05, 0.14]])
      addPart(head, new THREE.ConeGeometry(0.045, 0.12, 6), c, sx, sy, sz, { rot: [sz * 1.4, 0, -sx * 2.2] });
  } else if (S === 'slick') {
    addPart(head, new THREE.BoxGeometry(0.245, 0.07, 0.18), c, 0, 0.108, -0.012, { rot: [-0.2, 0, 0] });
    addPart(head, new THREE.BoxGeometry(0.1, 0.05, 0.11), c, 0.075, 0.1, 0.075, { rot: [0.2, 0, 0.4] });
  }
}

function makeRig(cfg) {
  const skin = cfg.skin ?? 0xf1c9a5, blazer = cfg.blazer ?? 0x28304a;
  const female = cfg.gender === 'f';
  const lower = cfg.lower ?? (female ? 0x2f3550 : 0x2b2f3a);
  const scale = cfg.height ?? 1;

  const root = new THREE.Group();
  const body = new THREE.Group(); body.scale.setScalar(scale); root.add(body);

  const hips = new THREE.Group(); hips.position.y = 0.92; body.add(hips);
  addPart(hips, geoCyl(0.145, 0.125, 0.16), lower, 0, -0.05, 0, { scale: [1, 1, 0.72] });
  const torso = new THREE.Group(); hips.add(torso);
  addPart(torso, geoCyl(0.175, 0.142, 0.5), blazer, 0, 0.25, 0, { scale: [1, 1, 0.66] });
  addPart(torso, new THREE.BoxGeometry(0.15, 0.32, 0.12), 0xf7f5ef, 0, 0.33, 0.093, { noShadow: true });
  addPart(torso, new THREE.BoxGeometry(0.052, 0.2, 0.02), cfg.tie ?? 0x9b2d2d, 0, 0.3, 0.152, { noShadow: true });
  addPart(torso, new THREE.BoxGeometry(0.2, 0.05, 0.07), 0xf7f5ef, 0, 0.455, 0.088, { noShadow: true, rot: [0.25, 0, 0] });
  for (const sx of [-0.055, 0.055]) addPart(torso, new THREE.BoxGeometry(0.075, 0.3, 0.03), blazer, sx, 0.31, 0.115, { noShadow: true, rot: [0, 0, sx > 0 ? 0.07 : -0.07] });
  addPart(torso, geoCyl(0.115, 0.13, 0.1), blazer, 0, 0.5, 0, { noShadow: true, scale: [1, 1, 0.7] });

  addPart(torso, geoCyl(0.045, 0.05, 0.075), skin, 0, 0.545, 0, { noShadow: true });
  const head = new THREE.Group(); head.position.y = 0.7; torso.add(head);
  addPart(head, geoSph(0.118), skin, 0, 0, 0, { scale: [0.93, 1.16, 1.0] });
  addPart(head, new THREE.BoxGeometry(0.1, 0.06, 0.05), skin, 0, -0.1, 0.062, { noShadow: true, scale: [1, 1, 1] });
  const face = buildFace(head, cfg);
  buildHair(head, cfg);

  const arms = {};
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'R' : 'L';
    const sh = segment(torso, side * 0.185, 0.475, 0, 0.052, 0.27, blazer);
    const el = segment(sh, 0, -0.27, 0, 0.045, 0.25, cfg.sleeve ?? blazer);
    addPart(el, geoSph(0.048), skin, 0, -0.27, 0, { noShadow: true, scale: [1, 0.85, 0.8] });
    arms['arm' + key] = sh; arms['elbow' + key] = el;
  }

  const legs = {};
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'R' : 'L';
    const hip = segment(hips, side * 0.082, -0.06, 0, 0.078, 0.4, female ? skin : lower);
    const knee = segment(hip, 0, -0.4, 0, 0.062, 0.38, female ? skin : lower);
    if (female) addPart(knee, geoCap(0.066, 0.16), 0x2b2f3a, 0, -0.3, 0, { noShadow: true });
    const foot = addPart(knee, new THREE.BoxGeometry(0.088, 0.055, 0.19), 0x24262c, 0, -0.4, 0.038, { noShadow: true });
    legs['leg' + key] = hip; legs['knee' + key] = knee; legs['foot' + key] = foot;
  }
  if (female) addPart(hips, geoCyl(0.15, 0.245, 0.24), lower, 0, -0.16, 0, { scale: [1, 1, 0.8] });

  return { root, body, hips, torso, head, face, ...arms, ...legs, height: 1.74 * scale };
}

// Procedural Activity Animation Engine
function animateRig(rig, a, dt) {
  a.blinkT = (a.blinkT ?? 2) - dt;
  if (a.blinkT < 0) a.blinkT = 2.4 + Math.random() * 3.5;
  const blink = a.blinkT < 0.13 ? Math.max(0.08, Math.abs(a.blinkT - 0.065) / 0.065) : 1;
  for (const e of rig.face.eyes) e.scale.y = blink;

  const damp = Math.min(1, dt * 9);
  const lerpTo = (obj, axis, target) => { obj.rotation[axis] += (target - obj.rotation[axis]) * damp; };

  const mode = a.mode || 'idle';

  if (a.moving) {
    // Locomotion
    const p = a.phase, s = Math.sin(p), c = Math.cos(p);
    const stride = a.run ? 1.25 : 1;
    rig.hips.position.y = 0.92 + Math.abs(Math.sin(p * 2)) * 0.026;
    rig.legL.rotation.x = s * 0.5 * stride;
    rig.legR.rotation.x = -s * 0.5 * stride;
    rig.kneeL.rotation.x = Math.max(0, -Math.sin(p + 0.7)) * 0.95 * stride;
    rig.kneeR.rotation.x = Math.max(0, -Math.sin(p + 0.7 + Math.PI)) * 0.95 * stride;
    rig.footL.rotation.x = -s * 0.18; rig.footR.rotation.x = s * 0.18;
    rig.armL.rotation.x = -s * 0.42 * stride; rig.armR.rotation.x = s * 0.42 * stride;
    rig.armL.rotation.z = 0.06; rig.armR.rotation.z = -0.06;
    rig.elbowL.rotation.x = -0.3 - Math.max(0, -s) * 0.4;
    rig.elbowR.rotation.x = -0.3 - Math.max(0, s) * 0.4;
    rig.hips.rotation.y = s * 0.09;
    rig.torso.rotation.y = -s * 0.07;
    rig.torso.rotation.z = c * 0.02;
    rig.body.rotation.z = s * 0.015;
  } else if (mode === 'sit_desk') {
    // Seated Desk Pose (Classroom study / note writing)
    rig.hips.position.y += (0.48 - rig.hips.position.y) * damp;
    lerpTo(rig.legL, 'x', -1.57); lerpTo(rig.legR, 'x', -1.57);
    lerpTo(rig.kneeL, 'x', 1.57); lerpTo(rig.kneeR, 'x', 1.57);
    lerpTo(rig.footL, 'x', 0); lerpTo(rig.footR, 'x', 0);
    lerpTo(rig.torso, 'x', 0.08); lerpTo(rig.torso, 'y', 0);
    lerpTo(rig.armL, 'x', -0.55); lerpTo(rig.armL, 'z', 0.22);
    lerpTo(rig.elbowL, 'x', -0.9);
    const write = Math.sin(a.idleT * 6.0) * 0.05;
    lerpTo(rig.armR, 'x', -0.55 + write); lerpTo(rig.armR, 'z', -0.22);
    lerpTo(rig.elbowR, 'x', -0.9 + write);
    rig.face.mouth.scale.y += (1 - rig.face.mouth.scale.y) * damp;
  } else if (mode === 'teach_lecture') {
    // Teacher podium lecturing pose
    rig.hips.position.y += (0.92 - rig.hips.position.y) * damp;
    for (const j of ['legL', 'legR', 'kneeL', 'kneeR', 'footL', 'footR']) lerpTo(rig[j], 'x', 0);
    lerpTo(rig.armL, 'x', -0.5); lerpTo(rig.elbowL, 'x', -0.7);
    const swing = Math.sin(a.idleT * 1.8) * 0.35;
    lerpTo(rig.armR, 'x', -0.4 + swing); lerpTo(rig.armR, 'z', -0.3);
    lerpTo(rig.elbowR, 'x', -0.8 + swing * 0.5);
    rig.face.mouth.scale.y = 1 + Math.abs(Math.sin(a.idleT * 3)) * 1.4;
  } else if (mode === 'sit_eat') {
    // Seated Dining / Eating Pose
    rig.hips.position.y += (0.48 - rig.hips.position.y) * damp;
    lerpTo(rig.legL, 'x', -1.57); lerpTo(rig.legR, 'x', -1.57);
    lerpTo(rig.kneeL, 'x', 1.57); lerpTo(rig.kneeR, 'x', 1.57);
    lerpTo(rig.armL, 'x', -0.4); lerpTo(rig.elbowL, 'x', -0.8);
    const eatCycle = Math.sin(a.idleT * 2.2);
    lerpTo(rig.armR, 'x', -0.7 + eatCycle * 0.3);
    lerpTo(rig.elbowR, 'x', -1.2 + eatCycle * 0.4);
    rig.face.mouth.scale.y = 1 + Math.abs(Math.sin(a.idleT * 4.5)) * 1.5;
  } else if (mode === 'sit_read') {
    // Library Book Reading Pose
    rig.hips.position.y += (0.48 - rig.hips.position.y) * damp;
    lerpTo(rig.legL, 'x', -1.57); lerpTo(rig.legR, 'x', -1.57);
    lerpTo(rig.kneeL, 'x', 1.57); lerpTo(rig.kneeR, 'x', 1.57);
    lerpTo(rig.torso, 'x', 0.12);
    lerpTo(rig.armL, 'x', -0.45); lerpTo(rig.armR, 'x', -0.45);
    lerpTo(rig.elbowL, 'x', -1.0); lerpTo(rig.elbowR, 'x', -1.0);
    lerpTo(rig.head, 'x', 0.35); // Look down at book
  } else if (mode === 'sport_drill') {
    // Athletic Court / Field Practice
    rig.hips.position.y += (0.85 - rig.hips.position.y) * damp;
    lerpTo(rig.legL, 'x', -0.2); lerpTo(rig.legR, 'x', 0.2);
    lerpTo(rig.kneeL, 'x', 0.4); lerpTo(rig.kneeR, 'x', 0.4);
    const dribble = Math.sin(a.idleT * 8.0) * 0.35;
    lerpTo(rig.armR, 'x', -0.3 + dribble); lerpTo(rig.elbowR, 'x', -0.7 + dribble);
    lerpTo(rig.armL, 'x', -0.2); lerpTo(rig.elbowL, 'x', -0.4);
  } else {
    // Default Idle
    for (const j of ['legL', 'legR', 'kneeL', 'kneeR', 'armL', 'armR', 'footL', 'footR']) lerpTo(rig[j], 'x', 0);
    lerpTo(rig.elbowL, 'x', -0.16); lerpTo(rig.elbowR, 'x', -0.16);
    lerpTo(rig.torso, 'x', 0); lerpTo(rig.torso, 'y', 0); lerpTo(rig.hips, 'y', 0);
    const breathe = Math.sin(a.idleT * 1.5) * 0.008;
    rig.hips.position.y += (0.92 + breathe - rig.hips.position.y) * damp;
    const shift = Math.sin(a.idleT * 0.42);
    rig.hips.rotation.z += (shift * 0.035 - rig.hips.rotation.z) * damp;
    rig.torso.rotation.z += (-shift * 0.025 - rig.torso.rotation.z) * damp;
    rig.armL.rotation.z += (0.08 + shift * 0.02 - rig.armL.rotation.z) * damp;
    rig.armR.rotation.z += (-0.08 + shift * 0.02 - rig.armR.rotation.z) * damp;

    if (a.talk) {
      const g = Math.sin(a.idleT * 3.1);
      rig.armR.rotation.x += (-0.45 - g * 0.22 - rig.armR.rotation.x) * damp;
      rig.elbowR.rotation.x += (-0.85 + g * 0.25 - rig.elbowR.rotation.x) * damp;
      rig.face.mouth.scale.y = 1 + Math.abs(Math.sin(a.idleT * 9)) * 2.2;
    } else rig.face.mouth.scale.y += (1 - rig.face.mouth.scale.y) * damp;
  }

  if (mode !== 'sit_read') {
    const wantY = a.lookAt ?? Math.sin(a.idleT * 0.5) * 0.22;
    const wantX = a.lookPitch ?? 0;
    rig.head.rotation.y += (Math.max(-1.1, Math.min(1.1, wantY)) - rig.head.rotation.y) * Math.min(1, dt * 5);
    rig.head.rotation.x += (Math.max(-0.5, Math.min(0.5, wantX)) - rig.head.rotation.x) * Math.min(1, dt * 5);
  }
}

// ---------- Speech Bubbles ----------
function makeBubble() {
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, opacity: 0 }));
  spr.visible = false; scene.add(spr); return spr;
}
function setBubbleText(spr, text) {
  const c = document.createElement('canvas'), pad = 22;
  const ctx = c.getContext('2d'); ctx.font = 'bold 30px Segoe UI, sans-serif';
  const words = text.split(' '); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > 420 && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  const lh = 38, wMax = Math.max(...lines.map(l => ctx.measureText(l).width));
  c.width = Math.ceil(wMax + pad * 2); c.height = lines.length * lh + pad * 2 + 14;
  const x = c.getContext('2d'); x.font = 'bold 30px Segoe UI, sans-serif';
  x.fillStyle = 'rgba(252,252,255,0.96)'; x.strokeStyle = 'rgba(30,34,44,0.9)'; x.lineWidth = 3;
  roundRect(x, 2, 2, c.width - 4, c.height - 18, 18); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(c.width / 2 - 12, c.height - 18); x.lineTo(c.width / 2, c.height - 3); x.lineTo(c.width / 2 + 12, c.height - 18);
  x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#1a1d26'; x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach((l, i) => x.fillText(l, c.width / 2, pad + lh * i + lh / 2));
  if (spr.material.map) spr.material.map.dispose();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  spr.material.map = tex; spr.material.needsUpdate = true;
  spr.scale.set(c.width / 190, c.height / 190, 1);
}
function say(npc, text, ms = 3600) {
  if (!npc.bubble) npc.bubble = makeBubble();
  setBubbleText(npc.bubble, text);
  npc.bubble.visible = true; npc.bubble.material.opacity = 1;
  npc.bubbleUntil = clock.elapsedTime + ms / 1000;
  if (playerDist(npc) < 18) speakAs(npc.name, text, 1, npc);
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// =========================================================================
// PURPOSE-DRIVEN NPC ROSTER & PERSONALITY SYSTEM
// =========================================================================
const npcs = [];
let social = load('cote3dSocial', {});
function soc(name) {
  if (!social[name]) social[name] = { affinity: 0, talks: 0, mood: 'neutral', greeted: 0 };
  return social[name];
}
function saveSocial() { save('cote3dSocial', social); }
const MOODS = ['content', 'neutral', 'neutral', 'tired', 'irritated', 'cheerful'];

function createStudentNPC(id, name, persona, traits, assignedSeat, cfg) {
  const rig = makeRig(cfg);
  const startLoc = LOC[cfg.spawnLoc || 'gate'].c;
  const s = findFreeSpot(startLoc[0] + (Math.random() - 0.5) * 4, startLoc[1] + (Math.random() - 0.5) * 4, 0.5);
  rig.root.position.set(s.x, 0, s.z);
  rig.root.rotation.y = Math.PI;
  scene.add(rig.root);

  const label = makeLabel(name, s.x, 2.05, s.z, 0xffffff, 1.4);

  const npc = {
    id, name, persona, traits,
    role: cfg.role || 'student',
    assignedSeat,
    preferredActivities: cfg.preferredActivities || ['LIBRARY', 'CAFETERIA'],
    cfg, rig, label,
    currentSpot: cfg.spawnLoc || 'gate',
    targetSpotId: null,
    targetSpot: null,
    // State machine
    state: 'SPAWN',
    currentActivity: 'ARRIVING_AT_SCHOOL',
    activityReason: 'Arriving on the morning school bus.',
    path: [],
    pathI: 0,
    speed: cfg.speed ?? 2.4,
    facing: Math.PI,
    anim: { moving: false, phase: 0, talk: false, idleT: Math.random() * 6, blinkT: Math.random() * 4, lookAt: null, run: false, mode: 'idle' },
    _stuckTime: 0, _skips: 0,
    wantsTalk: false, waitUntil: 0, bubble: null, bubbleUntil: 0, chatWith: null,
    lines: cfg.lines || {
      greet: ['...Ayanokouji-kun.', 'Hello.'],
      idle: ['Class 1-D...', 'The campus is huge.'],
      rain: ['It is raining.']
    }
  };

  npcs.push(npc);
  return npc;
}

// 1. Named Class 1-D Main Cast
createStudentNPC('horikita', 'Horikita',
  'Horikita Suzune — reserved, direct, serious, determined to reach Class A. Quietly observant, dry warmth.',
  { intelligence: 0.98, discipline: 0.95, athleticism: 0.60, social: 0.15, curiosity: 0.85 },
  'CLASS_1D_SEAT_13', // Center desk beside Ayanokouji (Seat 14)
  {
    hair: 0x15151f, hairStyle: 'long', gender: 'f', skin: 0xf3d0b3, tie: 0x8a2b3a, height: 0.97,
    spawnLoc: 'gate', speed: 2.4, preferredActivities: ['LIBRARY', 'STUDY', 'COURTYARD'],
    lines: {
      greet: ['...Ayanokouji-kun.', 'Did you need something?', 'You are here too.'],
      idle: ['This reading is poorly reasoned...', 'Class D can still reach Class A.', 'A quiet corner is preferable.'],
      rain: ['I didn\'t bring an umbrella. We should head inside.']
    }
  }
);

createStudentNPC('kushida', 'Kushida',
  'Kushida Kikyou — relentlessly cheerful, wants to befriend all students, popular.',
  { intelligence: 0.65, discipline: 0.60, athleticism: 0.55, social: 0.99, curiosity: 0.80 },
  'CLASS_1D_SEAT_08',
  {
    hair: 0x22305a, hairStyle: 'medium', gender: 'f', skin: 0xf7d9bd, tie: 0x8a2b3a, height: 0.95,
    spawnLoc: 'gate', speed: 2.5, preferredActivities: ['PALETTE_CAFE', 'KEYAKI_MALL', 'CAFETERIA', 'COURTYARD'],
    lines: {
      greet: ['Ayanokouji-kun! Good morning!', 'Hey hey! Over here!'],
      idle: ['Everyone in Class D is so unique!', 'Let\'s all get along!'],
      rain: ['Eek, rain! Let\'s go to Palette Café!']
    }
  }
);

createStudentNPC('sudou', 'Sudou',
  'Sudou Ken — red-haired basketball recruit, athletic, hot-tempered.',
  { intelligence: 0.35, discipline: 0.30, athleticism: 0.98, social: 0.60, curiosity: 0.40 },
  'CLASS_1D_SEAT_03',
  {
    hair: 0x9b2618, hairStyle: 'spiky', gender: 'm', skin: 0xecc39c, tie: 0x2b4a8a, height: 1.06,
    spawnLoc: 'gate', speed: 2.9, preferredActivities: ['GYMNASIUM', 'SPORTS_FIELD', 'AQUATIC_CENTER', 'CAFETERIA'],
    lines: {
      greet: ['Yo, Ayanokouji.', 'Sup.'],
      idle: ['I need to hit the gym today.', 'Basketball practice starts after class.'],
      rain: ['Can\'t practice outside in the rain. Heading to the indoor gym.']
    }
  }
);

createStudentNPC('kouenji', 'Kouenji',
  'Kouenji Rokusuke — wealthy heir, narcissistic, lounging.',
  { intelligence: 0.88, discipline: 0.15, athleticism: 0.92, social: 0.10, curiosity: 0.50 },
  'CLASS_1D_SEAT_25', // Window back corner
  {
    hair: 0xd9b44a, hairStyle: 'slick', gender: 'm', skin: 0xf1c9a5, tie: 0x2b4a8a, height: 1.05,
    spawnLoc: 'gate', speed: 2.2, preferredActivities: ['PALETTE_CAFE', 'COURTYARD', 'SIV_STORE', 'DORMITORY', 'SEASIDE'],
    lines: {
      greet: ['Ah — an ordinary student greets perfection.', 'Hmph.'],
      idle: ['Beauty is an immense responsibility.', 'School rules are for the mundane.'],
      rain: ['My hair deserves better weather than this.']
    }
  }
);

createStudentNPC('chabashira', 'Chabashira',
  'Chabashira Sae — Class 1-D homeroom teacher. Strict, sharp.',
  { intelligence: 0.95, discipline: 0.99, athleticism: 0.70, social: 0.40, curiosity: 0.70 },
  'CLASS_1D_TEACHER',
  {
    role: 'teacher', hair: 0x2a2a33, hairStyle: 'long', gender: 'f', skin: 0xeccdb0, blazer: 0x3a3f4a, tie: 0x555b66, height: 1.0,
    spawnLoc: 'hall', speed: 2.3, preferredActivities: ['COUNCIL_ROOM', 'MAIN_HALL', 'CLASS_1D'],
    lines: {
      greet: ['Ayanokouji. Do not be late.', 'Class is starting.'],
      idle: ['Points reflect your worth in this school.', 'Pay attention to the handbook.'],
      rain: ['Get inside. Tardiness will be penalized.']
    }
  }
);

// 2. Additional Class 1-D Classmate Cohort
const COHORT = [
  { id: 'hirata', name: 'Hirata', traits: { intelligence: 0.82, discipline: 0.90, athleticism: 0.85, social: 0.92 }, seat: 'CLASS_1D_SEAT_11', act: ['CAFETERIA', 'COURTYARD', 'SPORTS_FIELD'], hair: 0x6b4f3b, hairStyle: 'medium', gender: 'm' },
  { id: 'karuizawa', name: 'Karuizawa', traits: { intelligence: 0.55, discipline: 0.50, athleticism: 0.40, social: 0.95 }, seat: 'CLASS_1D_SEAT_17', act: ['KEYAKI_MALL', 'PALETTE_CAFE'], hair: 0xe0a96d, hairStyle: 'long', gender: 'f' },
  { id: 'yukimura', name: 'Yukimura', traits: { intelligence: 0.94, discipline: 0.92, athleticism: 0.30, social: 0.40 }, seat: 'CLASS_1D_SEAT_06', act: ['LIBRARY', 'STUDY'], hair: 0x1f2937, hairStyle: 'medium', gender: 'm' },
  { id: 'sakura', name: 'Sakura', traits: { intelligence: 0.70, discipline: 0.80, athleticism: 0.30, social: 0.20 }, seat: 'CLASS_1D_SEAT_22', act: ['SIV_STORE', 'COURTYARD'], hair: 0xf472b6, hairStyle: 'long', gender: 'f' },
  { id: 'ike', name: 'Ike', traits: { intelligence: 0.40, discipline: 0.35, athleticism: 0.65, social: 0.80 }, seat: 'CLASS_1D_SEAT_02', act: ['CAFETERIA', 'KEYAKI_MALL'], hair: 0x854d0e, hairStyle: 'spiky', gender: 'm' },
  { id: 'yamauchi', name: 'Yamauchi', traits: { intelligence: 0.38, discipline: 0.30, athleticism: 0.60, social: 0.78 }, seat: 'CLASS_1D_SEAT_04', act: ['CAFETERIA', 'COURTYARD'], hair: 0x475569, hairStyle: 'spiky', gender: 'm' }
];

COHORT.forEach(c => {
  createStudentNPC(c.id, c.name, `${c.name} — Class 1-D Student.`, c.traits, c.seat, {
    hair: c.hair, hairStyle: c.hairStyle, gender: c.gender, skin: 0xf1c9a5, height: 0.98,
    spawnLoc: 'gate', speed: 2.4, preferredActivities: c.act
  });
});

const playerAvatar = makeRig({ hair: 0x2a2622, hairStyle: 'medium', gender: 'm', skin: 0xf0c9a0, blazer: 0x28304a, tie: 0x2b4a8a });
playerAvatar.root.visible = false; scene.add(playerAvatar.root);
const playerAnim = { moving: false, phase: 0, talk: false, idleT: 0, mode: 'idle' };

// =========================================================================
// NPC PURPOSE DECISION & STATE MACHINE ENGINE
// =========================================================================
function choosePersonalityActivity(npc) {
  const t = npc.traits;
  const isRain = wCur.rain > 0.35;

  if (t.intelligence > 0.85 && !isRain && Math.random() < 0.7) return 'library';
  if (t.intelligence > 0.85 && isRain) return 'library';
  if (t.athleticism > 0.85 && isRain) return 'gym';
  if (t.athleticism > 0.85 && !isRain) return Math.random() < 0.6 ? 'gym' : 'field';
  if (t.social > 0.85) return pick(['cafe', 'mall', 'cafeteria', 'courtyard']);
  if (t.discipline < 0.3) return pick(['cafe', 'dorm', 'courtyard', 'seaside']);
  return pick(npc.preferredActivities.map(a => a.toLowerCase()).filter(a => LOC[a])) || 'library';
}

function evaluateNPCPurpose(npc, evt) {
  if (npc.role === 'teacher') {
    if (evt.activity === 'CLASS' || evt.activity === 'AFTERNOON_CLASS') {
      npc.targetSpotId = 'CLASS_1D_TEACHER';
      npc.currentActivity = 'TEACHING_CLASS';
      npc.activityReason = 'Delivering homeroom lecture in Class 1-D.';
      return { loc: 'class1d', spotId: 'CLASS_1D_TEACHER', state: 'GOING_TO_CLASS' };
    }
    if (evt.activity === 'LUNCH' || evt.activity === 'BREAK') {
      return { loc: 'council', spotId: null, state: 'GOING_TO_NEXT_ACTIVITY' };
    }
    return { loc: 'hall', spotId: null, state: 'IDLE_AT_DESTINATION' };
  }

  // Student Decisions
  switch (evt.activity) {
    case 'ARRIVING_AT_SCHOOL':
    case 'CLASS':
    case 'AFTERNOON_CLASS': {
      const targetSpot = npc.assignedSeat || ReservationManager.findAvailableSpot('class1d', 'desk_seat')?.id;
      ReservationManager.reserve(targetSpot, npc.id);
      npc.targetSpotId = targetSpot;
      npc.currentActivity = 'ATTENDING_CLASS';
      npc.activityReason = 'Attending scheduled academic lecture in Class 1-D.';
      return { loc: 'class1d', spotId: targetSpot, state: 'GOING_TO_CLASS' };
    }

    case 'BREAK': {
      npc.currentActivity = 'CLASSROOM_BREAK';
      npc.activityReason = 'Stretching and chatting with neighboring classmates during 15-minute break.';
      return { loc: 'class1d', spotId: npc.targetSpotId, state: 'IN_CLASS' };
    }

    case 'LUNCH': {
      // Find a cafeteria table seat
      ReservationManager.releaseAllForNPC(npc.id);
      const cafSpot = ReservationManager.findAvailableSpot('cafeteria', 'dining_seat');
      if (cafSpot) {
        ReservationManager.reserve(cafSpot.id, npc.id);
        npc.targetSpotId = cafSpot.id;
      }
      npc.currentActivity = 'LUNCH_DINING';
      npc.activityReason = 'Eating lunch and socializing in the school cafeteria.';
      return { loc: 'cafeteria', spotId: npc.targetSpotId, state: 'GOING_TO_LUNCH' };
    }

    case 'PERSONAL_ACTIVITY': {
      ReservationManager.releaseAllForNPC(npc.id);
      const chosenLoc = choosePersonalityActivity(npc);
      let spotId = null;
      if (chosenLoc === 'library') spotId = ReservationManager.findAvailableSpot('library', 'library_seat')?.id;
      else if (chosenLoc === 'gym') spotId = ReservationManager.findAvailableSpot('gym')?.id;
      else if (chosenLoc === 'cafe') spotId = ReservationManager.findAvailableSpot('cafe')?.id;

      if (spotId) ReservationManager.reserve(spotId, npc.id);
      npc.targetSpotId = spotId;
      npc.currentActivity = `AFTER_SCHOOL_${chosenLoc.toUpperCase()}`;
      npc.activityReason = `Pursuing personality interest at the ${LOC[chosenLoc].label}.`;
      const nextState = chosenLoc === 'library' ? 'GOING_TO_LIBRARY' : chosenLoc === 'gym' || chosenLoc === 'field' ? 'GOING_TO_SPORTS' : 'GOING_TO_SOCIAL';
      return { loc: chosenLoc, spotId, state: nextState };
    }

    case 'EVENING_LEISURE': {
      ReservationManager.releaseAllForNPC(npc.id);
      const eveLoc = pick(['mall', 'cafe', 'store', 'seaside', 'dorm']);
      npc.targetSpotId = null;
      npc.currentActivity = 'EVENING_FREE_TIME';
      npc.activityReason = `Spending free evening time at ${LOC[eveLoc].label}.`;
      return { loc: eveLoc, spotId: null, state: 'GOING_TO_NEXT_ACTIVITY' };
    }

    case 'DORM_TIME':
    case 'NIGHT_REST': {
      ReservationManager.releaseAllForNPC(npc.id);
      npc.targetSpotId = 'DORM_ROOM_401';
      npc.currentActivity = 'DORMITORY_REST';
      npc.activityReason = 'In residential dormitory for evening study and rest.';
      return { loc: 'dorm', spotId: null, state: 'GOING_TO_DORM' };
    }

    default:
      return { loc: 'courtyard', spotId: null, state: 'IDLE_AT_DESTINATION' };
  }
}

// Route Calculation
function routeNPCToSpot(npc, destLoc, spotId) {
  const p = npc.rig.root.position;
  const fromNode = LOC[npc.currentSpot]?.node || nearestNode(p.x, p.z);
  const toNode = LOC[destLoc]?.node || 'hub';
  const keys = navPath(fromNode, toNode);
  const path = keys.map(k => ({ x: NAV_NODES[k][0], z: NAV_NODES[k][1] }));

  let finalTarget = { x: LOC[destLoc].c[0], z: LOC[destLoc].c[1] };
  if (spotId && SPOTS[spotId]) {
    const s = SPOTS[spotId];
    finalTarget = { x: s.x, z: s.z, facing: s.facing };
    npc.targetSpot = s;
  } else {
    const f = findFreeSpot(finalTarget.x + (Math.random() - 0.5) * 3, finalTarget.y + (Math.random() - 0.5) * 3, 0.5);
    finalTarget = { x: f.x, z: f.z, facing: Math.PI };
    npc.targetSpot = null;
  }

  path.push(finalTarget);
  npc.path = path;
  npc.pathI = 0;
  npc._stuckTime = 0;
  npc._skips = 0;
}

// Steering and Obstacle/Crowd Avoidance
function planar(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }

function computeAvoidance(npc, vx, vz) {
  let ax = 0, az = 0;
  const p = npc.rig.root.position;

  // Separate from other NPCs
  for (const o of npcs) {
    if (o === npc) continue;
    const op = o.rig.root.position;
    const d = planar(p.x, p.z, op.x, op.z);
    if (d > 0.01 && d < 1.3) {
      const f = (1.3 - d) / 1.3;
      ax += ((p.x - op.x) / d) * f * 1.5;
      az += ((p.z - op.z) / d) * f * 1.5;
    }
  }

  // Separate from player
  const pd = planar(p.x, p.z, camera.position.x, camera.position.z);
  if (pd > 0.01 && pd < 1.6) {
    const pf = (1.6 - pd) / 1.6;
    ax += ((p.x - camera.position.x) / pd) * pf * 2.0;
    az += ((p.z - camera.position.z) / pd) * pf * 2.0;
  }

  return { x: vx + ax, z: vz + az };
}

function stepNPCToTarget(npc, tx, tz, dt, isFinal = false) {
  const p = npc.rig.root.position;
  let dx = tx - p.x, dz = tz - p.z;
  const dist = Math.hypot(dx, dz);

  // Arrival threshold
  const arrivalDist = isFinal ? 0.35 : 0.65;
  if (dist < arrivalDist) {
    npc.anim.moving = false;
    npc._stuckTime = 0;
    return true;
  }

  dx /= dist; dz /= dist;
  const steer = computeAvoidance(npc, dx, dz);
  const sLen = Math.hypot(steer.x, steer.z) || 1;
  const vx = (steer.x / sLen);
  const vz = (steer.z / sLen);

  const speed = isFinal && dist < 1.5 ? npc.speed * 0.6 : npc.speed;
  const step = speed * dt;
  const sx = p.x, sz = p.z;

  const nx = p.x + vx * step, nz = p.z + vz * step;
  if (!collidesAt(nx, nz, 0.45)) {
    p.x = nx; p.z = nz;
  } else if (!collidesAt(p.x + dx * step, p.z, 0.45)) {
    p.x += dx * step;
  } else if (!collidesAt(p.x, p.z + dz * step, 0.45)) {
    p.z += dz * step;
  }

  const moved = Math.hypot(p.x - sx, p.z - sz) > step * 0.15;
  if (moved) {
    npc._stuckTime = 0;
    npc.facing = Math.atan2(vx, vz);
  } else {
    npc._stuckTime = (npc._stuckTime || 0) + dt;
    if (npc._stuckTime > 3.5) {
      // Advance waypoint to prevent being trapped
      npc._stuckTime = 0;
      return true;
    }
  }

  npc.anim.moving = moved;
  if (moved) npc.anim.phase += dt * speed * 2.5;
  return false;
}

// Update Individual NPC Lifecycle & Animation State
function updateNPCBehavior(npc, dt, elapsed) {
  const p = npc.rig.root.position;
  npc.label.position.set(p.x, 2.05, p.z);
  if (npc.bubble) npc.bubble.position.set(p.x, 2.45, p.z);
  npc.anim.idleT += dt;
  npc.anim.talk = npc.speaking === true || activeNPC === npc;

  // Look-at behavior
  const dPlayer = planar(p.x, p.z, camera.position.x, camera.position.z);
  if (dPlayer < 9 && !npc.targetSpot) {
    const world = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
    let rel = world - npc.rig.root.rotation.y;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    npc.anim.lookAt = Math.max(-1.1, Math.min(1.1, rel));
  } else {
    npc.anim.lookAt = null;
  }

  // Active dialogue takes priority
  if (activeNPC === npc) {
    npc.anim.moving = false;
    npc.anim.mode = 'idle';
    const dx = camera.position.x - p.x, dz = camera.position.z - p.z;
    npc.facing = Math.atan2(dx, dz);
  } else if (npc.path && npc.path.length > 0 && npc.pathI < npc.path.length) {
    // Traveling to Destination Waypoints
    const isLast = npc.pathI === npc.path.length - 1;
    const wp = npc.path[npc.pathI];
    npc.anim.mode = 'idle';

    if (stepNPCToTarget(npc, wp.x, wp.z, dt, isLast)) {
      npc.pathI++;
      if (npc.pathI >= npc.path.length) {
        // Arrived at destination!
        npc.anim.moving = false;
        npc.path = [];
        npc.currentSpot = npc._destLoc || npc.currentSpot;
        if (wp.facing !== undefined) npc.facing = wp.facing;

        // Transition to arrived activity state
        if (npc.state === 'GOING_TO_CLASS') {
          npc.state = npc.role === 'teacher' ? 'TEACHING_CLASS' : 'IN_CLASS';
        } else if (npc.state === 'GOING_TO_LUNCH') {
          npc.state = 'EATING';
        } else if (npc.state === 'GOING_TO_LIBRARY') {
          npc.state = 'STUDYING';
        } else if (npc.state === 'GOING_TO_SPORTS') {
          npc.state = 'PLAYING_SPORT';
        } else {
          npc.state = 'IDLE_AT_DESTINATION';
        }
      }
    }
  } else {
    // Performing Current Activity
    npc.anim.moving = false;
    if (npc.state === 'IN_CLASS') npc.anim.mode = 'sit_desk';
    else if (npc.state === 'TEACHING_CLASS') npc.anim.mode = 'teach_lecture';
    else if (npc.state === 'EATING') npc.anim.mode = 'sit_eat';
    else if (npc.state === 'STUDYING') npc.anim.mode = 'sit_read';
    else if (npc.state === 'PLAYING_SPORT') npc.anim.mode = 'sport_drill';
    else npc.anim.mode = 'idle';

    if (npc.targetSpot && npc.targetSpot.facing !== undefined) {
      npc.facing = npc.targetSpot.facing;
    }
  }

  npc.rig.root.rotation.y += (npc.facing - npc.rig.root.rotation.y) * Math.min(1, dt * 9);
  animateRig(npc.rig, npc.anim, dt);
}

// Master Schedule Tick Manager
let currentScheduleEvent = null;

function updateSchoolScheduleSystem() {
  const evt = getCurrentScheduleEvent(clockMin);
  if (!currentScheduleEvent || currentScheduleEvent.id !== evt.id) {
    currentScheduleEvent = evt;
    showToast(`🔔 ${hhmm()} — ${evt.label}`);

    for (const npc of npcs) {
      const decision = evaluateNPCPurpose(npc, evt);
      npc._destLoc = decision.loc;
      npc.state = decision.state;
      routeNPCToSpot(npc, decision.loc, decision.spotId);
    }
    updateDebugRoster();
  }
}

// ---------- Dynamic Weather Engine ----------
const WEATHERS = {
  clear:    { icon: '☀️', name: 'Clear',    top: 0x4f93d1, bot: 0xe9f3fb, fog: 0xd6e8f8, near: 140, far: 520, sun: 2.5,  hemi: 1.00, rain: 0, cloud: 0.12, wet: 0.00 },
  cloudy:   { icon: '⛅', name: 'Cloudy',   top: 0x7fa3c4, bot: 0xe4ecf2, fog: 0xd6e0e8, near: 120, far: 440, sun: 1.6,  hemi: 0.95, rain: 0, cloud: 0.55, wet: 0.05 },
  overcast: { icon: '☁️', name: 'Overcast', top: 0x8d9aa6, bot: 0xd3d9dd, fog: 0xc9d1d6, near: 90,  far: 360, sun: 0.9,  hemi: 0.85, rain: 0, cloud: 0.9,  wet: 0.12 },
  rain:     { icon: '🌧️', name: 'Rain',     top: 0x6b7784, bot: 0xb9c2c8, fog: 0xa9b4bb, near: 60,  far: 260, sun: 0.5,  hemi: 0.72, rain: 1, cloud: 1.0,  wet: 0.34 },
  storm:    { icon: '⛈️', name: 'Storm',    top: 0x4d5661, bot: 0x929ba3, fog: 0x8b959c, near: 40,  far: 190, sun: 0.3,  hemi: 0.6,  rain: 1.7, cloud: 1.0, wet: 0.45 },
  sunset:   { icon: '🌇', name: 'Sunset',   top: 0x3f6ea8, bot: 0xf6c69a, fog: 0xe8b98f, near: 110, far: 420, sun: 1.8,  hemi: 0.9,  rain: 0, cloud: 0.35, wet: 0.02 },
};
const W_ORDER = ['clear', 'cloudy', 'overcast', 'rain', 'storm', 'sunset'];
const wCur = { ...WEATHERS.clear, top: new THREE.Color(0x4f93d1), bot: new THREE.Color(0xe9f3fb), fog: new THREE.Color(0xd6e8f8) };
let wTargetKey = 'clear', wTarget = WEATHERS.clear, wNextChange = 50 + Math.random() * 50, flash = 0;

const weatherChip = document.createElement('div');
weatherChip.style.cssText = 'background:rgba(13,16,24,.88);border:1px solid var(--border);border-radius:10px;padding:8px 14px;font-size:13px;backdrop-filter:blur(10px);pointer-events:auto;cursor:pointer;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.5);';
weatherChip.title = 'Click (or press V) to change the weather';
$('topright').appendChild(weatherChip);

const RAIN_N = 3500;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(RAIN_N * 6);
for (let i = 0; i < RAIN_N; i++) {
  const x = (Math.random() - 0.5) * 110, y = Math.random() * 55, z = (Math.random() - 0.5) * 110;
  rainPos.set([x, y, z, x + 0.06, y - 0.85, z], i * 6);
}
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainMat = new THREE.LineBasicMaterial({ color: 0xc3daf0, transparent: true, opacity: 0 });
const rain = new THREE.LineSegments(rainGeo, rainMat);
rain.frustumCulled = false; rain.visible = false; scene.add(rain);

const clouds = new THREE.Group(); scene.add(clouds);
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
for (let i = 0; i < 34; i++) {
  const puff = new THREE.Mesh(new THREE.SphereGeometry(12 + Math.random() * 16, 8, 6), cloudMat);
  puff.position.set((Math.random() - 0.5) * 620, 78 + Math.random() * 34, (Math.random() - 0.5) * 620);
  puff.scale.y = 0.42; clouds.add(puff);
}

function setWeather(key, announce = true) {
  wTargetKey = key; wTarget = WEATHERS[key];
  weatherChip.textContent = `${wTarget.icon} ${wTarget.name}`;
  if (announce) showToast(`Weather: ${wTarget.icon} ${wTarget.name}`, 3000);
}
function cycleWeather() { setWeather(W_ORDER[(W_ORDER.indexOf(wTargetKey) + 1) % W_ORDER.length]); }
weatherChip.onclick = cycleWeather;
setWeather('clear', false);

const _tTop = new THREE.Color(), _tBot = new THREE.Color(), _tFog = new THREE.Color();

function updateWeather(dt, elapsed) {
  if (elapsed > wNextChange) {
    wNextChange = elapsed + 60 + Math.random() * 70;
    const choices = { clear: ['cloudy', 'sunset'], cloudy: ['clear', 'overcast'], overcast: ['rain', 'cloudy'], rain: ['storm', 'overcast'], storm: ['rain', 'overcast'], sunset: ['clear', 'cloudy'] }[wTargetKey];
    setWeather(choices[Math.floor(Math.random() * choices.length)]);
  }
  const k = Math.min(1, dt * 0.35);
  wCur.top.lerp(_tTop.setHex(wTarget.top), k);
  wCur.bot.lerp(_tBot.setHex(wTarget.bot), k);
  wCur.fog.lerp(_tFog.setHex(wTarget.fog), k);
  for (const p of ['near', 'far', 'sun', 'hemi', 'rain', 'cloud', 'wet']) wCur[p] += (wTarget[p] - wCur[p]) * k;

  skyMat.uniforms.topC.value.copy(wCur.top);
  skyMat.uniforms.botC.value.copy(wCur.bot);
  scene.fog.color.copy(wCur.fog); scene.fog.near = wCur.near; scene.fog.far = wCur.far;

  if (wTargetKey === 'storm' && Math.random() < dt * 0.35) flash = 1;
  flash = Math.max(0, flash - dt * 3.5);
  sun.intensity = wCur.sun + flash * 1.8;
  hemi.intensity = wCur.hemi + flash * 1.2;

  cloudMat.opacity = wCur.cloud * 0.85;
  clouds.position.x = ((elapsed * 1.6) % 620) - 310;

  rainMat.opacity = Math.min(0.75, wCur.rain * 0.55);
  rain.visible = rainMat.opacity > 0.02;
  if (rain.visible) {
    rain.position.set(camera.position.x, 0, camera.position.z);
    const fall = (36 + wCur.rain * 22) * dt, arr = rainGeo.attributes.position.array;
    for (let i = 0; i < RAIN_N; i++) {
      const o = i * 6;
      arr[o + 1] -= fall; arr[o + 4] -= fall;
      if (arr[o + 4] < 0) { const y = 48 + Math.random() * 10; arr[o + 1] = y; arr[o + 4] = y - 0.85; }
    }
    rainGeo.attributes.position.needsUpdate = true;
  }
}

// ---------- Controls & Input ----------
const keys = {};
let yaw = 0, pitch = -0.05, locked = false, dragging = false;
const LOOK = 0.0025;

addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyE' && nearNPC && dialogue.style.display !== 'flex' && storyEl.style.display !== 'flex') openDialogue(nearNPC);
  if (e.code === 'KeyV' && document.activeElement !== dlgInput) cycleWeather();
  if (e.code === 'KeyM' && document.activeElement !== dlgInput) toggleTTS();
  if (e.code === 'F3') { toggleDebugHUD(); e.preventDefault(); }
});
addEventListener('keyup', e => keys[e.code] = false);

const cv = renderer.domElement; cv.style.cursor = 'grab';
cv.addEventListener('mousedown', e => {
  if (camMode !== 'free' || e.button !== 0) return;
  dragging = true; cv.style.cursor = 'grabbing';
  if (!locked && cv.requestPointerLock) { try { cv.requestPointerLock(); } catch {} }
});
addEventListener('mouseup', () => { dragging = false; if (!locked) cv.style.cursor = 'grab'; });
cv.addEventListener('mouseleave', () => dragging = false);
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === cv; cv.style.cursor = locked ? 'none' : 'grab'; });
document.addEventListener('pointerlockerror', () => locked = false);

function applyLook(dx, dy) { yaw -= dx * LOOK; pitch = Math.max(-1.2, Math.min(1.2, pitch - dy * LOOK)); }
document.addEventListener('mousemove', e => { if (camMode === 'free' && (locked || dragging)) applyLook(e.movementX || 0, e.movementY || 0); });

// ---------- Player Movement & Collision ----------
const R = 0.55;
function playerBlocked(x, z) {
  if (collidesAt(x, z, R)) return true;
  for (const n of npcs) { if (n === activeNPC) continue; if (planar(x, z, n.rig.root.position.x, n.rig.root.position.z) < 0.8) return true; }
  return false;
}
function tryMove(nx, nz) {
  if (!playerBlocked(nx, camera.position.z)) camera.position.x = nx;
  if (!playerBlocked(camera.position.x, nz)) camera.position.z = nz;
}

// ---------- Camera & Dialogue Framing ----------
const camTargetPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const camLookTarget = new THREE.Vector3();
let savedYaw = 0, savedPitch = 0;
const savedPos = new THREE.Vector3();

function beginTalkCam(npc) {
  savedYaw = yaw; savedPitch = pitch; savedPos.copy(camera.position);
  playerAvatar.root.position.set(camera.position.x, 0, camera.position.z);
  const np = npc.rig.root.position;
  playerAvatar.root.rotation.y = Math.atan2(np.x - camera.position.x, np.z - camera.position.z);
  playerAvatar.root.visible = true;
  camMode = 'talk';
  crosshair.classList.add('hide');
  if (document.pointerLockElement) document.exitPointerLock();
  updateTalkFraming(npc);
  camLook.copy(camLookTarget);
}
function updateTalkFraming(npc) {
  const a = playerAvatar.root.position, b = npc.rig.root.position;
  const mid = new THREE.Vector3((a.x + b.x) / 2, 1.6, (a.z + b.z) / 2);
  const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  camTargetPos.copy(mid).add(side.multiplyScalar(4.2)).add(new THREE.Vector3(0, 1.1, 0)).addScaledVector(dir, -0.5);
  camLookTarget.set(b.x, 1.7, b.z);
}
function endTalkCam() { camMode = 'return'; }

// ---------- Proximity & Scene Readout ----------
let nearNPC = null;
function updateProximity() {
  let closest = null, best = 3.6;
  for (const n of npcs) { const d = planar(camera.position.x, camera.position.z, n.rig.root.position.x, n.rig.root.position.z); if (d < best) { best = d; closest = n; } }
  nearNPC = closest;
  const busy = dialogue.style.display === 'flex' || storyEl.style.display === 'flex' || camMode !== 'free';
  if (nearNPC && !busy) { promptEl.style.display = 'block'; promptEl.innerHTML = `Press <b>E</b> to talk to <b>${nearNPC.name}</b> (${nearNPC.currentActivity})`; }
  else promptEl.style.display = 'none';
}
function updateSceneLabel() {
  let label = 'Campus Grounds', best = 24;
  for (const key of Object.keys(LOC)) {
    const [x, z] = LOC[key].c;
    const d = planar(camera.position.x, camera.position.z, x, z);
    if (d < best) { best = d; label = LOC[key].label; }
  }
  sceneLabel.textContent = '📍 ' + label;
}

// ---------- Simulation Clock & Render Loop ----------
const DAY_REAL_MIN = 20;
const MIN_PER_SEC = 1440 / (DAY_REAL_MIN * 60);
let clockMin = 7.75 * 60; // 07:45 Morning Arrival
let gameDay = load('cote3dDay', 1);
const clockChip = document.createElement('div');
clockChip.style.cssText = 'background:rgba(13,16,24,.88);border:1px solid var(--border);border-radius:10px;padding:8px 14px;font-size:13px;backdrop-filter:blur(10px);font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.5);';
$('topright').appendChild(clockChip);
function hhmm() { const h = Math.floor(clockMin / 60) % 24, m = Math.floor(clockMin % 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (waterUniforms) waterUniforms.uTime.value = elapsed;
  if (oceanUniforms) oceanUniforms.uTime.value = elapsed;

  if (camMode === 'free') {
    const speed = (keys['ShiftLeft'] || keys['ShiftRight'] ? 10 : 5.5) * dt;
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    let mx = 0, mz = 0;
    if (keys['KeyW'] || keys['ArrowUp']) { mx += fwd.x; mz += fwd.z; }
    if (keys['KeyS'] || keys['ArrowDown']) { mx -= fwd.x; mz -= fwd.z; }
    if (keys['KeyD'] || keys['ArrowRight']) { mx += right.x; mz += right.z; }
    if (keys['KeyA'] || keys['ArrowLeft']) { mx -= right.x; mz -= right.z; }
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; tryMove(camera.position.x + mx * speed, camera.position.z + mz * speed); }
    camera.position.y = EYE;
    const dir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(camera.position.clone().add(dir));
  } else if (camMode === 'talk') {
    if (activeNPC) updateTalkFraming(activeNPC);
    camera.position.lerp(camTargetPos, Math.min(1, dt * 4));
    camLook.lerp(camLookTarget, Math.min(1, dt * 4));
    camera.lookAt(camLook);
    playerAnim.idleT += dt; playerAnim.talk = true; animateRig(playerAvatar, playerAnim, dt);
  } else if (camMode === 'return') {
    const dest = savedPos;
    camera.position.lerp(dest, Math.min(1, dt * 5));
    if (camera.position.distanceTo(dest) < 0.15) { camera.position.copy(dest); yaw = savedYaw; pitch = savedPitch; camMode = 'free'; playerAvatar.root.visible = false; crosshair.classList.remove('hide'); }
    else { const dir = new THREE.Vector3(-Math.sin(savedYaw) * Math.cos(savedPitch), Math.sin(savedPitch), -Math.cos(savedYaw) * Math.cos(savedPitch)); camLook.lerp(camera.position.clone().add(dir), Math.min(1, dt * 5)); camera.lookAt(camLook); }
  }

  // School Routine & NPC Update
  const prevMin = clockMin;
  clockMin = (clockMin + dt * MIN_PER_SEC) % (24 * 60);
  if (clockMin < prevMin) { gameDay++; save('cote3dDay', gameDay); }
  updateSchoolScheduleSystem();

  for (const n of npcs) updateNPCBehavior(n, dt, elapsed);
  updateWeather(dt, elapsed);

  const evt = getCurrentScheduleEvent(clockMin);
  clockChip.textContent = `🕗 ${hhmm()} · Day ${gameDay} · ${evt.label}`;

  updateProximity();
  updateSceneLabel();
  if (story.active) checkSceneArrival();
  renderer.render(scene, camera);
}

// ---------- Debug Diagnostics HUD (F3) ----------
function toggleDebugHUD() {
  if (debugPanel.classList.contains('active')) debugPanel.classList.remove('active');
  else { debugPanel.classList.add('active'); updateDebugRoster(); }
}
if ($('dbg-close')) $('dbg-close').onclick = () => debugPanel.classList.remove('active');

window.skipToTime = function(h) {
  clockMin = h * 60;
  currentScheduleEvent = null;
  updateSchoolScheduleSystem();
  showToast(`⏩ Time skipped to ${hhmm()}`, 3000);
};

function updateDebugRoster() {
  if (!dbgRosterList) return;
  dbgRosterList.innerHTML = '';
  for (const n of npcs) {
    const row = document.createElement('div');
    row.className = 'dbg-npc-row';
    row.innerHTML = `
      <div><span class="dbg-npc-name">${n.name}</span> (${n.role})</div>
      <div class="dbg-npc-state">State: <b>${n.state}</b> · Act: ${n.currentActivity}</div>
      <div class="dbg-npc-dest">Dest: ${LOC[n.currentSpot]?.label || n.currentSpot}${n.targetSpotId ? ` [${n.targetSpotId}]` : ''}</div>
    `;
    dbgRosterList.appendChild(row);
  }
}

// ---------- Stats HUD ----------
function renderStats() {
  statsEl.innerHTML = '';
  for (const k of Object.keys(BASE_STATS)) {
    const row = document.createElement('div'); row.className = 'stat-row';
    row.innerHTML = `<span class="lbl">${STAT_ICONS[k]} ${k}</span><span class="bar"><span class="fill" style="width:${stats[k]}%;background:${STAT_COLORS[k]}"></span></span><span class="val">${stats[k]}</span>`;
    statsEl.appendChild(row);
  }
}
function applyStats(changes) {
  for (const [k, v] of Object.entries(changes || {})) if (k in stats && typeof v === 'number') stats[k] = Math.max(0, Math.min(100, stats[k] + v));
  save('cote3dStats', stats); renderStats();
}
renderStats();

// ---------- Dialogue & LLM Conversation ----------
function npcSystemPrompt(npc) {
  return `You are role-playing a single character in the world of "Classroom of the Elite" (Volume 1). The player is Ayanokouji Kiyotaka. Stay 100% in character.

CHARACTER: ${npc.name} (${npc.role})
${npc.persona}

CURRENT ACTIVITY: Right now it is ${hhmm()} (${currentScheduleEvent?.label || 'School'}), you are at the ${LOC[npc.currentSpot]?.label || 'campus'} doing: ${npc.activityReason}.

RULES:
- Reply SHORT and natural, like real spoken dialogue (1-4 sentences).
- Reference your current activity or location naturally.
- Small stat changes (-3..+3).

Respond ONLY with valid JSON:
{ "text": "...", "statChanges": {"trust":0,"love":0,"respect":0,"wisdom":0,"courage":0}, "choices": ["...","..."] }`;
}

function openDialogue(npc) {
  activeNPC = npc; convo = (memory[npc.name] || []).slice();
  const s = soc(npc.name);
  s.talks++; saveSocial();
  dlgName.textContent = `${npc.name}  ·  ${LOC[npc.currentSpot]?.label || ''}  ·  ${npc.currentActivity}`;
  dlgLog.innerHTML = ''; dlgChoices.innerHTML = '';
  for (const m of convo) {
    if (m.role === 'user' && m._hidden) continue;
    if (m.role === 'user') addLine('me', 'You', m.parts[0].text);
    else { try { const p = JSON.parse(m.parts[0].text); addLine('npc', npc.name, p.text); } catch {} }
  }
  dialogue.style.display = 'flex';
  beginTalkCam(npc);
  if (!canTalk) { addLine('sys', '', 'Talking needs an API key — reload and start with a key.'); return; }
  if (convo.length === 0) sendToNPC('[Ayanokouji walks up to you. Greet or react in character based on what you are doing.]', true);
  else { addLine('sys', '', `— you approach ${npc.name} —`); sendToNPC('[Ayanokouji approaches you again.]', true); }
}

function addLine(kind, who, text, chips) {
  const el = document.createElement('div'); el.className = `line ${kind}`;
  el.innerHTML = kind === 'sys' ? `<div>${escapeHtml(text)}</div>` : `<div class="who">${who}</div><div>${escapeHtml(text)}</div>`;
  if (chips) el.insertAdjacentHTML('beforeend', chips);
  dlgLog.appendChild(el); dlgLog.scrollTop = dlgLog.scrollHeight;
}
function renderChoices(list) {
  dlgChoices.innerHTML = '';
  (list || []).forEach(txt => { const b = document.createElement('button'); b.className = 'choice'; b.textContent = txt; b.onclick = () => submit(txt); dlgChoices.appendChild(b); });
}

async function sendToNPC(playerText, opening = false) {
  if (!opening) addLine('me', 'You', playerText);
  const userMsg = { role: 'user', parts: [{ text: playerText }] }; if (opening) userMsg._hidden = true;
  convo.push(userMsg);
  renderChoices([]); dlgThinking.style.display = 'block'; dlgInput.disabled = true;
  const npc = activeNPC;
  try {
    const contents = toChatMessages(convo.slice(-MAX_MEMORY_TURNS));
    const res = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: npcSystemPrompt(npc) }, ...contents], temperature: 0.85, response_format: { type: 'json_object' } })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    const raw = data.choices[0].message.content;
    convo.push({ role: 'model', parts: [{ text: raw }] });
    memory[npc.name] = convo; save('cote3dConvos', memory);
    const parsed = JSON.parse(raw);
    const chips = Object.entries(parsed.statChanges || {}).filter(([k, v]) => k in stats && v !== 0).map(([k, v]) => `<span class="chip ${v > 0 ? 'up' : 'down'}">${STAT_ICONS[k]} ${v > 0 ? '+' : ''}${v}</span>`).join('');
    addLine('npc', npc.name, parsed.text || '…', chips ? `<div class="chips">${chips}</div>` : '');
    speakAs(npc.name, parsed.text, 2, npc);
    applyStats(parsed.statChanges);
    renderChoices(parsed.choices);
  } catch (err) { console.error(err); addLine('sys', '', `⚠️ ${err.message || 'Could not reach the AI.'}`); }
  finally { dlgThinking.style.display = 'none'; dlgInput.disabled = false; dlgInput.focus(); }
}

function submit(text) { const t = (text ?? dlgInput.value).trim(); if (!t || !canTalk) return; dlgInput.value = ''; sendToNPC(t); }
function closeDialogue() { dialogue.style.display = 'none'; stopSpeech(); activeNPC = null; endTalkCam(); }
$('dlg-send').onclick = () => submit();
dlgInput.addEventListener('keypress', e => { if (e.key === 'Enter') submit(); });
$('dlg-close').onclick = closeDialogue;
addEventListener('keydown', e => { if (e.code === 'Escape' && dialogue.style.display === 'flex') closeDialogue(); });
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

// ---------- Guided Chapter 1 Story Mode ----------
const SCENES = [
  { id: 'gate', title: 'Arrival', loc: 'gate', objective: 'Walk to the Front Gate where the school bus arrives.', prompt: 'Scene 1 — first morning at ANHS front gate.' },
  { id: 'hall', title: 'Entrance Ceremony', loc: 'hall', objective: 'Enter the Main Hall for the entrance ceremony.', prompt: 'Scene 2 — ceremony in Main Hall.' },
  { id: 'homeroom', title: 'Homeroom & Points', loc: 'class1d', objective: 'Go to Class 1-D for homeroom with Chabashira-sensei.', prompt: 'Scene 3 — homeroom in Class 1-D with S-System 100,000 points reveal.' },
  { id: 'intro', title: 'Introductions', loc: 'class1d', objective: 'Stay in Class 1-D as classmates introduce themselves.', prompt: 'Scene 4 — self-introductions in Class 1-D.' },
  { id: 'after', title: 'After School', loc: 'courtyard', objective: 'Head to the courtyard after class.', prompt: 'Scene 5 — courtyard after school.' },
  { id: 'weeks', title: 'First Weeks', loc: 'cafeteria', objective: 'Explore freely — lunches, gym, shops.', prompt: 'Scene 6 — students spending lavishly.' },
  { id: 'may1', title: 'May 1st', loc: 'class1d', objective: 'Return to Class 1-D on May 1st for the monthly points.', prompt: 'Scene 7 — May 1st zero points twist.' },
];

function currentScene() { return SCENES[story.i]; }
function updateObjective() {
  const sc = currentScene();
  if (story.active && sc) { objectiveEl.style.display = 'block'; $('ov-title').textContent = `Ch.1 · ${sc.title}`; ovText.textContent = sc.objective; }
  else objectiveEl.style.display = 'none';
}
async function narrateScene(force) {
  const sc = currentScene(); if (!sc) return;
  if (story.narrated[sc.id] && !force) return;
  story.narrated[sc.id] = true; save('cote3dStory', story);
  storyEl.style.display = 'flex'; storySpeaker.textContent = 'Narrator'; storyText.textContent = '';
  if (camMode === 'free' && document.pointerLockElement) document.exitPointerLock();
  if (!canTalk) { storySpeaker.textContent = sc.title; storyText.textContent = sc.objective + '  (Add an API key for full narration.)'; return; }
  storyThinking.style.display = 'block';
  try {
    storyConvo.push({ role: 'user', parts: [{ text: sc.prompt }] });
    const res = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: 'You are the Narrator of Classroom of the Elite Vol 1. Keep it short (60-100 words).' }, ...toChatMessages(storyConvo.slice(-16))], temperature: 0.85, response_format: { type: 'json_object' } })
    });
    const data = await res.json();
    const raw = data.choices[0].message.content; storyConvo.push({ role: 'model', parts: [{ text: raw }] });
    save('cote3dStoryConvo', storyConvo);
    const p = JSON.parse(raw); storySpeaker.textContent = p.speaker || 'Narrator'; storyText.textContent = p.text || '';
    speakAs(VOICE_STYLE[p.speaker] ? p.speaker : 'Narrator', p.text, 2);
  } catch (e) { storyText.textContent = '⚠️ ' + (e.message || 'Narration failed.'); }
  finally { storyThinking.style.display = 'none'; }
}
function enterScene(i) {
  story.i = Math.max(0, Math.min(SCENES.length - 1, i)); story.active = true; save('cote3dStory', story);
  updateObjective(); narrateScene(false);
}
function nextScene() { if (story.i < SCENES.length - 1) enterScene(story.i + 1); else { storyEl.style.display = 'none'; showToast('Chapter 1 complete.'); } }
function checkSceneArrival() {
  const sc = currentScene(); if (!sc || story.narrated[sc.id]) return;
  const [x, z] = LOC[sc.loc].c;
  if (planar(camera.position.x, camera.position.z, x, z) < 14) narrateScene(false);
}
$('story-continue').onclick = () => { storyEl.style.display = 'none'; };
$('story-next').onclick = nextScene;
$('next-scene-btn').onclick = () => { storyEl.style.display = 'flex'; nextScene(); };

// ---------- Start / Reset ----------
function begin(mode) {
  const k = keyInput.value.trim();
  if (mode !== 'explore') { if (k) { apiKey = k; localStorage.setItem('naraApiKey', apiKey); } canTalk = !!apiKey; }
  else canTalk = false;
  overlay.style.display = 'none';
  if (cv.requestPointerLock) { try { cv.requestPointerLock(); } catch {} }
  if (mode === 'story') { camera.position.set(0, EYE, 95); yaw = 0; enterScene(story.i >= 0 ? story.i : 0); }
  else { camera.position.set(0, EYE, 40); yaw = 0; updateObjective(); }
}
$('story-btn').onclick = () => begin('story');
$('enter-btn').onclick = () => begin('free');
$('explore-btn').onclick = () => begin('explore');
$('reset-btn').onclick = () => {
  if (!confirm('Erase all progress — conversations, story, and stats?')) return;
  ['cote3dStats', 'cote3dConvos', 'cote3dStory', 'cote3dStoryConvo', 'cote3dSocial', 'cote3dDay'].forEach(k => localStorage.removeItem(k));
  location.reload();
};

updateObjective();
updateSchoolScheduleSystem();
animate();
