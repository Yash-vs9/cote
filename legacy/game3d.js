// =====================================================
// Classroom of the Elite — 3D Campus
// Cel-shaded Three.js campus: animated blocky NPCs that
// roam by personality & remember you, cinematic chat,
// and a guided Chapter 1 story.
// =====================================================
import * as THREE from 'three';

// ---------- Config ----------
const MODEL = 'agnes-2.5-flash';
const API_BASE = 'https://router.bynara.id/v1';
const BASE_STATS = { trust: 50, love: 10, respect: 50, wisdom: 70, courage: 40 };
const STAT_ICONS = { trust: '🤝', love: '❤️', respect: '🏅', wisdom: '🧠', courage: '💪' };
const STAT_COLORS = { trust: '#10b981', love: '#ec4899', respect: '#f59e0b', wisdom: '#8b5cf6', courage: '#ef4444' };
const MAX_MEMORY_TURNS = 24;

// ---------- Persisted state ----------
let apiKey = localStorage.getItem('naraApiKey') || '';
let canTalk = false;
let stats = load('cote3dStats', { ...BASE_STATS });
let memory = load('cote3dConvos', {});            // { npcName: [ {role, parts} ] }
let story = load('cote3dStory', { i: -1, active: false, narrated: {} });
let storyConvo = load('cote3dStoryConvo', []);

function load(key, def) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? def; } catch { return def; } }
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.warn(e); } }
// Convert stored {role, parts:[{text}]} history to OpenAI chat format ('model' -> 'assistant').
function toChatMessages(msgs) { return msgs.map(m => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.parts?.[0]?.text ?? '' })); }

// runtime (not persisted)
let activeNPC = null;
let convo = [];
let camMode = 'free';   // 'free' | 'talk' | 'return'

// ---------- DOM ----------
const $ = id => document.getElementById(id);
const overlay = $('overlay'), keyInput = $('key-input');
const statsEl = $('stats'), sceneLabel = $('scene-label'), promptEl = $('prompt'), crosshair = $('crosshair');
const objectiveEl = $('objective'), ovText = $('ov-text');
const dialogue = $('dialogue'), dlgName = $('dlg-name'), dlgLog = $('dlg-log');
const dlgChoices = $('dlg-choices'), dlgInput = $('dlg-input'), dlgThinking = $('dlg-thinking');
const storyEl = $('story'), storySpeaker = $('story-speaker'), storyText = $('story-text'), storyThinking = $('story-thinking');
if (apiKey) keyInput.value = apiKey;

const toast = document.createElement('div');
toast.style.cssText = 'position:absolute;top:70px;left:50%;transform:translateX(-50%);background:rgba(15,17,24,.9);border:1px solid rgba(59,130,246,.4);color:#e2e8f0;padding:10px 18px;border-radius:10px;font-size:14px;display:none;backdrop-filter:blur(8px);';
$('hud').appendChild(toast);
let toastTimer = null;
function showToast(msg, ms = 4500) { toast.textContent = msg; toast.style.display = 'block'; clearTimeout(toastTimer); if (ms) toastTimer = setTimeout(() => toast.style.display = 'none', ms); }

// ---------- Character voices (browser speechSynthesis) ----------
// Uses the OS/browser voice list. In Edge that includes the free "Microsoft ... Natural"
// neural voices, which sound far better than the classic ones — we prefer them when present.
const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
let ttsOn = load('cote3dTTS', true);
let voicesReady = false;
let speakPriority = 0;          // 2 = dialogue/story, 1 = ambient bubble
let speakingNpc = null;

// Per-character delivery. `female` picks which voice pool, pitch/rate shape the personality.
const VOICE_STYLE = {
  Horikita:   { female: true,  pitch: 0.98, rate: 0.97, slot: 0 },
  Kushida:    { female: true,  pitch: 1.28, rate: 1.12, slot: 1 },
  Chabashira: { female: true,  pitch: 0.82, rate: 0.92, slot: 2 },
  Sudou:      { female: false, pitch: 0.86, rate: 1.12, slot: 0 },
  Kouenji:    { female: false, pitch: 1.02, rate: 0.86, slot: 1 },
  Narrator:   { female: false, pitch: 0.95, rate: 1.0,  slot: 2 },
};
const FEMALE_NAMES = /aria|jenny|michelle|ana|emma|zira|hazel|susan|samantha|nanami|mizuki|sonia|libby|maisie|natasha|clara|amber|ashley|cora|elizabeth|monica|sara|luna|karen|moira|tessa|fiona|victoria|female|woman|girl/i;
const MALE_NAMES = /guy|davis|andrew|brian|christopher|eric|jacob|roger|steffan|tony|ryan|thomas|david|mark|alex|daniel|george|liam|william|keita|fred|rishi|arthur|oliver|male|man|boy/i;
const voicePool = { female: [], male: [] };

function loadVoices() {
  if (!synth) return;
  const all = synth.getVoices();
  if (!all.length) return;
  // English first, and neural ("Natural"/"Online") voices ahead of the legacy ones.
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

// Strip anything that shouldn't be read aloud (stage directions, markdown, emoji).
function cleanForSpeech(text) {
  return String(text || '')
    .replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ')
    .replace(/[*_`#>~|]/g, ' ')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ')
    .replace(/[—–]/g, ', ')
    .replace(/\s+/g, ' ').trim().slice(0, 400);
}

// priority 2 interrupts anything; priority 1 (ambient) never cuts off a real conversation.
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

// HUD toggle (also bound to the M key below)
const soundChip = document.createElement('div');
soundChip.style.cssText = 'background:rgba(15,17,24,.86);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:8px 14px;font-size:13px;backdrop-filter:blur(8px);pointer-events:auto;cursor:pointer;';
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

// ---------- Three scaffold ----------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe4f5, 170, 470);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 900);
const EYE = 1.7;
camera.position.set(0, EYE, 40);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------- Lighting ----------
const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6a7a70, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.35);
sun.position.set(80, 130, 60); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -170; sun.shadow.camera.right = 170;
sun.shadow.camera.top = 170; sun.shadow.camera.bottom = -170; sun.shadow.camera.far = 420;
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
scene.add(sun);

// ---------- Cel-shading helpers + caches ----------
const gradientMap = (() => {
  const data = new Uint8Array([70, 130, 200, 255]);
  const t = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
})();
const matCache = new Map();
function toonMat(color) { if (!matCache.has(color)) matCache.set(color, new THREE.MeshToonMaterial({ color, gradientMap })); return matCache.get(color); }
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x10131c, side: THREE.BackSide });
const geoCache = new Map();
function geoBox(w, h, d) { const k = `${w},${h},${d}`; if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d)); return geoCache.get(k); }

// ---------- Sky dome (lerp-able for weather) ----------
const skyMat = new THREE.ShaderMaterial({
  uniforms: { topC: { value: new THREE.Color(0x4f93d1) }, botC: { value: new THREE.Color(0xe9f3fb) } },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 topC; uniform vec3 botC; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*0.5+0.5, 0.0, 1.0); gl_FragColor = vec4(mix(botC, topC, pow(h, 0.75)), 1.0); }',
  side: THREE.BackSide, depthWrite: false, fog: false
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), skyMat);
scene.add(skyDome);

// ---------- Canvas textures (visual richness) ----------
function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const grassTex = canvasTex(128, (ctx, s) => {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    const g = 200 + Math.random() * 55;
    ctx.fillStyle = `rgba(${g * 0.82},${g},${g * 0.7},${0.16 + Math.random() * 0.3})`;
    ctx.fillRect(Math.random() * s, Math.random() * s, 1.6, 2.6);
  }
});
const paveTex = canvasTex(128, (ctx, s) => {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 700; i++) { const g = 225 + Math.random() * 30; ctx.fillStyle = `rgba(${g},${g},${g},.35)`; ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
  ctx.strokeStyle = 'rgba(120,120,120,.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s, 0); ctx.moveTo(0, 0); ctx.lineTo(0, s); ctx.stroke();
});
function repTex(tex, rx, rz) { const t = tex.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, rz); t.needsUpdate = true; return t; }

// Surfaces that visibly darken when wet (own materials, not cached).
const wetSurfaces = [];

// ---------- World primitives ----------
const colliders = [];
function addCollider(x, z, w, d) { colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 }); }
function collidesAt(x, z, r) { for (const c of colliders) if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true; return false; }
function box(w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(geoBox(w, h, d), toonMat(color));
  m.position.set(x, y, z); m.castShadow = opts.noShadow ? false : true; m.receiveShadow = true; scene.add(m);
  if (opts.outline) { const o = new THREE.Mesh(m.geometry, outlineMat); o.position.copy(m.position); o.scale.set(1 + 0.12 / w, 1 + 0.12 / h, 1 + 0.12 / d); scene.add(o); }
  if (opts.collide) addCollider(x, z, w, d);
  return m;
}
function plane(w, d, color, x, z, y = 0.02) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), toonMat(color));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m;
}
// Textured ground surface with its own material so weather can darken it.
function groundPlane(w, d, color, x, z, y, tex, rx, rz) {
  const mat = new THREE.MeshToonMaterial({ color, gradientMap, map: repTex(tex, rx, rz) });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m);
  wetSurfaces.push({ mat, base: new THREE.Color(color) });
  return m;
}
// Nearest collision-free point — guarantees waypoints/spawns are never inside geometry.
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

// ---------- Labels ----------
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function makeLabel(text, x, y, z, color = 0xffffff, scale = 1.6) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(10,12,18,0.72)'; roundRect(ctx, 6, 30, 500, 68, 20); ctx.fill();
  ctx.font = 'bold 50px Segoe UI, sans-serif'; ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  spr.position.set(x, y, z); spr.scale.set(scale * 2, scale * 0.5, 1); scene.add(spr); return spr;
}

// ---------- Locations (large quad campus) ----------
// c = interior standing spot; approach = point just outside the door.
// node = entry waypoint in the navigation graph (below).
const LOC = {
  courtyard: { label: 'Central Courtyard', c: [7, 16],    node: 'courtA' },
  class1d:   { label: 'Class 1-D',          c: [-62, -20], node: 'classA' },
  library:   { label: 'Library',            c: [-62, 22],  node: 'libA' },
  hall:      { label: 'Main Hall',          c: [0, -46],   node: 'hallA' },
  cafeteria: { label: 'Cafeteria',          c: [62, -20],  node: 'cafA' },
  gym:       { label: 'Gymnasium',          c: [62, 22],   node: 'gymA' },
  dorm:      { label: 'Dormitory',          c: [-34, 58],  node: 'dormA' },
  store:     { label: 'Convenience Store',  c: [34, 54],   node: 'storeA' },
  cafe:      { label: 'Campus Café',         c: [52, 54],   node: 'cafeA' },
  field:     { label: 'Sports Field',       c: [-58, 60],  node: 'fieldW' },
  gate:      { label: 'Front Gate',         c: [0, 95],    node: 'gateN' },
};

// ---------- Navigation graph (roads only — never cuts through buildings) ----------
const NAV_NODES = {
  hub: [0, 0], plazaN: [0, 22], plazaS: [0, -20], hallA: [0, -38],
  northA: [0, 44], northB: [0, 70], gateN: [0, 90], courtA: [7, 20],
  fountW: [-9, 8], fountE: [9, 8],          // walk around the fountain, never through it
  wMid: [-46, 0], classA: [-46, -20], libA: [-46, 22],
  eMid: [46, 0], cafA: [46, -20], gymA: [46, 22], eNorth: [46, 44],
  dormA: [-34, 44], storeA: [34, 44], cafeA: [52, 44], fieldW: [-58, 44],
};
const NAV_EDGES = [
  ['hub', 'fountW'], ['hub', 'fountE'], ['fountW', 'plazaN'], ['fountE', 'plazaN'],
  ['hub', 'plazaS'], ['hub', 'wMid'], ['hub', 'eMid'],
  ['plazaS', 'hallA'], ['plazaN', 'northA'], ['plazaN', 'courtA'],
  ['wMid', 'classA'], ['wMid', 'libA'], ['eMid', 'cafA'], ['eMid', 'gymA'],
  ['northA', 'northB'], ['northA', 'dormA'], ['northA', 'storeA'],
  ['northA', 'fieldW'], ['northA', 'eNorth'], ['northB', 'gateN'],
  ['eNorth', 'cafeA'], ['eNorth', 'storeA'], ['eNorth', 'gymA'], ['dormA', 'fieldW'],
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
  for (const [k, p] of Object.entries(NAV_NODES)) { const d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; best = k; } }
  return best;
}
function resolveLoc(str) {
  const s = (str || '').toLowerCase();
  if (/librar/.test(s)) return 'library';
  if (/cafeteria|canteen|dining|lunch/.test(s)) return 'cafeteria';
  if (/caf[eé]|coffee/.test(s)) return 'cafe';
  if (/class/.test(s)) return 'class1d';
  if (/hall|auditor|ceremony|assembly/.test(s)) return 'hall';
  if (/dorm|room/.test(s)) return 'dorm';
  if (/gym/.test(s)) return 'gym';
  if (/field|sport|track|soccer|basket|playground/.test(s)) return 'field';
  if (/store|conven|shop|mart/.test(s)) return 'store';
  if (/gate|bus|entrance/.test(s)) return 'gate';
  if (/court|yard|plaza|fountain/.test(s)) return 'courtyard';
  return LOC[s] ? s : null;
}

// ---------- Buildings ----------
// face: 'S'(+z) 'N'(-z) 'E'(+x) 'W'(-x) — side with the doorway.
function building(cx, cz, w, d, h, color, name, face = 'S') {
  const t = 0.5, doorW = 5, roof = 0xb05a48;
  const wall = (ww, hh, dd, x, y, z) => box(ww, hh, dd, color, x, y, z, { collide: true });
  // solid walls + door wall (split)
  function doorWall(axis, sign) {
    if (axis === 'z') {
      const z = cz + sign * d / 2, seg = (w - doorW) / 2;
      wall(seg, h, t, cx - (doorW / 2 + seg / 2), h / 2, z);
      wall(seg, h, t, cx + (doorW / 2 + seg / 2), h / 2, z);
      box(doorW, h - 3, t, color, cx, h - (h - 3) / 2, z);
    } else {
      const x = cx + sign * w / 2, seg = (d - doorW) / 2;
      wall(t, h, seg, x, h / 2, cz - (doorW / 2 + seg / 2));
      wall(t, h, seg, x, h / 2, cz + (doorW / 2 + seg / 2));
      box(t, h - 3, doorW, color, x, h - (h - 3) / 2, cz);
    }
  }
  const doors = { S: ['z', 1], N: ['z', -1], E: ['x', 1], W: ['x', -1] };
  const [dax, dsg] = doors[face];
  if (!(dax === 'z' && dsg === 1)) wall(w, h, t, cx, h / 2, cz + d / 2); else doorWall('z', 1);
  if (!(dax === 'z' && dsg === -1)) wall(w, h, t, cx, h / 2, cz - d / 2); else doorWall('z', -1);
  if (!(dax === 'x' && dsg === 1)) wall(t, h, d, cx + w / 2, h / 2, cz); else doorWall('x', 1);
  if (!(dax === 'x' && dsg === -1)) wall(t, h, d, cx - w / 2, h / 2, cz); else doorWall('x', -1);
  box(w + 1.2, 0.5, d + 1.2, roof, cx, h + 0.25, cz);          // roof slab
  box(w + 1.6, 0.35, d + 1.6, 0x8f4a3b, cx, h + 0.02, cz);      // eaves
  box(w * 0.5, 0.45, d + 1.9, 0xc2685a, cx, h + 0.62, cz);      // ridge
  box(w + 0.3, 0.4, d + 0.3, 0xf3efe6, cx, h - 0.3, cz);        // wall trim band
  plane(w - t, d - t, 0xece7db, cx, cz);
  addWindows(cx, cz, w, d, h, face);
  const lp = { S: [cx, cz + d / 2], N: [cx, cz - d / 2], E: [cx + w / 2, cz], W: [cx - w / 2, cz] }[face];
  makeLabel(name, lp[0], h + 2.1, lp[1], 0xffffff, 3);
  return { cx, cz, w, d };
}
// Window rows on each facade (skipping the doorway) — big readability win.
function addWindows(cx, cz, w, d, h, face) {
  const y = h * 0.55, gw = 2.1, gh = 1.7, glass = 0x74a3cd, frame = 0xf7f4ec;
  const put = (x, z, horiz) => {
    const fw = horiz ? gw + 0.3 : 0.12, fd = horiz ? 0.12 : gw + 0.3;
    box(fw, gh + 0.3, fd, frame, x, y, z, { noShadow: true });
    box(horiz ? gw : 0.06, gh, horiz ? 0.06 : gw, glass, x, y, z, { noShadow: true });
  };
  const stepsX = Math.max(2, Math.floor((w - 6) / 5)), stepsZ = Math.max(2, Math.floor((d - 6) / 5));
  for (let i = 0; i < stepsX; i++) {
    const x = cx - (stepsX - 1) * 2.6 + i * 5.2;
    if (face !== 'S' || Math.abs(x - cx) > 4) put(x, cz + d / 2 + 0.3, true);
    if (face !== 'N' || Math.abs(x - cx) > 4) put(x, cz - d / 2 - 0.3, true);
  }
  for (let i = 0; i < stepsZ; i++) {
    const z = cz - (stepsZ - 1) * 2.6 + i * 5.2;
    if (face !== 'E' || Math.abs(z - cz) > 4) put(cx + w / 2 + 0.3, z, false);
    if (face !== 'W' || Math.abs(z - cz) > 4) put(cx - w / 2 - 0.3, z, false);
  }
}

// ---------- Furniture ----------
function desks(cx, cz, cols, rows, back) {
  const bz = back ?? cz - 3;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = cx - (cols - 1) * 2 + c * 4, z = bz + r * 3;
    box(1.3, 0.75, 0.85, 0x9c7b52, x, 0.38, z, { collide: true });
    box(0.8, 0.5, 0.8, 0x3f3f46, x, 0.25, z + 1, { collide: true });
  }
}
function classroom(cx, cz) { desks(cx, cz, 3, 2, cz - 6); box(3, 0.85, 1.1, 0x6b4f32, cx, 0.43, cz - 9, { collide: true }); box(7, 2.4, 0.14, 0x1f2937, cx, 2.2, cz - 10.2); }
function libraryRoom(cx, cz) { for (const sz of [-8, -4, 6, 10]) box(14, 3, 1.2, 0x8a5a3c, cx, 1.5, cz + sz, { collide: true }); for (const dx of [-4, 4]) { box(2.4, 0.75, 1.2, 0x7c5c3a, cx + dx, 0.38, cz, { collide: true }); box(0.7, 0.5, 0.7, 0x3f3f46, cx + dx, 0.25, cz + 0.9, { collide: true }); } }
// Tables sit well clear of the z=cz entry aisle so people can always walk in.
function cafeteriaRoom(cx, cz) { box(12, 1.1, 1.6, 0xb8bcc4, cx, 0.55, cz - 9, { collide: true }); for (const dx of [-5, 0, 5]) for (const dz of [-6, 3.5]) { box(2.4, 0.7, 1.4, 0xcaa06a, cx + dx, 0.36, cz + dz, { collide: true }); } }
function gymRoom(cx, cz) { plane(20, 24, 0xc98a4b, cx, cz, 0.03); for (const hz of [cz - 9, cz + 9]) { box(0.35, 4, 0.35, 0x444a55, cx, 2, hz, { collide: true }); const rim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 8, 18), toonMat(0xff7a2f)); rim.rotation.x = Math.PI / 2; rim.position.set(cx, 3, hz + (hz < cz ? 0.9 : -0.9)); scene.add(rim); } }
function dormRoom(cx, cz) { box(2.6, 0.6, 4.5, 0xf1f5f9, cx - 4, 0.3, cz, { collide: true }); box(2.6, 0.22, 4.5, 0x60a5fa, cx - 4, 0.72, cz); box(1.6, 1.6, 1.4, 0x9ca3af, cx + 4.5, 0.8, cz - 4, { collide: true }); box(2.2, 0.8, 1, 0x7c5c3a, cx + 4, 0.4, cz + 3, { collide: true }); }
function storeRoom(cx, cz) { for (const sx of [-2.5, 2.5]) box(1, 1.8, 4, 0xdad3c2, cx + sx, 0.9, cz - 1, { collide: true }); box(4, 1, 1, 0xb8bcc4, cx, 0.5, cz + 2, { collide: true }); }
function cafeRoom(cx, cz) { for (const [dx, dz] of [[-3.4, -1.5], [3.4, -1.5], [0, 3.2]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.6, 0.75, 12), toonMat(0x8a5a3c)); t.position.set(cx + dx, 0.38, cz + dz); t.castShadow = true; scene.add(t); addCollider(cx + dx, cz + dz, 1.4, 1.4); } box(5, 1.1, 1.2, 0x6b4f32, cx, 0.55, cz - 4, { collide: true }); }
function hallRoom(cx, cz) { box(10, 1.4, 3, 0x8a5a3c, cx, 0.7, cz - 10, { collide: true }); for (let r = 0; r < 4; r++) for (const dx of [-6, 0, 6]) box(4, 0.5, 1.4, 0x556070, cx + dx, 0.25, cz - 4 + r * 3, { collide: true }); }

// outdoor sports field
function sportsField(cx, cz) {
  plane(46, 34, 0xcf9a5a, cx, cz, 0.03);
  plane(30, 20, 0x6ea04a, cx, cz + 6, 0.04); // grass pitch
  for (const hz of [cz - 12, cz + 12]) { box(0.35, 4, 0.35, 0x444a55, cx - 8, 2, hz, { collide: true }); box(0.35, 4, 0.35, 0x444a55, cx + 8, 2, hz, { collide: true }); }
  makeLabel('SPORTS FIELD', cx, 5, cz - 12, 0xffffff, 3);
}

// ---------- Props (shared geometry) ----------
const treeTrunkGeo = geoBox(0.6, 3.4, 0.6);
const treeLeafGeo = new THREE.SphereGeometry(1.9, 12, 12);
function tree(x, z) {
  const tr = new THREE.Mesh(treeTrunkGeo, toonMat(0x6b4f2a)); tr.position.set(x, 1.7, z); tr.castShadow = true; scene.add(tr);
  addCollider(x, z, 0.7, 0.7);
  const lv = new THREE.Mesh(treeLeafGeo, toonMat(0x5a9c46)); lv.position.set(x, 4.1, z); lv.castShadow = true; scene.add(lv);
  const o = new THREE.Mesh(treeLeafGeo, outlineMat); o.position.copy(lv.position); o.scale.multiplyScalar(1.05); scene.add(o);
}
function lamp(x, z) { box(0.25, 4, 0.25, 0x3a3f47, x, 2, z, { collide: true }); const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), toonMat(0xfff3c4)); b.position.set(x, 4.1, z); scene.add(b); }
function bench(x, z) { box(2.4, 0.25, 0.8, 0x8a5a3c, x, 0.55, z, { collide: true }); box(2.4, 0.6, 0.2, 0x8a5a3c, x, 0.9, z - 0.3); }
function vending(x, z) { box(1.2, 2, 0.8, 0xd23b3b, x, 1, z, { collide: true }); box(0.8, 1.2, 0.05, 0x1a1a1a, x, 1.2, z + 0.42); }
function fountain(cx, cz) {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.3, 0.7, 28), toonMat(0xb9bec8)); base.position.set(cx, 0.35, cz); base.castShadow = base.receiveShadow = true; scene.add(base);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.22, 28), toonMat(0x5fa8d6)); water.position.set(cx, 0.65, cz); scene.add(water);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 2, 12), toonMat(0xb9bec8)); spout.position.set(cx, 1.5, cz); scene.add(spout);
  addCollider(cx, cz, 6.2, 6.2);
}
function bus(x, z) { box(9, 3.2, 2.6, 0xded4c0, x, 1.6, z, { collide: true }); box(8, 1.2, 2.5, 0x2b3242, x, 2.3, z + 0.05); box(9.05, 0.6, 2.65, 0x2b4a8a, x, 0.5, z); makeLabel('🚌 BUS', x, 3.6, z, 0xffffff, 2); }
function fence(x1, z1, x2, z2, n) { for (let i = 0; i <= n; i++) { const x = x1 + (x2 - x1) * i / n, z = z1 + (z2 - z1) * i / n; box(0.2, 1.4, 0.2, 0x8a8f98, x, 0.7, z, { collide: true }); } }
function hedge(x, z) { box(5, 1, 1.6, 0x4d7c3a, x, 0.5, z, { collide: true, outline: true }); box(5.1, 0.25, 1.7, 0x6fa04c, x, 1.05, z, { noShadow: true }); }
function bikeRack(x, z) {
  box(4.4, 0.2, 0.2, 0x8a8f98, x, 0.75, z, { collide: true });
  for (let i = 0; i < 4; i++) { const bx = x - 1.65 + i * 1.1; box(0.12, 1.5, 0.12, 0x8a8f98, bx, 0.75, z, { noShadow: true }); box(0.16, 0.9, 1.5, 0x2f6bbf, bx, 0.6, z + 1.1, { noShadow: true }); }
}

// ---------- Build campus ----------
groundPlane(520, 520, 0x8fbf6a, 0, 0, 0, grassTex, 90, 90);        // grass
groundPlane(150, 150, 0xe4dfd0, 0, 8, 0.01, paveTex, 26, 26);      // central plaza
groundPlane(13, 170, 0xd7d1c0, 0, 20, 0.012, paveTex, 3, 34);      // N-S promenade
groundPlane(230, 13, 0xd7d1c0, 0, 0, 0.012, paveTex, 46, 3);       // E-W promenade
[-46, 46].forEach(px => groundPlane(14, 96, 0xd7d1c0, px, 0, 0.012, paveTex, 3, 20)); // side paths
groundPlane(120, 13, 0xd7d1c0, 0, 44, 0.012, paveTex, 24, 3);      // north cross street

building(-62, -20, 22, 24, 6, 0xe3d9c6, 'CLASS 1-D', 'E'); classroom(-62, -20);
building(-62, 22, 22, 24, 6, 0xdfe0d3, 'LIBRARY', 'E'); libraryRoom(-62, 22);
building(0, -56, 40, 28, 8, 0xe6ddc9, 'MAIN HALL', 'S'); hallRoom(0, -56);
building(62, -20, 22, 24, 6, 0xe6d6c0, 'CAFETERIA', 'W'); cafeteriaRoom(62, -20);
building(62, 22, 24, 26, 7, 0xd8c7b0, 'GYMNASIUM', 'W'); gymRoom(62, 22);
building(-34, 58, 26, 22, 6, 0xd3c9b6, 'DORMITORY', 'N'); dormRoom(-34, 58);
building(34, 54, 12, 12, 5, 0xdad0bd, 'STORE', 'N'); storeRoom(34, 54);
building(52, 54, 12, 12, 5, 0xe0cdb0, 'CAFÉ', 'N'); cafeRoom(52, 54);
sportsField(-58, 60);
bus(-10, 96); makeLabel('FRONT GATE', 0, 5, 88, 0xffffff, 3);
box(2, 6, 2, 0x9aa0a8, -14, 3, 88, { collide: true }); box(2, 6, 2, 0x9aa0a8, 14, 3, 88, { collide: true });
box(30, 1, 1, 0x9aa0a8, 0, 6.2, 88);

fountain(0, 8);
// Trees kept clear of the promenades (x=0 and z=0/44 lanes stay walkable).
for (const [tx, tz] of [[-22, 26], [22, 26], [-22, -8], [22, -8], [-26, 36], [26, 36],
  [18, -30], [-18, -30], [-70, 34], [70, 34], [14, 62], [-14, 62], [66, 66], [-66, 84], [24, 76], [-24, 76]]) tree(tx, tz);
for (const [lx, lz] of [[-10, 18], [10, 18], [-10, -12], [10, -12], [-40, 8], [40, 8],
  [-10, 38], [10, 38], [-10, 56], [10, 56], [-10, 78], [10, 78]]) lamp(lx, lz);
for (const [bx, bz] of [[-8, 20], [8, 20], [-8, -6], [8, -6], [-8, 30], [8, 52]]) bench(bx, bz);
vending(16, 40); vending(-16, 40);
for (const [hx, hz] of [[-20, 12], [20, 12], [-20, 4], [20, 4]]) hedge(hx, hz);
bikeRack(-20, 48); bikeRack(20, 48);
fence(-95, 112, 95, 112, 34); fence(-95, -95, -95, 112, 34); fence(95, -95, 95, 112, 34);

// ---------- Sanitize waypoints ----------
// Guarantees every destination & nav node is reachable (nothing sits inside a collider).
(function sanitizeNav() {
  for (const [k, p] of Object.entries(NAV_NODES)) {
    const f = findFreeSpot(p[0], p[1], 0.6);
    if (f.x !== p[0] || f.z !== p[1]) { console.info(`nav node ${k} nudged clear of geometry`); NAV_NODES[k] = [f.x, f.z]; }
  }
  for (const [k, L] of Object.entries(LOC)) {
    const f = findFreeSpot(L.c[0], L.c[1], 0.6);
    if (f.x !== L.c[0] || f.z !== L.c[1]) { console.info(`location ${k} spot nudged clear of geometry`); L.c = [f.x, f.z]; }
  }
})();

// ---------- Articulated humanoid rig ----------
// Real proportions (~1.74 tall, eyes ~1.62 so they meet the player's gaze at EYE=1.7),
// two-segment limbs with knees/elbows, expressive face.
const capCache = new Map(), cylCache = new Map(), sphCache = new Map();
function geoCap(r, l) { const k = `${r},${l}`; if (!capCache.has(k)) capCache.set(k, new THREE.CapsuleGeometry(r, l, 4, 10)); return capCache.get(k); }
function geoCyl(rt, rb, h) { const k = `${rt},${rb},${h}`; if (!cylCache.has(k)) cylCache.set(k, new THREE.CylinderGeometry(rt, rb, h, 14)); return cylCache.get(k); }
function geoSph(r) { const k = `${r}`; if (!sphCache.has(k)) sphCache.set(k, new THREE.SphereGeometry(r, 18, 14)); return sphCache.get(k); }

function addPart(parent, geo, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(geo, toonMat(color));
  m.position.set(x, y, z); m.castShadow = !opts.noShadow;
  if (opts.scale) m.scale.set(...opts.scale);
  if (opts.rot) m.rotation.set(...opts.rot);
  parent.add(m);
  if (opts.outline) { const o = new THREE.Mesh(geo, outlineMat); o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.copy(m.scale).multiplyScalar(1.06); parent.add(o); }
  return m;
}
// A limb segment hanging from a joint pivot (so rotation happens at the joint).
function segment(parent, jx, jy, jz, r, len, color) {
  const pivot = new THREE.Group(); pivot.position.set(jx, jy, jz); parent.add(pivot);
  addPart(pivot, geoCap(r, len), color, 0, -len / 2, 0, { outline: true });
  return pivot;
}

function buildFace(head, cfg) {
  const skin = cfg.skin ?? 0xf1c9a5;
  const eyes = [];
  for (const ex of [-0.058, 0.058]) {
    const g = new THREE.Group(); g.position.set(ex, 0.012, 0.098); head.add(g);
    addPart(g, geoSph(0.032), 0xfbfbfd, 0, 0, 0, { noShadow: true, scale: [1, 1.12, 0.5] });          // sclera
    addPart(g, geoSph(0.019), cfg.eyes ?? 0x3b2f2a, 0, 0, 0.016, { noShadow: true, scale: [1, 1.1, 0.6] }); // iris
    addPart(g, geoSph(0.009), 0x120f14, 0, 0, 0.026, { noShadow: true });                              // pupil
    addPart(g, geoSph(0.006), 0xffffff, 0.011, 0.014, 0.03, { noShadow: true });                       // catchlight
    eyes.push(g);
    addPart(head, geoBox(0.052, 0.011, 0.014), cfg.hair, ex, 0.062, 0.104, { noShadow: true, rot: [0, 0, ex > 0 ? -0.14 : 0.14] }); // brow
  }
  addPart(head, geoCap(0.016, 0.03), skin, 0, -0.028, 0.113, { noShadow: true, rot: [0.3, 0, 0] });     // nose
  const mouth = addPart(head, geoBox(0.05, 0.014, 0.012), 0xb4685f, 0, -0.088, 0.108, { noShadow: true });
  for (const ex of [-0.125, 0.125]) addPart(head, geoSph(0.028), skin, ex, -0.02, 0.01, { noShadow: true, scale: [0.6, 1, 0.8] }); // ears
  return { eyes, mouth };
}

function buildHair(head, cfg) {
  const c = cfg.hair, S = cfg.hairStyle;
  addPart(head, geoSph(0.132), c, 0, 0.012, -0.008, { scale: [1.06, 1.0, 1.06] });                     // skull cap
  addPart(head, geoBox(0.23, 0.055, 0.075), c, 0, 0.088, 0.085, { rot: [0.16, 0, 0] });                // fringe
  if (S === 'long') {
    addPart(head, geoBox(0.235, 0.44, 0.1), c, 0, -0.19, -0.085, { scale: [1, 1, 1] });
    for (const ex of [-0.115, 0.115]) addPart(head, geoBox(0.06, 0.3, 0.075), c, ex, -0.11, 0.045);     // side locks
  } else if (S === 'medium') {
    for (const ex of [-0.125, 0.125]) addPart(head, geoBox(0.062, 0.22, 0.16), c, ex, -0.055, 0.02);
    addPart(head, geoBox(0.225, 0.16, 0.1), c, 0, -0.075, -0.08);
    for (const ex of [-0.15, 0.15]) addPart(head, geoSph(0.05), c, ex, -0.16, -0.02, { scale: [0.8, 1.3, 0.8] }); // twin tails
  } else if (S === 'spiky') {
    for (const [sx, sz, sy] of [[-0.07, -0.06, 0.16], [0.07, -0.06, 0.16], [0, 0.02, 0.185], [-0.1, 0.05, 0.14], [0.1, 0.05, 0.14]])
      addPart(head, new THREE.ConeGeometry(0.045, 0.12, 6), c, sx, sy, sz, { rot: [sz * 1.4, 0, -sx * 2.2] });
  } else if (S === 'slick') {
    addPart(head, geoBox(0.245, 0.07, 0.18), c, 0, 0.108, -0.012, { rot: [-0.2, 0, 0] });
    addPart(head, geoBox(0.1, 0.05, 0.11), c, 0.075, 0.1, 0.075, { rot: [0.2, 0, 0.4] });
  }
}

function makeRig(cfg) {
  const skin = cfg.skin ?? 0xf1c9a5, blazer = cfg.blazer ?? 0x28304a;
  const female = cfg.gender === 'f';
  const lower = cfg.lower ?? (female ? 0x2f3550 : 0x2b2f3a);
  const scale = cfg.height ?? 1;

  const root = new THREE.Group();
  const body = new THREE.Group(); body.scale.setScalar(scale); root.add(body);

  // pelvis -> torso -> chest
  const hips = new THREE.Group(); hips.position.y = 0.92; body.add(hips);
  addPart(hips, geoCyl(0.145, 0.125, 0.16), lower, 0, -0.05, 0, { outline: true, scale: [1, 1, 0.72] });
  const torso = new THREE.Group(); hips.add(torso);
  addPart(torso, geoCyl(0.175, 0.142, 0.5), blazer, 0, 0.25, 0, { outline: true, scale: [1, 1, 0.66] });
  addPart(torso, geoBox(0.15, 0.32, 0.12), 0xf7f5ef, 0, 0.33, 0.093, { noShadow: true });               // shirt front
  addPart(torso, geoBox(0.052, 0.2, 0.02), cfg.tie ?? 0x9b2d2d, 0, 0.3, 0.152, { noShadow: true });      // tie
  addPart(torso, geoBox(0.2, 0.05, 0.07), 0xf7f5ef, 0, 0.455, 0.088, { noShadow: true, rot: [0.25, 0, 0] }); // collar
  for (const sx of [-0.055, 0.055]) addPart(torso, geoBox(0.075, 0.3, 0.03), blazer, sx, 0.31, 0.115, { noShadow: true, rot: [0, 0, sx > 0 ? 0.07 : -0.07] }); // lapels
  addPart(torso, geoCyl(0.115, 0.13, 0.1), blazer, 0, 0.5, 0, { noShadow: true, scale: [1, 1, 0.7] });   // shoulder yoke

  // neck + head
  addPart(torso, geoCyl(0.045, 0.05, 0.075), skin, 0, 0.545, 0, { noShadow: true });
  const head = new THREE.Group(); head.position.y = 0.7; torso.add(head);
  addPart(head, geoSph(0.118), skin, 0, 0, 0, { outline: true, scale: [0.93, 1.16, 1.0] });
  addPart(head, geoBox(0.1, 0.06, 0.05), skin, 0, -0.1, 0.062, { noShadow: true, scale: [1, 1, 1] });   // chin/jaw
  const face = buildFace(head, cfg);
  buildHair(head, cfg);

  // arms: shoulder -> elbow -> hand
  const arms = {};
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'R' : 'L';
    const sh = segment(torso, side * 0.185, 0.475, 0, 0.052, 0.27, blazer);
    const el = segment(sh, 0, -0.27, 0, 0.045, 0.25, cfg.sleeve ?? blazer);
    addPart(el, geoSph(0.048), skin, 0, -0.27, 0, { noShadow: true, scale: [1, 0.85, 0.8] });           // hand
    arms['arm' + key] = sh; arms['elbow' + key] = el;
  }

  // legs: hip -> knee -> foot
  const legs = {};
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'R' : 'L';
    const hip = segment(hips, side * 0.082, -0.06, 0, 0.078, 0.4, female ? skin : lower);
    const knee = segment(hip, 0, -0.4, 0, 0.062, 0.38, female ? skin : lower);
    if (female) addPart(knee, geoCap(0.066, 0.16), 0x2b2f3a, 0, -0.3, 0, { noShadow: true });           // sock
    const foot = addPart(knee, geoBox(0.088, 0.055, 0.19), 0x24262c, 0, -0.4, 0.038, { noShadow: true });
    legs['leg' + key] = hip; legs['knee' + key] = knee; legs['foot' + key] = foot;
  }
  if (female) addPart(hips, geoCyl(0.15, 0.245, 0.24), lower, 0, -0.16, 0, { outline: true, scale: [1, 1, 0.8] }); // skirt

  return { root, body, hips, torso, head, face, ...arms, ...legs, height: 1.74 * scale };
}

// Procedural animation: walk with knee/elbow bend, idle breathing + weight shift,
// blinking, talking gestures, and head tracking of a look target.
function animateRig(rig, a, dt) {
  a.blinkT = (a.blinkT ?? 2) - dt;
  if (a.blinkT < 0) a.blinkT = 2.4 + Math.random() * 3.5;
  const blink = a.blinkT < 0.13 ? Math.max(0.08, Math.abs(a.blinkT - 0.065) / 0.065) : 1;
  for (const e of rig.face.eyes) e.scale.y = blink;

  const damp = Math.min(1, dt * 9);
  const lerpTo = (obj, axis, target) => { obj.rotation[axis] += (target - obj.rotation[axis]) * damp; };

  if (a.moving) {
    const p = a.phase, s = Math.sin(p), c = Math.cos(p);
    const stride = a.run ? 1.25 : 1;
    rig.legL.rotation.x = s * 0.5 * stride;
    rig.legR.rotation.x = -s * 0.5 * stride;
    rig.kneeL.rotation.x = Math.max(0, -Math.sin(p + 0.7)) * 0.95 * stride;
    rig.kneeR.rotation.x = Math.max(0, -Math.sin(p + 0.7 + Math.PI)) * 0.95 * stride;
    rig.footL.rotation.x = -s * 0.18; rig.footR.rotation.x = s * 0.18;
    rig.armL.rotation.x = -s * 0.42 * stride; rig.armR.rotation.x = s * 0.42 * stride;
    rig.armL.rotation.z = 0.06; rig.armR.rotation.z = -0.06;
    rig.elbowL.rotation.x = -0.3 - Math.max(0, -s) * 0.4;
    rig.elbowR.rotation.x = -0.3 - Math.max(0, s) * 0.4;
    rig.hips.position.y = 0.92 + Math.abs(Math.sin(p * 2)) * 0.026;
    rig.hips.rotation.y = s * 0.09;              // pelvis rotation
    rig.torso.rotation.y = -s * 0.07;            // counter-rotate shoulders
    rig.torso.rotation.z = c * 0.02;
    rig.body.rotation.z = s * 0.015;
  } else {
    for (const j of ['legL', 'legR', 'kneeL', 'kneeR', 'armL', 'armR', 'footL', 'footR']) lerpTo(rig[j], 'x', 0);
    lerpTo(rig.elbowL, 'x', -0.16); lerpTo(rig.elbowR, 'x', -0.16);
    lerpTo(rig.torso, 'y', 0); lerpTo(rig.hips, 'y', 0);
    const breathe = Math.sin(a.idleT * 1.5) * 0.008;
    rig.hips.position.y += (0.92 + breathe - rig.hips.position.y) * damp;
    const shift = Math.sin(a.idleT * 0.42);      // slow weight shift
    rig.hips.rotation.z += (shift * 0.035 - rig.hips.rotation.z) * damp;
    rig.torso.rotation.z += (-shift * 0.025 - rig.torso.rotation.z) * damp;
    rig.armL.rotation.z += (0.08 + shift * 0.02 - rig.armL.rotation.z) * damp;
    rig.armR.rotation.z += (-0.08 + shift * 0.02 - rig.armR.rotation.z) * damp;
    rig.body.rotation.z += (0 - rig.body.rotation.z) * damp;

    if (a.talk) {                                 // gesture + mouth while speaking
      const g = Math.sin(a.idleT * 3.1);
      rig.armR.rotation.x += (-0.45 - g * 0.22 - rig.armR.rotation.x) * damp;
      rig.elbowR.rotation.x += (-0.85 + g * 0.25 - rig.elbowR.rotation.x) * damp;
      rig.face.mouth.scale.y = 1 + Math.abs(Math.sin(a.idleT * 9)) * 2.2;
      rig.torso.rotation.y += (g * 0.05 - rig.torso.rotation.y) * damp;
    } else rig.face.mouth.scale.y += (1 - rig.face.mouth.scale.y) * damp;
  }

  // head: track the look target, else drift naturally
  const wantY = a.lookAt ?? Math.sin(a.idleT * 0.5) * 0.22;
  const wantX = a.lookPitch ?? 0;
  rig.head.rotation.y += (Math.max(-1.1, Math.min(1.1, wantY)) - rig.head.rotation.y) * Math.min(1, dt * 5);
  rig.head.rotation.x += (Math.max(-0.5, Math.min(0.5, wantX)) - rig.head.rotation.x) * Math.min(1, dt * 5);
}

// ---------- Speech bubbles (free ambient life, no API calls) ----------
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
  if (playerDist(npc) < 18) speakAs(npc.name, text, 1, npc);   // ambient — won't cut off a conversation
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ---------- School clock (drives realistic daily routine) ----------
// One full 24-hour day = DAY_REAL_MIN real minutes.
const DAY_REAL_MIN = 20;
const MIN_PER_SEC = 1440 / (DAY_REAL_MIN * 60);
let clockMin = 8 * 60;                 // start Day 1, 08:00
let gameDay = load('cote3dDay', 1);
const clockChip = document.createElement('div');
clockChip.style.cssText = 'background:rgba(15,17,24,.86);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:8px 14px;font-size:13px;backdrop-filter:blur(8px);';
$('topright').appendChild(clockChip);
function hhmm() { const h = Math.floor(clockMin / 60) % 24, m = Math.floor(clockMin % 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
// Fixed 24h rhythm: everyone attends class in the morning, AI-planned tasks in
// the afternoon/evening, dorms for sleep at night.
function phaseOf(h) {
  if (h >= 6 && h < 8) return 'wake';
  if (h >= 8 && h < 12) return 'class';
  if (h >= 12 && h < 13.3) return 'lunch';
  if (h >= 13.3 && h < 15.5) return 'class';
  if (h >= 15.5 && h < 18.5) return 'free';
  if (h >= 18.5 && h < 22) return 'evening';
  return 'sleep';
}
const PHASE_LABEL = { wake: 'Morning', class: 'Lessons', lunch: 'Lunch break', free: 'After school', evening: 'Evening', sleep: 'Asleep' };
// Non-negotiable timetable — nobody may wander during these phases.
const MANDATORY = { wake: 'class1d', class: 'class1d', lunch: 'cafeteria', sleep: 'dorm' };
function periodName() { return PHASE_LABEL[phaseOf(clockMin / 60)]; }
let lastPhaseKey = phaseOf(clockMin / 60);
function requiredNow(npc) {
  const phase = phaseOf(clockMin / 60);
  let dest = MANDATORY[phase];                        // timetable first, always
  if (!dest) dest = plannedSpot(npc, clockMin / 60) || pick(npc.spots);
  if (wCur.rain > 0.35 && OUTDOOR.has(dest)) dest = INDOOR_FALLBACK[dest] || 'cafeteria';
  return dest;
}

// ---------- AI-planned day (one API call at the start of each in-game day) ----------
let dayPlan = load('cote3dDayPlan', null);   // { day, plans: {name: [blocks]}, _fb }
function activeTask(npc, hour) {
  const blocks = (dayPlan && dayPlan.day === gameDay) ? dayPlan.plans?.[npc.name] : null;
  if (!Array.isArray(blocks)) return null;
  return blocks.find(b => hour >= b.s && hour < b.e) || null;
}
function plannedSpot(npc, hour) {
  const b = activeTask(npc, hour);
  if (!b || !LOC[b.loc]) return null;
  npc._curTask = b.task || null;
  if (b.line && npc._taskKey !== b.s) {       // announce the task once, in character
    npc._taskKey = b.s;
    if (playerDist(npc) < 26 && !busyUI()) say(npc, b.line, 4200);
  }
  return b.loc;
}
function fallbackBlocks(n) {                   // used when there's no key / the AI fails
  const spots = n.spots.filter(s => s !== 'class1d');
  return [
    { s: 15.5, e: 17, loc: pick(spots.length ? spots : n.spots), task: 'free time', line: '' },
    { s: 17, e: 18.5, loc: pick(n.spots), task: 'free time', line: '' },
    { s: 18.5, e: 22, loc: 'dorm', task: 'at the dorm', line: '' }
  ];
}
// Planned blocks: keep only the AI-planned free-time hours; every other hour is
// filled with random personality spots so the day is never dead.
function sanitizePlans(obj) {
  const FREE_HOURS = [];
  for (let h = 15.5; h < 22; h += 0.5) FREE_HOURS.push(h);
  const out = {};
  for (const n of npcs) {
    const blocks = Array.isArray(obj?.[n.name]) ? obj[n.name] : [];
    const clean = [];
    for (const b of blocks) {
      const s = Number(b.s), e = Number(b.e);
      let loc = String(b.loc || '').toLowerCase();
      if (!LOC[loc]) loc = resolveLoc(loc);
      if (!isFinite(s) || !isFinite(e) || e <= s || !loc || loc === 'class1d') continue;
      clean.push({ s: Math.max(15.5, s), e: Math.min(22, e), loc, task: String(b.task || '').slice(0, 60), line: String(b.line || '').slice(0, 90) });
    }
    clean.sort((a, b) => a.s - b.s);
    // fill every unplanned half-hour with a random spot from the person's own list
    for (const h of FREE_HOURS) {
      const covered = clean.some(b => h >= b.s && h < b.e);
      if (!covered) clean.push({ s: h, e: h + 0.5, loc: pick(n.spots), task: 'free time', line: '' });
    }
    clean.sort((a, b) => a.s - b.s);
    out[n.name] = clean.length ? clean : fallbackBlocks(n);
  }
  return out;
}
const PLAN_SYS_PROMPT = `You are the life director of a school-life simulation set in "Classroom of the Elite" (Class 1-D). MORNING lessons (6:00-12:00 in class1d), LUNCH (12:00-13:30 in cafeteria) and AFTERNOON lessons (13:30-15:30 in class1d) are FIXED and must NOT appear in your plan. You decide ONLY what each person does AFTER SCHOOL (15:30-18:30) and in the EVENING (18:30-21:59). Stay 100% true to their personality, and VARY the spots from day to day: use the library, the gym, the sports field, the store, the café, the courtyard, the dorm — not always the same place.
Return ONLY valid JSON, exactly this shape:
{"plans":{"<Name>":[{"s":15.5,"e":17,"loc":"<locKey>","task":"<short activity>","line":"<optional in-character remark>"}, ...]}}
Rules:
- locKey must be one of: library, hall, cafeteria, gym, dorm, store, cafe, field, gate, courtyard.
- Each person gets 2-3 blocks that together cover 15.5 to 22 with no gaps; s and e are decimal hours between 15.5 and 22; the final block ends at 22 with loc "dorm" (everyone sleeps at night).
- task is 3-6 words describing the activity; line (0-12 words, or "") is something they might say about it, in character.
Respond with ONLY the JSON object — no fences, no commentary.`;
async function planDay(day) {
  const useFallback = () => { const plans = {}; for (const n of npcs) plans[n.name] = fallbackBlocks(n); dayPlan = { day, plans, _fb: true }; save('cote3dDayPlan', dayPlan); };
  if (!canTalk) { useFallback(); return; }
  try {
    const roster = npcs.map(n => `${n.name}: ${n.persona.slice(0, 130)}`).join('\n');
    const res = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: PLAN_SYS_PROMPT },
          { role: 'user', content: `Day ${day}. Plan today's after-school and evening for:\n${roster}` }
        ],
        temperature: 0.95,
        response_format: { type: 'json_object' }
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
    const raw = String(data.choices[0].message.content).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(raw);
    dayPlan = { day, plans: sanitizePlans(parsed.plans || parsed), _fb: false };
    save('cote3dDayPlan', dayPlan);
    npcs.forEach(n => { n._taskKey = null; n._curTask = null; });
    showToast(`📋 Day ${day} — the AI has set everyone's plans.`, 3500);
  } catch (e) { console.warn('Day plan failed, using fallback:', e); useFallback(); }
}

// ---------- Social memory (affinity / mood persist across sessions) ----------
let social = load('cote3dSocial', {});
function soc(name) {
  if (!social[name]) social[name] = { affinity: 0, talks: 0, mood: 'neutral', greeted: 0 };
  return social[name];
}
function saveSocial() { save('cote3dSocial', social); }
const MOODS = ['content', 'neutral', 'neutral', 'tired', 'irritated', 'cheerful'];

// ---------- NPCs ----------
const npcs = [];
function makeCharacter(name, persona, cfg) {
  const rig = makeRig(cfg);
  const spotOffset = { x: (Math.random() - 0.5) * 2.6, z: (Math.random() - 0.5) * 2.6 };
  const home = LOC[cfg.home].c;
  const s = findFreeSpot(home[0] + spotOffset.x, home[1] + spotOffset.z, 0.5);
  rig.root.position.set(s.x, 0, s.z); rig.root.rotation.y = Math.PI; scene.add(rig.root);
  const label = makeLabel(name, s.x, 2.05, s.z, 0xffffff, 1.5);
  npcs.push({
    name, persona, cfg, rig, label, home: cfg.home, spots: cfg.spots, spotOffset,
    schedule: cfg.schedule || [], sociability: cfg.sociability ?? 0.3,
    lines: cfg.lines || {}, currentSpot: cfg.home, state: 'idle', path: [], pathI: 0,
    nextDecision: 4 + Math.random() * 8, speed: cfg.speed ?? 2.4,
    escortDest: null, facing: Math.PI,
    anim: { moving: false, phase: 0, talk: false, idleT: Math.random() * 6, blinkT: Math.random() * 4, lookAt: null, run: false },
    storyLock: false, _stuckTime: 0, _skips: 0,
    nextApproach: 25 + Math.random() * 45, nextGreet: 0, nextAmbient: 8 + Math.random() * 20,
    wantsTalk: false, waitUntil: 0, bubble: null, bubbleUntil: 0, chatWith: null
  });
}

makeCharacter('Horikita', `Horikita Suzune — reserved, direct and serious, and quietly determined to reach Class A. She is NOT cold-hearted or hostile: she simply has no patience for nonsense, and she is awkward rather than cruel. A dry, understated warmth shows through — small considerate gestures she would never admit to, faint amusement at his deadpan replies, the occasional unguarded remark she immediately covers up. She is willing to talk to Ayanokouji and secretly does not mind his company; she will even ask his opinion. She grows noticeably gentler and more open as she gets used to him. Speaks precisely and never uses slang, but her bluntness is honesty, not contempt.`,
  {
    hair: 0x15151f, hairStyle: 'long', gender: 'f', skin: 0xf3d0b3, tie: 0x8a2b3a, height: 0.97,
    home: 'library', spots: ['library', 'library', 'library', 'class1d', 'courtyard'],
    schedule: [[8, 'class1d'], [10, 'library'], [12, 'cafeteria'], [13, 'class1d'], [15.6, 'library'], [18, 'dorm']],
    sociability: 0.32, speed: 2.3,
    lines: {
      greet: ['...Ayanokouji-kun.', 'Oh. It\'s you.', 'Did you need something?', 'You\'re here too.'],
      idle: ['This argument is poorly reasoned...', 'Class D. We can still fix that.', 'I suppose a short break is acceptable.', 'It\'s quieter here. That\'s good.'],
      rain: ['I didn\'t bring an umbrella.', 'We should get inside.', 'You\'ll catch a cold standing there.'],
      approach: ['There\'s something I wanted to ask you.', 'Do you have a moment? ...It won\'t take long.', 'I was hoping to talk to you, actually.']
    }
  });
makeCharacter('Kushida', 'Kushida Kikyou — relentlessly cheerful, wants to befriend everyone, very social. Usually in the cafeteria or courtyard. Publicly sweet, with the subtlest hidden edge.',
  {
    hair: 0x22305a, hairStyle: 'medium', gender: 'f', skin: 0xf7d9bd, tie: 0x8a2b3a, height: 0.95,
    home: 'cafeteria', spots: ['cafeteria', 'courtyard', 'class1d', 'cafe'],
    schedule: [[8, 'class1d'], [10, 'courtyard'], [12, 'cafeteria'], [13, 'class1d'], [15.6, 'cafe'], [18, 'dorm']],
    sociability: 0.85, speed: 2.5,
    lines: {
      greet: ['Ayanokouji-kun! Hello!', 'Ah — good morning!', 'Hey hey! Over here!'],
      idle: ['Everyone seems so nice here!', 'I want to learn all 40 names!', 'Isn\'t the campus amazing?'],
      rain: ['Eek, my hair!', 'I hope it stops soon...'],
      approach: ['Ayanokouji-kun, wait up!', 'Can I talk to you for a sec?', 'I was hoping to run into you!']
    }
  });
makeCharacter('Sudou', 'Sudou Ken — red-haired, hot-tempered basketball recruit, athletic, hates studying. Almost always at the gym or sports field. Insecure about being in D-Class.',
  {
    hair: 0x9b2618, hairStyle: 'spiky', gender: 'm', skin: 0xecc39c, tie: 0x2b4a8a, height: 1.06,
    home: 'gym', spots: ['gym', 'gym', 'field', 'cafeteria'],
    schedule: [[8, 'class1d'], [10, 'gym'], [12, 'cafeteria'], [13, 'class1d'], [15.6, 'gym'], [18, 'dorm']],
    sociability: 0.45, speed: 2.95,
    lines: {
      greet: ['Yo.', 'Oh, it\'s you.', 'Sup, Ayanokouji.'],
      idle: ['Tch. Studying\'s a waste of time.', 'I\'m gonna be a pro, just watch.', 'Class D my ass.'],
      rain: ['Can\'t practise in this. Damn it.', 'Rain again? Seriously?'],
      approach: ['Hey — you got a sec?', 'Oi, Ayanokouji!']
    }
  });
makeCharacter('Kouenji', 'Kouenji Rokusuke — blond, narcissistic wealthy heir, calls himself perfect, ignores social rules. Lounges wherever pleases him — his dorm, the café, the courtyard.',
  {
    hair: 0xd9b44a, hairStyle: 'slick', gender: 'm', skin: 0xf1c9a5, tie: 0x2b4a8a, height: 1.05,
    home: 'dorm', spots: ['dorm', 'courtyard', 'cafe', 'store'],
    schedule: [[8, 'courtyard'], [10, 'cafe'], [12, 'cafe'], [13, 'dorm'], [15.6, 'store'], [18, 'dorm']],
    sociability: 0.05, speed: 2.2,
    lines: {
      greet: ['Hmph.', 'Ah — a passerby.'],
      idle: ['Perfect, as always.', 'How dull this place is.', 'Beauty is a responsibility.'],
      rain: ['My hair deserves better than this.'],
      approach: ['You there. Amuse me.']
    }
  });
makeCharacter('Chabashira', 'Chabashira Sae — the D-Class homeroom teacher. Flat, indifferent tone, explains rules once and refuses to elaborate. Hints the school judges everything but never spells it out.',
  {
    hair: 0x2a2a33, hairStyle: 'long', gender: 'f', skin: 0xeccdb0, blazer: 0x3a3f4a, tie: 0x555b66, height: 1.0,
    home: 'hall', spots: ['hall', 'class1d'],
    schedule: [[8, 'class1d'], [10, 'hall'], [12, 'hall'], [13, 'class1d'], [15.6, 'hall'], [18, 'hall']],
    sociability: 0.12, speed: 2.3,
    lines: {
      greet: ['Ayanokouji.', 'Don\'t be late.'],
      idle: ['Read the handbook. It\'s all in there.', 'Your class is... interesting.'],
      rain: ['Get inside before you catch a cold.'],
      approach: ['A word, Ayanokouji.']
    }
  });

// player avatar (shown in cinematic chat)
const playerAvatar = makeRig({ hair: 0x2a2622, hairStyle: 'medium', gender: 'm', skin: 0xf0c9a0, blazer: 0x28304a, tie: 0x2b4a8a });
playerAvatar.root.visible = false; scene.add(playerAvatar.root);
const playerAnim = { moving: false, phase: 0, talk: false, idleT: 0 };

// ---------- NPC navigation (waypoint graph — follows roads, never clips buildings) ----------
function pt(loc) { const [x, z] = LOC[loc].c; return { x, z }; }
function routeTo(npc, dest) {
  const p = npc.rig.root.position;
  const from = LOC[npc.currentSpot]?.node || nearestNode(p.x, p.z);
  const keys = navPath(from, LOC[dest].node);
  const path = keys.map(k => ({ x: NAV_NODES[k][0], z: NAV_NODES[k][1] }));
  // Personal arrival offset so several NPCs don't fight over one point.
  const c = LOC[dest].c;
  path.push(findFreeSpot(c[0] + npc.spotOffset.x, c[1] + npc.spotOffset.z, 0.5));
  npc.path = path; npc.pathI = 0; npc.state = 'moving'; npc.dest = dest; npc._stuckTime = 0; npc._skips = 0;
}
const OUTDOOR = new Set(['field', 'courtyard', 'gate']);
const INDOOR_FALLBACK = { field: 'gym', courtyard: 'cafeteria', gate: 'hall' };
// Where would this person actually be right now? Fixed 24h rhythm: class in the
// morning, cafeteria at lunch, AI-planned tasks after school, dorm at night —
// and nobody loiters outside in the rain.
function chooseSpot(npc) {
  const hour = clockMin / 60;
  const phase = phaseOf(hour);
  let dest = MANDATORY[phase];                        // timetable first, always
  if (!dest) dest = plannedSpot(npc, hour) || pick(npc.spots);
  if (wCur.rain > 0.35 && OUTDOOR.has(dest)) dest = INDOOR_FALLBACK[dest] || 'cafeteria';
  return dest;
}
function planar(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
// Blocked for an NPC = world geometry OR another character standing there.
function npcBlocked(npc, x, z) {
  if (collidesAt(x, z, 0.45)) return true;
  for (const o of npcs) {
    if (o === npc) continue;
    if (planar(x, z, o.rig.root.position.x, o.rig.root.position.z) < 0.85) return true; // room to pass in corridors
  }
  return false;
}
// Free spot that also accounts for other characters standing around.
function freeSpotNear(npc, x, z) {
  if (!npcBlocked(npc, x, z)) return { x, z };
  for (let ring = 1; ring <= 14; ring++) {
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2, d = ring * 0.85;
      const nx = x + Math.cos(ang) * d, nz = z + Math.sin(ang) * d;
      if (!npcBlocked(npc, nx, nz)) return { x: nx, z: nz };
    }
  }
  return { x, z };
}
function stepNPC(npc, tx, tz, dt, isFinal = false, allowSnap = true) {
  const p = npc.rig.root.position;
  // Someone is standing on the destination — pick an adjacent free spot instead of stalling.
  if (isFinal && npcBlocked(npc, tx, tz)) {
    const alt = freeSpotNear(npc, tx, tz);
    tx = alt.x; tz = alt.z;
    if (npc.path[npc.pathI]) { npc.path[npc.pathI].x = tx; npc.path[npc.pathI].z = tz; }
  }
  let dx = tx - p.x, dz = tz - p.z; const dist = Math.hypot(dx, dz);
  if (dist < 0.55) { npc.anim.moving = false; npc._stuckTime = 0; npc._skips = 0; return true; }
  dx /= dist; dz /= dist;
  const step = npc.speed * dt, sx = p.x, sz = p.z;

  // Steer: straight ahead, else fan out to either side, else slide along one axis.
  let done = false;
  for (const ang of [0, 0.45, -0.45, 0.95, -0.95, 1.5, -1.5]) {
    const cs = Math.cos(ang), sn = Math.sin(ang);
    const ax = dx * cs - dz * sn, az = dx * sn + dz * cs;
    const nx = p.x + ax * step, nz = p.z + az * step;
    if (!npcBlocked(npc, nx, nz)) { p.x = nx; p.z = nz; done = true; break; }
  }
  if (!done) {
    if (!npcBlocked(npc, p.x + dx * step, p.z)) p.x += dx * step;
    else if (!npcBlocked(npc, p.x, p.z + dz * step)) p.z += dz * step;
  }

  const moved = Math.hypot(p.x - sx, p.z - sz) > step * 0.2;
  if (moved) { npc._stuckTime = 0; }
  else {
    npc._stuckTime = (npc._stuckTime || 0) + dt;
    if (npc._stuckTime > 1.0) {
      // 1) Most jams are two people in a doorway — let them squeeze past each other
      //    (solid geometry still blocks, so nobody walks through a wall).
      const gx = p.x + dx * step, gz = p.z + dz * step;
      if (!collidesAt(gx, gz, 0.45)) { p.x = gx; p.z = gz; npc._stuckTime = 0; }
      else if (npc._stuckTime > 1.8) {
        // 2) Truly wedged: give up on this waypoint. Only snap onto a fixed path waypoint —
        //    never onto a chase target, or following the player would teleport them across the map.
        npc._stuckTime = 0; npc._skips = (npc._skips || 0) + 1;
        if (allowSnap && npc._skips >= 3) { const f = findFreeSpot(tx, tz, 0.5); p.x = f.x; p.z = f.z; npc._skips = 0; }
        return true;
      }
    }
  }
  npc.facing = Math.atan2(dx, dz);
  npc.anim.moving = moved; if (moved) npc.anim.phase += dt * npc.speed * 2.4;
  return false;
}
// ---------- Social behaviour ----------
const ABORT_TALK = 11;   // seconds an NPC will wait for the player before giving up
function playerDist(npc) { return planar(npc.rig.root.position.x, npc.rig.root.position.z, camera.position.x, camera.position.z); }
function busyUI() { return dialogue.style.display === 'flex' || storyEl.style.display === 'flex' || camMode !== 'free'; }

// Head-turn toward the player when they're close, so nobody stares through you.
function applyLookAt(npc) {
  const p = npc.rig.root.position, d = playerDist(npc);
  if (d < 9) {
    const world = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
    let rel = world - npc.rig.root.rotation.y;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    npc.anim.lookAt = Math.max(-1.1, Math.min(1.1, rel));
    npc.anim.lookPitch = Math.max(-0.35, Math.min(0.35, (EYE - 1.55) / Math.max(1.2, d) - 0.02));
  } else { npc.anim.lookAt = null; npc.anim.lookPitch = 0; }
}

// Ambient chatter + passing greetings — free personality, no API cost.
function ambientLife(npc, elapsed) {
  if (npc.bubbleUntil && elapsed > npc.bubbleUntil && npc.bubble) {
    npc.bubble.material.opacity = Math.max(0, npc.bubble.material.opacity - 0.06);
    if (npc.bubble.material.opacity <= 0) { npc.bubble.visible = false; npc.bubbleUntil = 0; }
  }
  const d = playerDist(npc);
  // greet the player in passing (not a full conversation)
  if (!busyUI() && d < 6.5 && elapsed > npc.nextGreet && !npc.wantsTalk) {
    npc.nextGreet = elapsed + 45 + Math.random() * 60;
    const s = soc(npc.name);
    const warm = s.affinity > 3 ? ['Ayanokouji-kun.', 'Oh, hello again.'] : null;
    say(npc, pick(warm && Math.random() < 0.5 ? warm : (npc.lines.greet || ['...'])), 3000);
    s.greeted++; saveSocial();
    return;
  }
  // idle self-talk / weather remarks
  if (elapsed > npc.nextAmbient) {
    npc.nextAmbient = elapsed + 22 + Math.random() * 40;
    if (d < 26 && !busyUI()) {
      const raining = wCur.rain > 0.4 && npc.lines.rain;
      say(npc, pick(raining && Math.random() < 0.6 ? npc.lines.rain : (npc.lines.idle || ['...'])), 3400);
    }
  }
}

// Two idle classmates standing near each other will turn and chat.
function maybeGroupChat(npc, dt, elapsed) {
  if (npc.state !== 'idle' || npc.wantsTalk || npc.storyLock) { npc.chatWith = null; return; }
  const p = npc.rig.root.position;
  if (npc.chatWith) {
    const o = npc.chatWith, op = o.rig.root.position;
    if (o.state !== 'idle' || planar(p.x, p.z, op.x, op.z) > 6) { npc.chatWith = null; return; }
    npc.facing = Math.atan2(op.x - p.x, op.z - p.z);   // turn to face each other
    npc.anim.talk = true;
    if (elapsed > (npc._chatLine || 0)) {              // trade the occasional line
      npc._chatLine = elapsed + 6 + Math.random() * 8;
      if (playerDist(npc) < 22 && !busyUI()) say(npc, pick(npc.lines.idle || ['...']), 3200);
    }
    return;
  }
  if (Math.random() < dt * 0.25) {
    for (const o of npcs) {
      if (o === npc || o.state !== 'idle' || o.storyLock || o.wantsTalk || o.chatWith) continue;
      if (planar(p.x, p.z, o.rig.root.position.x, o.rig.root.position.z) < 4.5) { npc.chatWith = o; o.chatWith = npc; break; }
    }
  }
}

// Decide whether to walk over and start a conversation with the player.
function maybeApproach(npc, elapsed) {
  if (!canTalk || busyUI() || npc.storyLock || npc.wantsTalk) return false;
  if (npc.state === 'escort' || elapsed < npc.nextApproach) return false;
  if (MANDATORY[phaseOf(clockMin / 60)]) return false;   // never abandon class / lunch / sleep to socialize
  const d = playerDist(npc);
  if (d > 24 || d < 3) return false;
  const s = soc(npc.name);
  const chance = npc.sociability * (1 + Math.min(1, s.affinity / 8)) * 0.55;
  if (Math.random() > chance) { npc.nextApproach = elapsed + 20 + Math.random() * 30; return false; }
  npc.state = 'approach'; npc.wantsTalk = true; npc.waitUntil = elapsed + ABORT_TALK;
  npc.path = []; npc._stuckTime = 0;
  say(npc, pick(npc.lines.approach || ['Hey — got a moment?']), 4200);
  return true;
}

function updateNPC(npc, dt, elapsed) {
  const p = npc.rig.root.position;
  npc.label.position.set(p.x, 2.05, p.z);
  if (npc.bubble) npc.bubble.position.set(p.x, 2.45, p.z);
  npc.anim.idleT += dt;
  // Mouth moves while they're actually speaking; with voices off, gesture through the whole chat.
  npc.anim.talk = npc.speaking === true || (activeNPC === npc && !(synth && ttsOn));
  npc.anim.run = false;
  applyLookAt(npc);
  ambientLife(npc, elapsed);

  if (activeNPC === npc || npc.storyLock === 'talk') {
    npc.anim.moving = false;
    const dx = camera.position.x - p.x, dz = camera.position.z - p.z; npc.facing = Math.atan2(dx, dz);
  } else if (npc.state === 'approach') {
    // Walk to the player and open the conversation on arrival.
    const d = playerDist(npc);
    if (elapsed > npc.waitUntil || busyUI()) {                       // gave up / player busy
      npc.wantsTalk = false; npc.state = 'idle';
      npc.nextApproach = elapsed + 60 + Math.random() * 60;
      npc.nextDecision = elapsed + 4;
      if (!busyUI()) say(npc, '...never mind.', 2200);
    } else if (d < 2.4) {
      npc.anim.moving = false;
      npc.facing = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
      if (!npc._greetShown) { npc._greetShown = true; npc.waitUntil = elapsed + ABORT_TALK; }
      if (elapsed > (npc._openAt || (npc._openAt = elapsed + 1.2))) {  // brief beat, then talk
        npc._greetShown = false; npc._openAt = 0; npc.wantsTalk = false;
        npc.state = 'idle';                                            // leave 'approach' — don't rely on activeNPC
        npc.nextApproach = elapsed + 90 + Math.random() * 90;
        npc.nextDecision = elapsed + 30;
        openDialogue(npc, true);
      }
    } else {
      npc.anim.run = d > 12;
      const ang = Math.atan2(p.x - camera.position.x, p.z - camera.position.z);
      const tx = camera.position.x + Math.sin(ang) * 1.8, tz = camera.position.z + Math.cos(ang) * 1.8;
      const prevSpeed = npc.speed; if (npc.anim.run) npc.speed *= 1.5;
      stepNPC(npc, tx, tz, dt, true, false);    // no snapping onto a moving target
      npc.speed = prevSpeed;
    }
  } else if (npc.state === 'escort') {
    const far = planar(p.x, p.z, camera.position.x, camera.position.z) > 9;
    if (far) { npc.anim.moving = false; npc.facing = Math.atan2(camera.position.x - p.x, camera.position.z - p.z); }
    else { const wp = npc.path[npc.pathI]; if (stepNPC(npc, wp.x, wp.z, dt, npc.pathI === npc.path.length - 1)) { npc.pathI++; if (npc.pathI >= npc.path.length) { npc.currentSpot = npc.escortDest; npc.escortDest = null; npc.state = 'idle'; npc.nextDecision = elapsed + 20 + Math.random() * 10; showToast(`${npc.name} arrived at the ${LOC[npc.currentSpot].label}.`); } } }
  } else if (npc.state === 'moving') {
    if (!MANDATORY[phaseOf(clockMin / 60)] && maybeApproach(npc, elapsed)) { /* interrupted their errand to come say hello */ }
    else {
      const wp = npc.path[npc.pathI];
      if (stepNPC(npc, wp.x, wp.z, dt, npc.pathI === npc.path.length - 1)) {
        npc.pathI++;
        if (npc.pathI >= npc.path.length) {
          npc.currentSpot = npc.dest; npc.state = 'idle';
          npc.nextDecision = elapsed + 4 + Math.random() * 6; npc._skips = 0;
          const must = requiredNow(npc);   // the bell rang while they walked — go where they must
          if (must !== npc.currentSpot) routeTo(npc, must);
        }
      }
    }
  } else { // idle
    npc.anim.moving = false;
    maybeGroupChat(npc, dt, elapsed);
    if (!maybeApproach(npc, elapsed) && !npc.chatWith && !npc.storyLock && elapsed >= npc.nextDecision) {
      const next = chooseSpot(npc);
      if (next !== npc.currentSpot) routeTo(npc, next); else npc.nextDecision = elapsed + 6 + Math.random() * 8;
    }
  }
  npc.rig.root.rotation.y += (npc.facing - npc.rig.root.rotation.y) * Math.min(1, dt * 9);
  animateRig(npc.rig, npc.anim, dt);
}

// ---------- Dynamic weather ----------
const WEATHERS = {
  clear:    { icon: '☀️', name: 'Clear',    top: 0x4f93d1, bot: 0xe9f3fb, fog: 0xcfe4f5, near: 180, far: 480, sun: 1.35, hemi: 1.00, rain: 0, cloud: 0.12, wet: 0.00 },
  cloudy:   { icon: '⛅', name: 'Cloudy',   top: 0x7fa3c4, bot: 0xe4ecf2, fog: 0xd6e0e8, near: 150, far: 430, sun: 0.85, hemi: 0.95, rain: 0, cloud: 0.55, wet: 0.05 },
  overcast: { icon: '☁️', name: 'Overcast', top: 0x8d9aa6, bot: 0xd3d9dd, fog: 0xc9d1d6, near: 110, far: 360, sun: 0.45, hemi: 0.85, rain: 0, cloud: 0.9,  wet: 0.12 },
  rain:     { icon: '🌧️', name: 'Rain',     top: 0x6b7784, bot: 0xb9c2c8, fog: 0xa9b4bb, near: 70,  far: 260, sun: 0.28, hemi: 0.72, rain: 1, cloud: 1.0,  wet: 0.34 },
  storm:    { icon: '⛈️', name: 'Storm',    top: 0x4d5661, bot: 0x929ba3, fog: 0x8b959c, near: 45,  far: 190, sun: 0.18, hemi: 0.6,  rain: 1.7, cloud: 1.0, wet: 0.45 },
  sunset:   { icon: '🌇', name: 'Sunset',   top: 0x3f6ea8, bot: 0xf6c69a, fog: 0xe8b98f, near: 140, far: 420, sun: 1.0,  hemi: 0.9,  rain: 0, cloud: 0.35, wet: 0.02 },
};
const W_ORDER = ['clear', 'cloudy', 'overcast', 'rain', 'storm', 'sunset'];
const wCur = { ...WEATHERS.clear, top: new THREE.Color(0x4f93d1), bot: new THREE.Color(0xe9f3fb), fog: new THREE.Color(0xcfe4f5) };
let wTargetKey = 'clear', wTarget = WEATHERS.clear, wNextChange = 50 + Math.random() * 50, flash = 0;

const weatherChip = document.createElement('div');
weatherChip.style.cssText = 'background:rgba(15,17,24,.86);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:8px 14px;font-size:13px;backdrop-filter:blur(8px);pointer-events:auto;cursor:pointer;';
weatherChip.title = 'Click (or press V) to change the weather';
$('topright').appendChild(weatherChip);

// Rain streaks (LineSegments follow the camera)
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

// Drifting clouds
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

// reusable temporaries so the per-frame lerp allocates nothing
const _tTop = new THREE.Color(), _tBot = new THREE.Color(), _tFog = new THREE.Color();

function updateWeather(dt, elapsed) {
  if (elapsed > wNextChange) {   // pick a plausible next sky
    wNextChange = elapsed + 60 + Math.random() * 70;
    const choices = { clear: ['cloudy', 'sunset'], cloudy: ['clear', 'overcast'], overcast: ['rain', 'cloudy'], rain: ['storm', 'overcast'], storm: ['rain', 'overcast'], sunset: ['clear', 'cloudy'] }[wTargetKey];
    setWeather(choices[Math.floor(Math.random() * choices.length)]);
  }
  const k = Math.min(1, dt * 0.35);   // slow, smooth transition
  wCur.top.lerp(_tTop.setHex(wTarget.top), k);
  wCur.bot.lerp(_tBot.setHex(wTarget.bot), k);
  wCur.fog.lerp(_tFog.setHex(wTarget.fog), k);
  for (const p of ['near', 'far', 'sun', 'hemi', 'rain', 'cloud', 'wet']) wCur[p] += (wTarget[p] - wCur[p]) * k;

  skyMat.uniforms.topC.value.copy(wCur.top);
  skyMat.uniforms.botC.value.copy(wCur.bot);
  scene.fog.color.copy(wCur.fog); scene.fog.near = wCur.near; scene.fog.far = wCur.far;

  // lightning during storms
  if (wTargetKey === 'storm' && Math.random() < dt * 0.35) flash = 1;
  flash = Math.max(0, flash - dt * 3.5);
  sun.intensity = wCur.sun + flash * 1.8;
  hemi.intensity = wCur.hemi + flash * 1.2;

  cloudMat.opacity = wCur.cloud * 0.85;
  clouds.position.x = ((elapsed * 1.6) % 620) - 310;

  // rain: recycle streaks, follow the player
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
  // wet ground darkening
  for (const s of wetSurfaces) s.mat.color.copy(s.base).multiplyScalar(1 - wCur.wet * 0.42);
}

// ---------- Controls ----------
const keys = {};
let yaw = Math.PI, pitch = -0.05, locked = false, dragging = false;
const LOOK = 0.0025;
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyE' && nearNPC && dialogue.style.display !== 'flex' && storyEl.style.display !== 'flex') openDialogue(nearNPC);
  if (e.code === 'KeyV' && document.activeElement !== dlgInput) cycleWeather();
  if (e.code === 'KeyM' && document.activeElement !== dlgInput) toggleTTS();
});
addEventListener('keyup', e => keys[e.code] = false);
const cv = renderer.domElement; cv.style.cursor = 'grab';
cv.addEventListener('mousedown', e => { if (camMode !== 'free' || e.button !== 0) return; dragging = true; cv.style.cursor = 'grabbing'; if (!locked && cv.requestPointerLock) { try { cv.requestPointerLock(); } catch {} } });
addEventListener('mouseup', () => { dragging = false; if (!locked) cv.style.cursor = 'grab'; });
cv.addEventListener('mouseleave', () => dragging = false);
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === cv; cv.style.cursor = locked ? 'none' : 'grab'; });
document.addEventListener('pointerlockerror', () => locked = false);
function applyLook(dx, dy) { yaw -= dx * LOOK; pitch = Math.max(-1.2, Math.min(1.2, pitch - dy * LOOK)); }
document.addEventListener('mousemove', e => { if (camMode === 'free' && (locked || dragging)) applyLook(e.movementX || 0, e.movementY || 0); });
cv.addEventListener('touchmove', e => { if (camMode !== 'free') return; const t = e.touches[0]; if (cv._lt) applyLook(t.clientX - cv._lt.x, t.clientY - cv._lt.y); cv._lt = { x: t.clientX, y: t.clientY }; e.preventDefault(); }, { passive: false });
cv.addEventListener('touchend', () => cv._lt = null);

// ---------- Player movement + collision ----------
const R = 0.5;
function playerBlocked(x, z) {
  if (collidesAt(x, z, R)) return true;
  for (const n of npcs) { if (n === activeNPC) continue; if (planar(x, z, n.rig.root.position.x, n.rig.root.position.z) < 0.8) return true; }
  return false;
}
function tryMove(nx, nz) { if (!playerBlocked(nx, camera.position.z)) camera.position.x = nx; if (!playerBlocked(camera.position.x, nz)) camera.position.z = nz; }

// ---------- Cinematic chat camera ----------
const camTargetPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const camLookTarget = new THREE.Vector3();
let savedYaw = 0, savedPitch = 0;
const savedPos = new THREE.Vector3();
function beginTalkCam(npc) {
  savedYaw = yaw; savedPitch = pitch; savedPos.copy(camera.position);
  // place player avatar where the camera stood
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
  const side = new THREE.Vector3(-dir.z, 0, dir.x); // perpendicular
  camTargetPos.copy(mid).add(side.multiplyScalar(4.2)).add(new THREE.Vector3(0, 1.1, 0)).addScaledVector(dir, -0.5);
  camLookTarget.set(b.x, 1.7, b.z);
}
function endTalkCam() { camMode = 'return'; }

// ---------- Proximity + labels ----------
let nearNPC = null;
function updateProximity() {
  let closest = null, best = 3.6;
  for (const n of npcs) { const d = planar(camera.position.x, camera.position.z, n.rig.root.position.x, n.rig.root.position.z); if (d < best) { best = d; closest = n; } }
  nearNPC = closest;
  const busy = dialogue.style.display === 'flex' || storyEl.style.display === 'flex' || camMode !== 'free';
  const incoming = npcs.find(n => n.wantsTalk);
  if (incoming && !busy) { promptEl.style.display = 'block'; promptEl.innerHTML = `<b>${incoming.name}</b> wants to talk to you…`; }
  else if (nearNPC && !busy) { promptEl.style.display = 'block'; promptEl.innerHTML = `Press <b>E</b> to talk to <b>${nearNPC.name}</b>`; }
  else promptEl.style.display = 'none';
}
function updateSceneLabel() {
  let label = 'Campus Grounds', best = 16;
  for (const key of Object.keys(LOC)) { const [x, z] = LOC[key].c; const d = planar(camera.position.x, camera.position.z, x, z); if (d < best) { best = d; label = LOC[key].label; } }
  sceneLabel.textContent = '📍 ' + label;
}

// ---------- Render loop ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

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

  for (const n of npcs) updateNPC(n, dt, elapsed);
  updateWeather(dt, elapsed);
  const prevMin = clockMin;
  clockMin = (clockMin + dt * MIN_PER_SEC) % (24 * 60);
  if (clockMin < prevMin) { gameDay++; save('cote3dDay', gameDay); planDay(gameDay); }   // a new in-game day begins
  const ph = phaseOf(clockMin / 60);
  if (ph !== lastPhaseKey) {   // timetable period changed — everyone re-evaluates at once and heads where they must be
    lastPhaseKey = ph;
    const el = clock.elapsedTime;
    for (const n of npcs) {
      n.chatWith = null;                           // the bell ends all idle chatter
      if (n.storyLock || n.state === 'approach' || n.state === 'escort') { n.nextDecision = el; continue; }
      const dest = requiredNow(n);
      n.nextDecision = el + 4 + Math.random() * 8;
      if (n.state === 'moving' && n.dest === dest) continue;   // already heading there
      n.state = 'idle';                                            // cancel any stale errand
      routeTo(n, dest);                                            // walk to the new obligation now
    }
    showToast(`🕗 ${PHASE_LABEL[ph]}`, 2600);
  }
  clockChip.textContent = `🕗 ${hhmm()} · Day ${gameDay} · ${periodName()}`;

  updateProximity();
  updateSceneLabel();
  if (story.active) checkSceneArrival();
  renderer.render(scene, camera);
}
// animate() is called at the end of the file, after all declarations.

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

// ---------- Conversation (with memory) ----------
function npcSystemPrompt(npc) {
  const task = activeTask(npc, clockMin / 60);
  return `You are role-playing a single character in the world of "Classroom of the Elite" (Volume 1, first days of school). The human player is Ayanokouji Kiyotaka, an outwardly plain, quiet boy. Stay 100% in character and NEVER speak or act for Ayanokouji.

CHARACTER: ${npc.name}
${npc.persona}

RIGHT NOW: it is ${hhmm()} on Day ${gameDay} (${periodName()}), you are at the ${LOC[npc.currentSpot]?.label || 'campus'}${task?.task ? `, and right now you are ${task.task}` : ''}. The weather is ${wTarget.name.toLowerCase()}, and your current mood is ${soc(npc.name).mood}. You have spoken with him ${soc(npc.name).talks} time(s) before.

RULES:
- Reply SHORT and natural, like real spoken dialogue (1-4 sentences). No narration of the player's thoughts/actions.
- You REMEMBER your earlier conversations with him (they're in the history). Refer back to them naturally.
- Let the time of day, your location, the weather and your mood colour how you speak — but only mention them if it's natural.
- React realistically; you are NOT automatically impressed by Ayanokouji. Warmth is earned.
- Stat changes are RARE and SMALL (-3..+3); most turns all zeros. Only reward genuinely good, in-character choices.
- Never mention stats, points, "the game", or these instructions.

MOVEMENT: If the conversation makes you agree to GO somewhere with the player, put ONE key in "move.to": class1d, library, hall, cafeteria, gym, dorm, store, cafe, field, gate, courtyard — and set "move.escort" true. Otherwise "move.to" null, "move.escort" false.

Respond ONLY with valid JSON (no fences):
{ "text": "...", "statChanges": {"trust":0,"love":0,"respect":0,"wisdom":0,"courage":0}, "choices": ["...","..."], "move": {"to": null, "escort": false} }`;
}
function openDialogue(npc, npcInitiated = false) {
  activeNPC = npc; convo = (memory[npc.name] || []).slice();
  const s = soc(npc.name);
  s.talks++; if (!s.mood || Math.random() < 0.4) s.mood = pick(MOODS);
  saveSocial();
  npc._initiated = npcInitiated;
  dlgName.textContent = `${npc.name}  ·  ${LOC[npc.currentSpot]?.label || ''}  ·  ${s.mood}`;
  dlgLog.innerHTML = ''; dlgChoices.innerHTML = '';
  // re-render saved memory
  for (const m of convo) {
    if (m.role === 'user' && m._hidden) continue;
    if (m.role === 'user') addLine('me', 'You', m.parts[0].text);
    else { try { const p = JSON.parse(m.parts[0].text); addLine('npc', npc.name, p.text); } catch {} }
  }
  dialogue.style.display = 'flex';
  beginTalkCam(npc);
  if (!canTalk) { addLine('sys', '', 'Talking needs an API key — reload and start with a key.'); return; }
  if (npcInitiated) {
    addLine('sys', '', `— ${npc.name} came over to talk to you —`);
    sendToNPC(`[YOU walked over to Ayanokouji and started this conversation yourself, because you wanted to speak with him. Open with what you came to say, in character.${s.talks > 1 ? ' You have talked before.' : ''}]`, true);
  } else if (convo.length === 0) sendToNPC('[The player, Ayanokouji, walks up to you. Greet or react in character.]', true);
  else { addLine('sys', '', `— you approach ${npc.name} again —`); sendToNPC('[Ayanokouji walks up to you again. React in character, remembering your earlier talks.]', true); }
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
    if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
    const raw = data.choices[0].message.content;
    convo.push({ role: 'model', parts: [{ text: raw }] });
    memory[npc.name] = convo; save('cote3dConvos', memory);
    const parsed = JSON.parse(raw);
    const chips = Object.entries(parsed.statChanges || {}).filter(([k, v]) => k in stats && v !== 0).map(([k, v]) => `<span class="chip ${v > 0 ? 'up' : 'down'}">${STAT_ICONS[k]} ${v > 0 ? '+' : ''}${v}</span>`).join('');
    addLine('npc', npc.name, parsed.text || '…', chips ? `<div class="chips">${chips}</div>` : '');
    speakAs(npc.name, parsed.text, 2, npc);          // voice + lip-sync for the spoken reply
    applyStats(parsed.statChanges);
    // Conversations that land well make them more likely to seek you out next time.
    const delta = Object.values(parsed.statChanges || {}).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    const sc = soc(npc.name); sc.affinity = Math.max(-10, Math.min(20, sc.affinity + (delta > 0 ? delta : delta < 0 ? delta : 0.3)));
    saveSocial();
    if (npc.bubble) { npc.bubble.visible = false; npc.bubbleUntil = 0; }
    renderChoices(parsed.choices);
    const dest = parsed.move && parsed.move.to ? resolveLoc(parsed.move.to) : null;
    if (dest && dest !== npc.currentSpot) startEscort(npc, dest, parsed.move.escort !== false);
  } catch (err) { console.error(err); addLine('sys', '', `⚠️ ${err.message || 'Could not reach the AI.'}`); }
  finally { dlgThinking.style.display = 'none'; dlgInput.disabled = false; dlgInput.focus(); }
}
function startEscort(npc, dest, escort) {
  routeTo(npc, dest); npc.escortDest = dest; npc.state = escort ? 'escort' : 'moving';
  addLine('sys', '', `→ ${npc.name} heads for the ${LOC[dest].label}.`);
  showToast(escort ? `${npc.name} is heading to the ${LOC[dest].label} — follow!` : `${npc.name} left for the ${LOC[dest].label}.`, 6000);
  setTimeout(closeDialogue, 1600);
}
function submit(text) { const t = (text ?? dlgInput.value).trim(); if (!t || !canTalk) return; dlgInput.value = ''; sendToNPC(t); }
function closeDialogue() {
  dialogue.style.display = 'none';
  stopSpeech();
  const npc = activeNPC; activeNPC = null;
  if (npc) {
    npc.nextDecision = clock.elapsedTime + 25;        // linger after a chat instead of wandering off
    npc.wantsTalk = false; npc._greetShown = false; npc._openAt = 0;
    if (npc.state === 'approach') npc.state = 'idle';
    npc.nextApproach = clock.elapsedTime + 100 + Math.random() * 90;
    npc.nextGreet = clock.elapsedTime + 40;
  }
  endTalkCam();
}
$('dlg-send').onclick = () => submit();
dlgInput.addEventListener('keypress', e => { if (e.key === 'Enter') submit(); });
$('dlg-close').onclick = closeDialogue;
addEventListener('keydown', e => { if (e.code === 'Escape' && dialogue.style.display === 'flex') closeDialogue(); });
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

// ---------- Guided Chapter 1 story ----------
const SCENES = [
  { id: 'gate', title: 'Arrival', loc: 'gate', objective: 'Walk to the Front Gate where the school bus arrives.',
    prompt: 'Scene 1 — the first morning. Ayanokouji has just arrived at the front gate by bus. Set the scene briefly and note the imposing campus. 2-3 sentences.' },
  { id: 'hall', title: 'Entrance Ceremony', loc: 'hall', objective: 'Enter the Main Hall for the entrance ceremony.',
    prompt: 'Scene 2 — the entrance ceremony in the Main Hall. Briefly describe the ceremony and that Ayanokouji has been sorted into Class 1-D.' },
  { id: 'homeroom', title: 'Homeroom & the Points', loc: 'class1d', objective: 'Go to Class 1-D for homeroom with Chabashira-sensei.',
    prompt: 'Scene 3 — homeroom in Class 1-D. Chabashira-sensei explains the S-System: 100,000 private points on each student\'s card monthly, usable like money anywhere on campus, and that points reflect merit. Classmates celebrate. Speak partly as Chabashira.' },
  { id: 'intro', title: 'Introductions', loc: 'class1d', objective: 'Stay in Class 1-D as classmates introduce themselves.',
    prompt: 'Scene 4 — self-introductions in Class 1-D. Hirata organizes it; Kushida sparkles; Sudou is blunt; Kouenji admires himself. End by turning to Ayanokouji.' },
  { id: 'after', title: 'After School', loc: 'courtyard', objective: 'Head to the courtyard after class. (Try talking to Horikita.)',
    prompt: 'Scene 5 — after school in the courtyard. Reflect on the strange rules and that Horikita, the girl from the bus/next seat, is worth watching. Suggest talking to her.' },
  { id: 'weeks', title: 'The First Weeks', loc: 'cafeteria', objective: 'Explore freely — lunches, the gym, the shops. Skip ahead when ready.',
    prompt: 'Scene 6 — the first weeks pass. Classmates skip class, sleep, and burn points on luxuries, sure that everything is fine. Foreshadow lightly that upperclassmen sneer at D-Class.' },
  { id: 'may1', title: 'May 1st', loc: 'class1d', objective: 'Return to Class 1-D on May 1st for the monthly points.',
    prompt: 'Scene 7 — May 1st in Class 1-D. Students tap their cards: ZERO points. Chabashira, unmoved, reveals the class was judged on its April behavior — tardiness, chatter, skipped classes all counted. Panic. End the chapter on this cliffhanger.' },
];
function storySysPrompt() {
  return `You are the Narrator/Game Master of "Classroom of the Elite" Volume 1, Chapter 1. Narrate in Ayanokouji's dry, detached first-person past tense. Keep each beat SHORT (60-130 words), concrete, understated — no melodrama. You may voice other characters briefly in-line. Never mention stats or "the game".
Respond ONLY with valid JSON (no fences): { "speaker": "Narrator or a character name", "text": "the beat" }`;
}
function currentScene() { return SCENES[story.i]; }
function updateObjective() {
  const sc = currentScene();
  if (story.active && sc) { objectiveEl.style.display = 'block'; $('ov-title').textContent = `Ch.1 · ${sc.title}`; ovText.textContent = sc.objective; }
  else objectiveEl.style.display = 'none';
}
function positionForScene(sc) {
  // Gather relevant classmates for classroom/hall beats.
  const gather = (loc, names) => {
    for (const n of npcs) if (names.includes(n.name)) {
      const [x, z] = LOC[loc].c;
      const s = findFreeSpot(x + (Math.random() - .5) * 7, z + (Math.random() - .5) * 7, 0.5); // never inside furniture
      n.rig.root.position.set(s.x, 0, s.z);
      n.currentSpot = loc; n.state = 'idle'; n.storyLock = true; n.path = []; n._stuckTime = 0;
    }
  };
  // Release everyone first — and give them a fresh decision time so they don't freeze forever.
  npcs.forEach(n => { n.storyLock = false; n.nextDecision = clock.elapsedTime + 6 + Math.random() * 10; });
  if (sc.id === 'homeroom' || sc.id === 'intro' || sc.id === 'may1') gather('class1d', ['Horikita', 'Kushida', 'Sudou', 'Kouenji', 'Chabashira']);
  else if (sc.id === 'hall') gather('hall', ['Chabashira', 'Horikita', 'Kushida']);
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
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: storySysPrompt() }, ...toChatMessages(storyConvo.slice(-16))], temperature: 0.85, response_format: { type: 'json_object' } })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
    const raw = data.choices[0].message.content; storyConvo.push({ role: 'model', parts: [{ text: raw }] });
    save('cote3dStoryConvo', storyConvo);
    const p = JSON.parse(raw); storySpeaker.textContent = p.speaker || 'Narrator'; storyText.textContent = p.text || '';
    speakAs(VOICE_STYLE[p.speaker] ? p.speaker : 'Narrator', p.text, 2);
  } catch (e) { storyText.textContent = '⚠️ ' + (e.message || 'Narration failed.'); }
  finally { storyThinking.style.display = 'none'; }
}
function enterScene(i) {
  story.i = Math.max(0, Math.min(SCENES.length - 1, i)); story.active = true; save('cote3dStory', story);
  const sc = currentScene(); positionForScene(sc); updateObjective(); narrateScene(false);
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

// ---------- Start / reset ----------
function begin(mode) {
  const k = keyInput.value.trim();
  if (mode !== 'explore') { if (k) { apiKey = k; localStorage.setItem('naraApiKey', apiKey); } canTalk = !!apiKey; }
  else canTalk = false;
  if (canTalk && dayPlan && dayPlan._fb) planDay(gameDay);   // upgrade the fallback plan with a real AI one
  overlay.style.display = 'none';
  if (cv.requestPointerLock) { try { cv.requestPointerLock(); } catch {} }
  if (mode === 'story') { camera.position.set(0, EYE, 100); yaw = Math.PI; enterScene(story.i >= 0 ? story.i : 0); }
  else { updateObjective(); }
}
$('story-btn').onclick = () => begin('story');
$('enter-btn').onclick = () => begin('free');
$('explore-btn').onclick = () => begin('explore');
$('reset-btn').onclick = () => {
  if (!confirm('Erase all progress — conversations, story, and stats?')) return;
  ['cote3dStats', 'cote3dConvos', 'cote3dStory', 'cote3dStoryConvo', 'cote3dSocial', 'cote3dDay', 'cote3dDayPlan'].forEach(k => localStorage.removeItem(k));
  location.reload();
};
updateObjective();
if (!dayPlan || dayPlan.day !== gameDay) planDay(gameDay);   // plan today at boot (AI if a key exists, else fallback)
animate();
