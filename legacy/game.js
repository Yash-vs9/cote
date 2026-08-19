// =====================================================
// Classroom of the Elite — MERGED game
// The big realistic campus engine (engine.js) + the living
// world of NPCs: animated classmates who roam, greet, walk
// over to talk, hold AI conversations (with memory & voices),
// under dynamic weather. Buildings still open their WebGL scenes.
// =====================================================
import {
  THREE, scene, camera, player, EYE, blocked, addBox, colliders,
  buildings, WGL, showToast, sun, hemi, skyMat, onFrame, setInteractHook, setFrozen, start
} from './engine.js';

// ---------- config / persisted ----------
const MODEL = 'gemini-3.1-flash-lite';
const BASE_STATS = { trust: 50, love: 10, respect: 50, wisdom: 70, courage: 40 };
const STAT_ICONS = { trust: '🤝', love: '❤️', respect: '🏅', wisdom: '🧠', courage: '💪' };
const STAT_COLORS = { trust: '#10b981', love: '#ec4899', respect: '#f59e0b', wisdom: '#8b5cf6', courage: '#ef4444' };
const MAX_MEMORY_TURNS = 24;
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

let apiKey = localStorage.getItem('geminiApiKey') || '';
let canTalk = false;
let stats = load('cote3dStats', { ...BASE_STATS });
let memory = load('cote3dConvos', {});
let social = load('cote3dSocial', {});
let activeNPC = null, convo = [];

const $ = id => document.getElementById(id);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const planar = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
function soc(name) { if (!social[name]) social[name] = { affinity: 0, talks: 0, mood: 'neutral' }; return social[name]; }
const MOODS = ['content', 'neutral', 'neutral', 'tired', 'irritated', 'cheerful'];

// ---------- material / geometry helpers (PBR, shared with engine look) ----------
const matCache = new Map();
function toonMat(color) { if (!matCache.has(color)) matCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.02 })); return matCache.get(color); }
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x14161d, side: THREE.BackSide });
const boxCache = new Map();
function geoBox(w, h, d) { const k = `${w},${h},${d}`; if (!boxCache.has(k)) boxCache.set(k, new THREE.BoxGeometry(w, h, d)); return boxCache.get(k); }
const capCache = new Map(), cylCache = new Map(), sphCache = new Map();
function geoCap(r, l) { const k = `${r},${l}`; if (!capCache.has(k)) capCache.set(k, new THREE.CapsuleGeometry(r, l, 4, 10)); return capCache.get(k); }
function geoCyl(rt, rb, h) { const k = `${rt},${rb},${h}`; if (!cylCache.has(k)) cylCache.set(k, new THREE.CylinderGeometry(rt, rb, h, 14)); return cylCache.get(k); }
function geoSph(r) { const k = `${r}`; if (!sphCache.has(k)) sphCache.set(k, new THREE.SphereGeometry(r, 18, 14)); return sphCache.get(k); }

// ---------- articulated rig (ported from game3d) ----------
function addPart(parent, geo, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(geo, toonMat(color));
  m.position.set(x, y, z); m.castShadow = !opts.noShadow;
  if (opts.scale) m.scale.set(...opts.scale);
  if (opts.rot) m.rotation.set(...opts.rot);
  parent.add(m);
  if (opts.outline) { const o = new THREE.Mesh(geo, outlineMat); o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.copy(m.scale).multiplyScalar(1.06); parent.add(o); }
  return m;
}
function segment(parent, jx, jy, jz, r, len, color) {
  const pivot = new THREE.Group(); pivot.position.set(jx, jy, jz); parent.add(pivot);
  addPart(pivot, geoCap(r, len), color, 0, -len / 2, 0, { outline: true });
  return pivot;
}
function buildFace(head, cfg) {
  const skin = cfg.skin ?? 0xf1c9a5, eyes = [];
  for (const ex of [-0.058, 0.058]) {
    const g = new THREE.Group(); g.position.set(ex, 0.012, 0.098); head.add(g);
    addPart(g, geoSph(0.032), 0xfbfbfd, 0, 0, 0, { noShadow: true, scale: [1, 1.12, 0.5] });
    addPart(g, geoSph(0.019), cfg.eyes ?? 0x3b2f2a, 0, 0, 0.016, { noShadow: true, scale: [1, 1.1, 0.6] });
    addPart(g, geoSph(0.009), 0x120f14, 0, 0, 0.026, { noShadow: true });
    addPart(g, geoSph(0.006), 0xffffff, 0.011, 0.014, 0.03, { noShadow: true });
    eyes.push(g);
    addPart(head, geoBox(0.052, 0.011, 0.014), cfg.hair, ex, 0.062, 0.104, { noShadow: true, rot: [0, 0, ex > 0 ? -0.14 : 0.14] });
  }
  addPart(head, geoCap(0.016, 0.03), skin, 0, -0.028, 0.113, { noShadow: true, rot: [0.3, 0, 0] });
  const mouth = addPart(head, geoBox(0.05, 0.014, 0.012), 0xb4685f, 0, -0.088, 0.108, { noShadow: true });
  for (const ex of [-0.125, 0.125]) addPart(head, geoSph(0.028), skin, ex, -0.02, 0.01, { noShadow: true, scale: [0.6, 1, 0.8] });
  return { eyes, mouth };
}
function buildHair(head, cfg) {
  const c = cfg.hair, S = cfg.hairStyle;
  addPart(head, geoSph(0.132), c, 0, 0.012, -0.008, { scale: [1.06, 1.0, 1.06] });
  addPart(head, geoBox(0.23, 0.055, 0.075), c, 0, 0.088, 0.085, { rot: [0.16, 0, 0] });
  if (S === 'long') {
    addPart(head, geoBox(0.235, 0.44, 0.1), c, 0, -0.19, -0.085);
    for (const ex of [-0.115, 0.115]) addPart(head, geoBox(0.06, 0.3, 0.075), c, ex, -0.11, 0.045);
  } else if (S === 'medium') {
    for (const ex of [-0.125, 0.125]) addPart(head, geoBox(0.062, 0.22, 0.16), c, ex, -0.055, 0.02);
    addPart(head, geoBox(0.225, 0.16, 0.1), c, 0, -0.075, -0.08);
    for (const ex of [-0.15, 0.15]) addPart(head, geoSph(0.05), c, ex, -0.16, -0.02, { scale: [0.8, 1.3, 0.8] });
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
  const female = cfg.gender === 'f', lower = cfg.lower ?? (female ? 0x2f3550 : 0x2b2f3a), scale = cfg.height ?? 1;
  const root = new THREE.Group();
  const body = new THREE.Group(); body.scale.setScalar(scale); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.92; body.add(hips);
  addPart(hips, geoCyl(0.145, 0.125, 0.16), lower, 0, -0.05, 0, { outline: true, scale: [1, 1, 0.72] });
  const torso = new THREE.Group(); hips.add(torso);
  addPart(torso, geoCyl(0.175, 0.142, 0.5), blazer, 0, 0.25, 0, { outline: true, scale: [1, 1, 0.66] });
  addPart(torso, geoBox(0.15, 0.32, 0.12), 0xf7f5ef, 0, 0.33, 0.093, { noShadow: true });
  addPart(torso, geoBox(0.052, 0.2, 0.02), cfg.tie ?? 0x9b2d2d, 0, 0.3, 0.152, { noShadow: true });
  addPart(torso, geoBox(0.2, 0.05, 0.07), 0xf7f5ef, 0, 0.455, 0.088, { noShadow: true, rot: [0.25, 0, 0] });
  for (const sx of [-0.055, 0.055]) addPart(torso, geoBox(0.075, 0.3, 0.03), blazer, sx, 0.31, 0.115, { noShadow: true, rot: [0, 0, sx > 0 ? 0.07 : -0.07] });
  addPart(torso, geoCyl(0.115, 0.13, 0.1), blazer, 0, 0.5, 0, { noShadow: true, scale: [1, 1, 0.7] });
  addPart(torso, geoCyl(0.045, 0.05, 0.075), skin, 0, 0.545, 0, { noShadow: true });
  const head = new THREE.Group(); head.position.y = 0.7; torso.add(head);
  addPart(head, geoSph(0.118), skin, 0, 0, 0, { outline: true, scale: [0.93, 1.16, 1.0] });
  addPart(head, geoBox(0.1, 0.06, 0.05), skin, 0, -0.1, 0.062, { noShadow: true });
  const face = buildFace(head, cfg); buildHair(head, cfg);
  const arms = {};
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'R' : 'L';
    const sh = segment(torso, side * 0.185, 0.475, 0, 0.052, 0.27, blazer);
    const elb = segment(sh, 0, -0.27, 0, 0.045, 0.25, cfg.sleeve ?? blazer);
    addPart(elb, geoSph(0.048), skin, 0, -0.27, 0, { noShadow: true, scale: [1, 0.85, 0.8] });
    arms['arm' + key] = sh; arms['elbow' + key] = elb;
  }
  const legs = {};
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'R' : 'L';
    const hip = segment(hips, side * 0.082, -0.06, 0, 0.078, 0.4, female ? skin : lower);
    const knee = segment(hip, 0, -0.4, 0, 0.062, 0.38, female ? skin : lower);
    if (female) addPart(knee, geoCap(0.066, 0.16), 0x2b2f3a, 0, -0.3, 0, { noShadow: true });
    const foot = addPart(knee, geoBox(0.088, 0.055, 0.19), 0x24262c, 0, -0.4, 0.038, { noShadow: true });
    legs['leg' + key] = hip; legs['knee' + key] = knee; legs['foot' + key] = foot;
  }
  if (female) addPart(hips, geoCyl(0.15, 0.245, 0.24), lower, 0, -0.16, 0, { outline: true, scale: [1, 1, 0.8] });
  return { root, body, hips, torso, head, face, ...arms, ...legs, height: 1.74 * scale };
}
function animateRig(rig, a, dt) {
  a.blinkT = (a.blinkT ?? 2) - dt;
  if (a.blinkT < 0) a.blinkT = 2.4 + Math.random() * 3.5;
  const blink = a.blinkT < 0.13 ? Math.max(0.08, Math.abs(a.blinkT - 0.065) / 0.065) : 1;
  for (const e of rig.face.eyes) e.scale.y = blink;
  const damp = Math.min(1, dt * 9);
  const lerpTo = (o, ax, t) => { o.rotation[ax] += (t - o.rotation[ax]) * damp; };
  if (a.moving) {
    const p = a.phase, s = Math.sin(p), c = Math.cos(p), stride = a.run ? 1.25 : 1;
    rig.legL.rotation.x = s * 0.5 * stride; rig.legR.rotation.x = -s * 0.5 * stride;
    rig.kneeL.rotation.x = Math.max(0, -Math.sin(p + 0.7)) * 0.95 * stride;
    rig.kneeR.rotation.x = Math.max(0, -Math.sin(p + 0.7 + Math.PI)) * 0.95 * stride;
    rig.footL.rotation.x = -s * 0.18; rig.footR.rotation.x = s * 0.18;
    rig.armL.rotation.x = -s * 0.42 * stride; rig.armR.rotation.x = s * 0.42 * stride;
    rig.armL.rotation.z = 0.06; rig.armR.rotation.z = -0.06;
    rig.elbowL.rotation.x = -0.3 - Math.max(0, -s) * 0.4; rig.elbowR.rotation.x = -0.3 - Math.max(0, s) * 0.4;
    rig.hips.position.y = 0.92 + Math.abs(Math.sin(p * 2)) * 0.026;
    rig.hips.rotation.y = s * 0.09; rig.torso.rotation.y = -s * 0.07; rig.torso.rotation.z = c * 0.02; rig.body.rotation.z = s * 0.015;
  } else {
    for (const j of ['legL', 'legR', 'kneeL', 'kneeR', 'armL', 'armR', 'footL', 'footR']) lerpTo(rig[j], 'x', 0);
    lerpTo(rig.elbowL, 'x', -0.16); lerpTo(rig.elbowR, 'x', -0.16);
    lerpTo(rig.torso, 'y', 0); lerpTo(rig.hips, 'y', 0);
    rig.hips.position.y += (0.92 + Math.sin(a.idleT * 1.5) * 0.008 - rig.hips.position.y) * damp;
    const shift = Math.sin(a.idleT * 0.42);
    rig.hips.rotation.z += (shift * 0.035 - rig.hips.rotation.z) * damp;
    rig.torso.rotation.z += (-shift * 0.025 - rig.torso.rotation.z) * damp;
    rig.armL.rotation.z += (0.08 + shift * 0.02 - rig.armL.rotation.z) * damp;
    rig.armR.rotation.z += (-0.08 + shift * 0.02 - rig.armR.rotation.z) * damp;
    rig.body.rotation.z += (0 - rig.body.rotation.z) * damp;
    if (a.talk) {
      const g = Math.sin(a.idleT * 3.1);
      rig.armR.rotation.x += (-0.45 - g * 0.22 - rig.armR.rotation.x) * damp;
      rig.elbowR.rotation.x += (-0.85 + g * 0.25 - rig.elbowR.rotation.x) * damp;
      rig.face.mouth.scale.y = 1 + Math.abs(Math.sin(a.idleT * 9)) * 2.2;
      rig.torso.rotation.y += (g * 0.05 - rig.torso.rotation.y) * damp;
    } else rig.face.mouth.scale.y += (1 - rig.face.mouth.scale.y) * damp;
  }
  const wantY = a.lookAt ?? Math.sin(a.idleT * 0.5) * 0.22, wantX = a.lookPitch ?? 0;
  rig.head.rotation.y += (Math.max(-1.1, Math.min(1.1, wantY)) - rig.head.rotation.y) * Math.min(1, dt * 5);
  rig.head.rotation.x += (Math.max(-0.5, Math.min(0.5, wantX)) - rig.head.rotation.x) * Math.min(1, dt * 5);
}

// ---------- name label ----------
function makeLabel(text, x, y, z) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(15,17,24,.8)'; g.beginPath(); g.roundRect(4, 12, 248, 40, 14); g.fill();
  g.font = 'bold 30px Segoe UI'; g.fillStyle = '#ffe9c7'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: true }));
  s.position.set(x, y, z); s.scale.set(3.4, 0.85, 1); scene.add(s); return s;
}

// =====================================================
//  NPC WORLD on the campus
// =====================================================
// open, collision-free hang-out spots (in front of buildings / on plazas)
const LOC = {
  plaza:   [0, 20],   park: [0, 33],     acad: [0, -123],
  class1d: [-95, -127], council: [95, -127], lib: [-120, -111],
  caf:     [-120, 73], gym: [128, 74],    aqua: [55, 132],
  dorm:    [176, -2],  mall: [-168, 15],  avE: [95, 6], avW: [-95, 6],
};
function findFree(x, z, r = 0.6) {
  if (!blocked(x, z, 0, r)) return [x, z];
  for (let ring = 1; ring <= 16; ring++) for (let a = 0; a < 18; a++) {
    const ang = a / 18 * Math.PI * 2, d = ring * 1.1, nx = x + Math.cos(ang) * d, nz = z + Math.sin(ang) * d;
    if (!blocked(nx, nz, 0, r)) return [nx, nz];
  }
  return [x, z];
}

// ---------- navigation graph: a ring of waypoints AROUND the central fountain ----------
// (the fountain collider straddles both avenues, so NPCs must route around it)
const NODES = {};
for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; NODES['r' + i] = [Math.cos(a) * 22, Math.sin(a) * 22]; }
for (const [k, p] of Object.entries(LOC)) NODES[k] = p.slice();
const ADJ = {}; for (const k in NODES) ADJ[k] = [];
function nlink(a, b) { ADJ[a].push(b); ADJ[b].push(a); }
for (let i = 0; i < 8; i++) nlink('r' + i, 'r' + ((i + 1) % 8));      // ring loop
for (const k of Object.keys(LOC)) {                                    // each spot → nearest ring node(s)
  const ranked = [];
  for (let i = 0; i < 8; i++) ranked.push(['r' + i, planar(LOC[k][0], LOC[k][1], NODES['r' + i][0], NODES['r' + i][1])]);
  ranked.sort((a, b) => a[1] - b[1]);
  nlink(k, ranked[0][0]); nlink(k, ranked[1][0]);
}
// Direct "line of sight" edges between spots whose straight path is clear — avoids
// huge detours to the centre for two buildings on the same side of campus.
function segClear(a, b) {
  const n = Math.max(2, Math.ceil(planar(a[0], a[1], b[0], b[1]) / 3));
  for (let i = 1; i < n; i++) { const t = i / n; if (blocked(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0, 0.7)) return false; }
  return true;
}
{
  const lk = Object.keys(LOC);
  for (let i = 0; i < lk.length; i++) for (let j = i + 1; j < lk.length; j++)
    if (segClear(LOC[lk[i]], LOC[lk[j]])) nlink(lk[i], lk[j]);
}
function nearestNode(x, z) { let best = null, bd = 1e9; for (const k in NODES) { const d = planar(x, z, NODES[k][0], NODES[k][1]); if (d < bd) { bd = d; best = k; } } return best; }
function navPath(from, to) {
  if (from === to) return [to];
  const prev = { [from]: null }, q = [from];
  while (q.length) { const c = q.shift(); if (c === to) break; for (const nb of ADJ[c] || []) if (!(nb in prev)) { prev[nb] = c; q.push(nb); } }
  if (!(to in prev)) return [to];
  const out = []; for (let c = to; c; c = prev[c]) out.unshift(c); return out;
}

const npcs = [];
function makeCharacter(name, persona, cfg) {
  const rig = makeRig(cfg);
  const [sx, sz] = findFree(...LOC[cfg.home]);
  rig.root.position.set(sx, 0, sz); rig.root.rotation.y = Math.PI; scene.add(rig.root);
  npcs.push({
    name, persona, cfg, rig, label: makeLabel(name, sx, rig.height + 0.35, sz),
    home: cfg.home, spots: cfg.spots, sociability: cfg.sociability ?? 0.3, speed: cfg.speed ?? 2.6, lines: cfg.lines || {},
    x: sx, z: sz, facing: Math.PI, state: 'idle', path: [], pathI: 0,
    nextDecision: 4 + Math.random() * 8, nextApproach: 25 + Math.random() * 40, nextGreet: 0, nextAmbient: 8 + Math.random() * 20,
    wantsTalk: false, waitUntil: 0, dest: null, bubble: null, bubbleUntil: 0, speaking: false, _stuck: 0,
    anim: { moving: false, phase: 0, talk: false, idleT: Math.random() * 6, blinkT: Math.random() * 4, lookAt: null, run: false }
  });
}

makeCharacter('Horikita', `Horikita Suzune — reserved, direct and serious, quietly determined to reach Class A. NOT cold-hearted or hostile: no patience for nonsense, awkward rather than cruel. A dry understated warmth shows through; she secretly doesn't mind Ayanokouji's company and grows gentler over time. Precise speech, never slang; her bluntness is honesty, not contempt.`,
  { hair: 0x15151f, hairStyle: 'long', gender: 'f', skin: 0xf3d0b3, tie: 0x8a2b3a, height: 0.97, home: 'lib', sociability: 0.3, speed: 2.5,
    spots: ['lib', 'lib', 'class1d', 'plaza', 'caf'],
    lines: { greet: ['...Ayanokouji-kun.', 'Oh. It\'s you.', 'Did you need something?'], idle: ['This argument is poorly reasoned.', 'Class D. We can still fix that.', 'It\'s quieter here.'], rain: ['I didn\'t bring an umbrella.', 'We should get inside.'], approach: ['There\'s something I wanted to ask you.', 'Do you have a moment?'] } });
makeCharacter('Kushida', `Kushida Kikyou — relentlessly cheerful, wants to befriend everyone, very social. Publicly sweet with the subtlest hidden edge.`,
  { hair: 0x22305a, hairStyle: 'medium', gender: 'f', skin: 0xf7d9bd, tie: 0x8a2b3a, height: 0.95, home: 'caf', sociability: 0.85, speed: 2.7,
    spots: ['caf', 'plaza', 'class1d', 'mall'],
    lines: { greet: ['Ayanokouji-kun! Hello!', 'Hey hey, over here!'], idle: ['Everyone seems so nice here!', 'I want to learn all 40 names!'], rain: ['Eek, my hair!'], approach: ['Ayanokouji-kun, wait up!', 'Can I talk to you for a sec?'] } });
makeCharacter('Sudou', `Sudou Ken — red-haired, hot-tempered basketball recruit, athletic, hates studying, insecure about being in D-Class.`,
  { hair: 0x9b2618, hairStyle: 'spiky', gender: 'm', skin: 0xecc39c, tie: 0x2b4a8a, height: 1.06, home: 'gym', sociability: 0.45, speed: 3.0,
    spots: ['gym', 'gym', 'caf', 'plaza'],
    lines: { greet: ['Yo.', 'Oh, it\'s you.'], idle: ['Tch. Studying\'s a waste.', 'I\'m gonna be a pro, watch.'], rain: ['Can\'t practise in this. Damn it.'], approach: ['Hey — you got a sec?', 'Oi, Ayanokouji!'] } });
makeCharacter('Kouenji', `Kouenji Rokusuke — blond, narcissistic wealthy heir, calls himself perfect, ignores social rules.`,
  { hair: 0xd9b44a, hairStyle: 'slick', gender: 'm', skin: 0xf1c9a5, tie: 0x2b4a8a, height: 1.05, home: 'mall', sociability: 0.06, speed: 2.3,
    spots: ['mall', 'plaza', 'dorm'],
    lines: { greet: ['Hmph.', 'Ah — a passerby.'], idle: ['Perfect, as always.', 'How dull this place is.'], rain: ['My hair deserves better than this.'], approach: ['You there. Amuse me.'] } });

// ---------- NPC navigation (hub routing across the open campus) ----------
function routeTo(npc, dest) {
  const keys = navPath(nearestNode(npc.x, npc.z), dest);
  npc.path = keys.map(k => NODES[k].slice());
  const [dx, dz] = LOC[dest];
  npc.path[npc.path.length - 1] = findFree(dx + (Math.random() - .5) * 4, dz + (Math.random() - .5) * 4, 0.5);
  npc.pathI = 0; npc.state = 'moving'; npc.dest = dest; npc._stuck = 0;
}
function npcBlocked(npc, x, z) {
  if (blocked(x, z, 0, 0.45)) return true;
  for (const o of npcs) { if (o === npc) continue; if (planar(x, z, o.x, o.z) < 0.9) return true; }
  return false;
}
function stepNPC(npc, tx, tz, dt) {
  let dx = tx - npc.x, dz = tz - npc.z; const dist = Math.hypot(dx, dz);
  if (dist < 0.8) { npc.anim.moving = false; npc._stuck = 0; return true; }
  dx /= dist; dz /= dist; const step = npc.speed * dt, sx = npc.x, sz = npc.z;
  let moved = false;
  for (const ang of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6]) {
    const cs = Math.cos(ang), sn = Math.sin(ang), ax = dx * cs - dz * sn, az = dx * sn + dz * cs;
    const nx = npc.x + ax * step, nz = npc.z + az * step;
    if (!npcBlocked(npc, nx, nz)) { npc.x = nx; npc.z = nz; moved = true; break; }
  }
  if (moved) npc._stuck = 0; else { npc._stuck += dt; if (npc._stuck > 1.6) { npc._stuck = 0; return true; } }
  npc.facing = Math.atan2(dx, dz);
  npc.anim.moving = moved; if (moved) npc.anim.phase += dt * npc.speed * 2.4;
  return false;
}

function playerDist(npc) { return planar(npc.x, npc.z, player.x, player.z); }
function uiBusy() { return dlg.style.display === 'flex' || document.getElementById('portal').style.display === 'block' || player.mode === 'dorm'; }

function applyLook(npc) {
  const d = playerDist(npc);
  if (d < 9) {
    let rel = Math.atan2(player.x - npc.x, player.z - npc.z) - npc.rig.root.rotation.y;
    while (rel > Math.PI) rel -= Math.PI * 2; while (rel < -Math.PI) rel += Math.PI * 2;
    npc.anim.lookAt = Math.max(-1.1, Math.min(1.1, rel));
  } else npc.anim.lookAt = null;
}
function ambientLife(npc, elapsed) {
  if (npc.bubbleUntil && elapsed > npc.bubbleUntil && npc.bubble) { npc.bubble.material.opacity -= 0.05; if (npc.bubble.material.opacity <= 0) { npc.bubble.visible = false; npc.bubbleUntil = 0; } }
  const d = playerDist(npc);
  if (!uiBusy() && d < 6.5 && elapsed > npc.nextGreet && !npc.wantsTalk) {
    npc.nextGreet = elapsed + 45 + Math.random() * 60; say(npc, pick(npc.lines.greet || ['...']), 3000); return;
  }
  if (elapsed > npc.nextAmbient) { npc.nextAmbient = elapsed + 22 + Math.random() * 40; if (d < 30 && !uiBusy()) say(npc, pick((weatherWet() && npc.lines.rain) ? npc.lines.rain : (npc.lines.idle || ['...'])), 3200); }
}
function maybeApproach(npc, elapsed) {
  if (!canTalk || uiBusy() || npc.wantsTalk || npc.state === 'escort' || elapsed < npc.nextApproach) return false;
  const d = playerDist(npc);
  if (d > 24 || d < 3) return false;
  const s = soc(npc.name), chance = npc.sociability * (1 + Math.min(1, s.affinity / 8)) * 0.55;
  if (Math.random() > chance) { npc.nextApproach = elapsed + 20 + Math.random() * 30; return false; }
  npc.state = 'approach'; npc.wantsTalk = true; npc.waitUntil = elapsed + 11; npc.path = [];
  say(npc, pick(npc.lines.approach || ['Hey — got a moment?']), 4200);
  return true;
}

function updateNPC(npc, dt, elapsed) {
  npc.rig.root.position.x = npc.x; npc.rig.root.position.z = npc.z;
  npc.label.position.set(npc.x, npc.rig.height + 0.35, npc.z);
  if (npc.bubble) npc.bubble.position.set(npc.x, npc.rig.height + 0.75, npc.z);
  npc.anim.idleT += dt; npc.anim.run = false;
  npc.anim.talk = npc.speaking || (activeNPC === npc && !(ttsOn && synth));
  applyLook(npc); ambientLife(npc, elapsed);

  if (activeNPC === npc) { npc.anim.moving = false; npc.facing = Math.atan2(player.x - npc.x, player.z - npc.z); }
  else if (npc.state === 'approach') {
    const d = playerDist(npc);
    if (elapsed > npc.waitUntil || uiBusy()) { npc.wantsTalk = false; npc.state = 'idle'; npc.nextApproach = elapsed + 60 + Math.random() * 60; npc.nextDecision = elapsed + 4; }
    else if (d < 2.6) { npc.anim.moving = false; npc.facing = Math.atan2(player.x - npc.x, player.z - npc.z); if (elapsed > (npc._openAt || (npc._openAt = elapsed + 1.1))) { npc._openAt = 0; npc.wantsTalk = false; npc.state = 'idle'; npc.nextApproach = elapsed + 90 + Math.random() * 90; openDialogue(npc, true); } }
    else { npc.anim.run = d > 12; const prev = npc.speed; if (npc.anim.run) npc.speed *= 1.5; const ang = Math.atan2(npc.x - player.x, npc.z - player.z); stepNPC(npc, player.x + Math.sin(ang) * 1.9, player.z + Math.cos(ang) * 1.9, dt); npc.speed = prev; }
  } else if (npc.state === 'escort') {
    const far = playerDist(npc) > 9;
    if (far) { npc.anim.moving = false; npc.facing = Math.atan2(player.x - npc.x, player.z - npc.z); }
    else if (stepNPC(npc, npc.path[npc.pathI][0], npc.path[npc.pathI][1], dt)) { npc.pathI++; if (npc.pathI >= npc.path.length) { npc.state = 'idle'; npc.nextDecision = elapsed + 20; showToast(`${npc.name} arrived.`); } }
  } else if (npc.state === 'moving') {
    if (maybeApproach(npc, elapsed)) {} else if (stepNPC(npc, npc.path[npc.pathI][0], npc.path[npc.pathI][1], dt)) { npc.pathI++; if (npc.pathI >= npc.path.length) { npc.state = 'idle'; npc.nextDecision = elapsed + 12 + Math.random() * 12; } }
  } else { // idle
    npc.anim.moving = false;
    if (!maybeApproach(npc, elapsed) && elapsed >= npc.nextDecision) { const next = pick(npc.spots); if (next !== npc.dest) routeTo(npc, next); else npc.nextDecision = elapsed + 8 + Math.random() * 8; }
  }
  npc.rig.root.rotation.y += (npc.facing - npc.rig.root.rotation.y) * Math.min(1, dt * 9);
  animateRig(npc.rig, npc.anim, dt);
}

// ---------- speech bubbles ----------
function makeBubble() { const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, opacity: 0 })); s.visible = false; scene.add(s); return s; }
function say(npc, text, ms = 3400) {
  if (!npc.bubble) npc.bubble = makeBubble();
  const c = document.createElement('canvas'), pad = 20, ctx = c.getContext('2d');
  ctx.font = 'bold 28px Segoe UI'; const words = text.split(' '); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > 380 && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur);
  const lh = 34, wMax = Math.max(...lines.map(l => ctx.measureText(l).width));
  c.width = Math.ceil(wMax + pad * 2); c.height = lines.length * lh + pad * 2;
  const x = c.getContext('2d'); x.font = 'bold 28px Segoe UI'; x.fillStyle = 'rgba(252,252,255,.96)'; x.strokeStyle = 'rgba(30,34,44,.9)'; x.lineWidth = 3;
  x.beginPath(); x.roundRect(2, 2, c.width - 4, c.height - 4, 16); x.fill(); x.stroke();
  x.fillStyle = '#1a1d26'; x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach((l, i) => x.fillText(l, c.width / 2, pad + lh * i + lh / 2));
  if (npc.bubble.material.map) npc.bubble.material.map.dispose();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  npc.bubble.material.map = tex; npc.bubble.material.opacity = 1; npc.bubble.visible = true;
  npc.bubble.scale.set(c.width / 170, c.height / 170, 1);
  npc.bubbleUntil = clock() + ms / 1000;
  if (playerDist(npc) < 18) speakAs(npc.name, text, 1, npc);
}

// =====================================================
//  VOICES (browser speechSynthesis; prefers Edge neural voices)
// =====================================================
const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
let ttsOn = load('cote3dTTS', true), voicesReady = false, speakPriority = 0;
const VOICE_STYLE = {
  Horikita: { female: true, pitch: 0.98, rate: 0.97, slot: 0 }, Kushida: { female: true, pitch: 1.28, rate: 1.12, slot: 1 },
  Sudou: { female: false, pitch: 0.86, rate: 1.12, slot: 0 }, Kouenji: { female: false, pitch: 1.02, rate: 0.86, slot: 1 },
  Narrator: { female: false, pitch: 0.95, rate: 1.0, slot: 2 },
};
const FEMALE_RE = /aria|jenny|michelle|zira|hazel|susan|samantha|nanami|sonia|libby|natasha|clara|female|woman/i;
const MALE_RE = /guy|davis|andrew|brian|christopher|eric|roger|tony|ryan|thomas|david|mark|alex|george|male|man/i;
const voicePool = { female: [], male: [] };
function loadVoices() {
  if (!synth) return; const all = synth.getVoices(); if (!all.length) return;
  const score = v => (/natural|online/i.test(v.name) ? 4 : 0) + (/^en/i.test(v.lang) ? 2 : 0) + (v.localService ? 0 : 1);
  const sorted = all.slice().sort((a, b) => score(b) - score(a));
  voicePool.female = sorted.filter(v => FEMALE_RE.test(v.name));
  voicePool.male = sorted.filter(v => MALE_RE.test(v.name) && !FEMALE_RE.test(v.name));
  const rest = sorted.filter(v => !voicePool.female.includes(v) && !voicePool.male.includes(v));
  if (!voicePool.female.length) voicePool.female = rest.length ? rest : sorted;
  if (!voicePool.male.length) voicePool.male = rest.length ? rest.slice().reverse() : sorted;
  voicesReady = true;
}
function voiceFor(name) { const st = VOICE_STYLE[name] || VOICE_STYLE.Narrator; const p = st.female ? voicePool.female : voicePool.male; return p.length ? p[st.slot % p.length] : null; }
if (synth) { loadVoices(); synth.addEventListener?.('voiceschanged', loadVoices); }
function cleanSpeech(t) { return String(t || '').replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/[*_`#>~|]/g, ' ').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ').replace(/[—–]/g, ', ').replace(/\s+/g, ' ').trim().slice(0, 400); }
function speakAs(name, text, priority = 2, npc = null) {
  if (!synth || !ttsOn) return; if (!voicesReady) loadVoices();
  const line = cleanSpeech(text); if (!line) return;
  if (synth.speaking && priority < speakPriority) return;
  if (synth.speaking || synth.pending) synth.cancel();
  const st = VOICE_STYLE[name] || VOICE_STYLE.Narrator, u = new SpeechSynthesisUtterance(line), v = voiceFor(name);
  if (v) { u.voice = v; u.lang = v.lang; } u.pitch = st.pitch; u.rate = st.rate; speakPriority = priority;
  u.onstart = () => { if (npc) npc.speaking = true; };
  u.onend = u.onerror = () => { if (npc) npc.speaking = false; speakPriority = 0; };
  try { synth.speak(u); } catch (e) {}
}
function stopSpeech() { if (!synth) return; try { synth.cancel(); } catch {} npcs.forEach(n => n.speaking = false); speakPriority = 0; }

// =====================================================
//  DIALOGUE (AI + memory)
// =====================================================
const dlg = $('dialogue'), dlgName = $('dlg-name'), dlgLog = $('dlg-log'), dlgChoices = $('dlg-choices'), dlgInput = $('dlg-input'), dlgThinking = $('dlg-thinking');
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function npcSystemPrompt(npc) {
  const s = soc(npc.name);
  return `You are role-playing a single character in "Classroom of the Elite" (Volume 1, first days). The human player is Ayanokouji Kiyotaka, an outwardly plain, quiet boy. Stay 100% in character; NEVER speak or act for Ayanokouji.

CHARACTER: ${npc.name}
${npc.persona}

CONTEXT: weather is ${wTarget.name.toLowerCase()}; your mood is ${s.mood}; you've spoken ${s.talks} time(s) before.
RULES:
- Reply SHORT and natural (1-4 sentences), like real spoken dialogue. No narration of the player's actions.
- You REMEMBER earlier conversations (in the history). Refer back naturally.
- Warmth is earned; you are not automatically impressed.
- Stat changes are RARE and SMALL (-3..+3), mostly zeros. Never mention stats/points/"the game".
MOVEMENT: if you agree to go somewhere together, set "move.to" to one of: class1d, lib, caf, gym, aqua, mall, dorm, acad, council, park, plaza — else null.
Respond ONLY with valid JSON: { "text":"...", "statChanges":{"trust":0,"love":0,"respect":0,"wisdom":0,"courage":0}, "choices":["...","..."], "move":{"to":null} }`;
}
function openDialogue(npc, initiated = false) {
  activeNPC = npc; convo = (memory[npc.name] || []).slice(); setFrozen(true);
  const s = soc(npc.name); s.talks++; if (Math.random() < 0.4) s.mood = pick(MOODS); save('cote3dSocial', social);
  dlgName.textContent = `${npc.name} · ${s.mood}`; dlgLog.innerHTML = ''; dlgChoices.innerHTML = '';
  for (const m of convo) { if (m.role === 'user' && m._h) continue; if (m.role === 'user') addLine('me', 'You', m.parts[0].text); else { try { addLine('npc', npc.name, JSON.parse(m.parts[0].text).text); } catch {} } }
  dlg.style.display = 'flex';
  if (!canTalk) { addLine('sys', '', 'Add a Gemini API key on the start screen to talk.'); return; }
  if (initiated) { addLine('sys', '', `— ${npc.name} came over to talk —`); sendToNPC('[You walked over to Ayanokouji and started this conversation. Open with what you came to say, in character.]', true); }
  else if (convo.length === 0) sendToNPC('[Ayanokouji walks up to you. Greet or react in character.]', true);
  else { addLine('sys', '', `— you approach ${npc.name} again —`); sendToNPC('[Ayanokouji walks up again. React, remembering earlier talks.]', true); }
}
function addLine(kind, who, text, chips) {
  const el = document.createElement('div'); el.className = `line ${kind}`;
  el.innerHTML = kind === 'sys' ? `<div>${esc(text)}</div>` : `<div class="who">${who}</div><div>${esc(text)}</div>`;
  if (chips) el.insertAdjacentHTML('beforeend', chips);
  dlgLog.appendChild(el); dlgLog.scrollTop = dlgLog.scrollHeight;
}
function renderChoices(list) { dlgChoices.innerHTML = ''; (list || []).forEach(t => { const b = document.createElement('button'); b.className = 'choice'; b.textContent = t; b.onclick = () => submit(t); dlgChoices.appendChild(b); }); }
async function sendToNPC(text, opening = false) {
  if (!opening) addLine('me', 'You', text);
  const um = { role: 'user', parts: [{ text }] }; if (opening) um._h = true; convo.push(um);
  renderChoices([]); dlgThinking.style.display = 'block'; dlgInput.disabled = true;
  const npc = activeNPC;
  try {
    const contents = convo.slice(-MAX_MEMORY_TURNS).map(m => ({ role: m.role, parts: m.parts }));
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: npcSystemPrompt(npc) }] }, contents, generationConfig: { temperature: 0.85, responseMimeType: 'application/json' } })
    });
    const data = await res.json(); if (data.error) throw new Error(data.error.message);
    const raw = data.candidates[0].content.parts[0].text; convo.push({ role: 'model', parts: [{ text: raw }] });
    memory[npc.name] = convo; save('cote3dConvos', memory);
    const p = JSON.parse(raw);
    const chips = Object.entries(p.statChanges || {}).filter(([k, v]) => k in stats && v !== 0).map(([k, v]) => `<span class="chip ${v > 0 ? 'up' : 'down'}">${STAT_ICONS[k]} ${v > 0 ? '+' : ''}${v}</span>`).join('');
    addLine('npc', npc.name, p.text || '…', chips ? `<div class="chips">${chips}</div>` : '');
    speakAs(npc.name, p.text, 2, npc);
    applyStats(p.statChanges); renderChoices(p.choices);
    const s = soc(npc.name); const dsum = Object.values(p.statChanges || {}).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    s.affinity = Math.max(-10, Math.min(20, s.affinity + (dsum || 0.3))); save('cote3dSocial', social);
    const dest = p.move && p.move.to && LOC[p.move.to] ? p.move.to : null;
    if (dest) { routeTo(npc, dest); npc.state = 'escort'; addLine('sys', '', `→ ${npc.name} heads off — follow!`); showToast(`${npc.name} is heading off — follow!`); setTimeout(closeDialogue, 1500); }
  } catch (e) { addLine('sys', '', '⚠️ ' + (e.message || 'AI error')); }
  finally { dlgThinking.style.display = 'none'; dlgInput.disabled = false; dlgInput.focus(); }
}
function submit(t) { t = (t ?? dlgInput.value).trim(); if (!t || !canTalk) return; dlgInput.value = ''; sendToNPC(t); }
function closeDialogue() {
  dlg.style.display = 'none'; stopSpeech(); const npc = activeNPC; activeNPC = null; setFrozen(false);
  if (npc) { npc.nextDecision = clock() + 25; npc.wantsTalk = false; if (npc.state === 'approach') npc.state = 'idle'; npc.nextApproach = clock() + 100; }
}
$('dlg-send').onclick = () => submit();
dlgInput.addEventListener('keypress', e => { if (e.key === 'Enter') submit(); });
$('dlg-close').onclick = closeDialogue;
addEventListener('keydown', e => { if (e.code === 'Escape' && dlg.style.display === 'flex') closeDialogue(); });

// interact hook: talk to nearest NPC before the engine tries a building
setInteractHook(() => {
  if (dlg.style.display === 'flex') return true;
  let best = null, bd = 3.6;
  for (const n of npcs) { const d = playerDist(n); if (d < bd) { bd = d; best = n; } }
  if (best) { openDialogue(best, false); return true; }
  return false;
});

// =====================================================
//  STATS HUD
// =====================================================
const statsEl = $('stats');
function renderStats() {
  statsEl.innerHTML = '';
  for (const k of Object.keys(BASE_STATS)) {
    const row = document.createElement('div'); row.className = 'stat-row';
    row.innerHTML = `<span class="lbl">${STAT_ICONS[k]} ${k}</span><span class="bar"><span class="fill" style="width:${stats[k]}%;background:${STAT_COLORS[k]}"></span></span><span class="val">${stats[k]}</span>`;
    statsEl.appendChild(row);
  }
}
function applyStats(ch) { for (const [k, v] of Object.entries(ch || {})) if (k in stats && typeof v === 'number') stats[k] = Math.max(0, Math.min(100, stats[k] + v)); save('cote3dStats', stats); renderStats(); }
renderStats();

// =====================================================
//  DYNAMIC WEATHER (drives the engine sky, fog, sun, rain)
// =====================================================
const WEATHERS = {
  clear:    { icon: '☀️', name: 'Clear',    top: 0x3f7fc4, mid: 0xbfdcef, bot: 0xeef4f0, fog: 0xcfe0e6, near: 220, far: 900, sun: 2.4, hemi: 0.65, rain: 0 },
  cloudy:   { icon: '⛅', name: 'Cloudy',   top: 0x7f9cc0, mid: 0xcbd8e2, bot: 0xe7edf1, fog: 0xd6e0e8, near: 180, far: 760, sun: 1.5, hemi: 0.7, rain: 0 },
  overcast: { icon: '☁️', name: 'Overcast', top: 0x8d99a6, mid: 0xc2ccd2, bot: 0xd8dee2, fog: 0xc9d1d6, near: 130, far: 560, sun: 0.9, hemi: 0.75, rain: 0 },
  rain:     { icon: '🌧️', name: 'Rain',     top: 0x66727e, mid: 0x9aa7b0, bot: 0xbcc6cc, fog: 0xa9b4bb, near: 80, far: 380, sun: 0.5, hemi: 0.6, rain: 1 },
  sunset:   { icon: '🌇', name: 'Sunset',   top: 0x3f6ea8, mid: 0xe0a878, bot: 0xf6c69a, fog: 0xe8b98f, near: 180, far: 760, sun: 1.8, hemi: 0.7, rain: 0 },
};
const W_ORDER = ['clear', 'cloudy', 'overcast', 'rain', 'sunset'];
let wTargetKey = 'clear', wTarget = WEATHERS.clear, wNext = 60 + Math.random() * 60;
const wCur = { top: new THREE.Color(0x3f7fc4), mid: new THREE.Color(0xbfdcef), bot: new THREE.Color(0xeef4f0), fog: new THREE.Color(0xcfe0e6), near: 220, far: 900, sun: 2.4, hemi: 0.65, rain: 0 };
const _c = new THREE.Color();
function weatherWet() { return wCur.rain > 0.4; }
const RAIN_N = 4000, rainGeo = new THREE.BufferGeometry(), rainPos = new Float32Array(RAIN_N * 6);
for (let i = 0; i < RAIN_N; i++) { const x = (Math.random() - .5) * 140, y = Math.random() * 70, z = (Math.random() - .5) * 140; rainPos.set([x, y, z, x + 0.08, y - 1.0, z], i * 6); }
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainMat = new THREE.LineBasicMaterial({ color: 0xc3daf0, transparent: true, opacity: 0 });
const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; rain.visible = false; scene.add(rain);
const weatherChip = $('weather-chip');
function setWeather(k, announce = true) { wTargetKey = k; wTarget = WEATHERS[k]; if (weatherChip) weatherChip.textContent = `${wTarget.icon} ${wTarget.name}`; if (announce) showToast(`Weather: ${wTarget.icon} ${wTarget.name}`, 2600); }
function cycleWeather() { setWeather(W_ORDER[(W_ORDER.indexOf(wTargetKey) + 1) % W_ORDER.length]); }
if (weatherChip) weatherChip.onclick = cycleWeather;
setWeather('clear', false);
function updateWeather(dt, elapsed) {
  if (elapsed > wNext) { wNext = elapsed + 60 + Math.random() * 70; const nx = { clear: ['cloudy', 'sunset'], cloudy: ['clear', 'overcast'], overcast: ['rain', 'cloudy'], rain: ['overcast', 'cloudy'], sunset: ['clear', 'cloudy'] }[wTargetKey]; setWeather(pick(nx)); }
  const k = Math.min(1, dt * 0.35);
  wCur.top.lerp(_c.setHex(wTarget.top), k); wCur.mid.lerp(_c.setHex(wTarget.mid), k); wCur.bot.lerp(_c.setHex(wTarget.bot), k); wCur.fog.lerp(_c.setHex(wTarget.fog), k);
  for (const p of ['near', 'far', 'sun', 'hemi', 'rain']) wCur[p] += (wTarget[p] - wCur[p]) * k;
  skyMat.uniforms.top.value.copy(wCur.top); skyMat.uniforms.mid.value.copy(wCur.mid); skyMat.uniforms.bot.value.copy(wCur.bot);
  scene.fog.color.copy(wCur.fog); scene.fog.near = wCur.near; scene.fog.far = wCur.far;
  sun.intensity = wCur.sun; hemi.intensity = wCur.hemi;
  rainMat.opacity = Math.min(0.7, wCur.rain * 0.6); rain.visible = rainMat.opacity > 0.02;
  if (rain.visible) {
    rain.position.set(camera.position.x, 0, camera.position.z);
    const fall = (42 + wCur.rain * 24) * dt, arr = rainGeo.attributes.position.array;
    for (let i = 0; i < RAIN_N; i++) { const o = i * 6; arr[o + 1] -= fall; arr[o + 4] -= fall; if (arr[o + 4] < 0) { const y = 55 + Math.random() * 12; arr[o + 1] = y; arr[o + 4] = y - 1.0; } }
    rainGeo.attributes.position.needsUpdate = true;
  }
}

// ---------- sound toggle ----------
const soundChip = $('sound-chip');
function refreshSound() { if (soundChip) soundChip.textContent = ttsOn ? '🔊 Voices on' : '🔇 Voices off'; }
function toggleTTS() { ttsOn = !ttsOn; save('cote3dTTS', ttsOn); refreshSound(); if (!ttsOn) stopSpeech(); showToast(ttsOn ? '🔊 Voices on' : '🔇 Voices off', 2000); }
if (soundChip) soundChip.onclick = toggleTTS;
refreshSound();
addEventListener('keydown', e => {
  if (document.activeElement === dlgInput) return;
  if (e.code === 'KeyV') cycleWeather();
  if (e.code === 'KeyM') toggleTTS();
});

// ---------- clock + per-frame update ----------
let _elapsed = 0;
function clock() { return _elapsed; }
onFrame((dt, now) => {
  _elapsed = now / 1000;
  for (const n of npcs) updateNPC(n, dt, _elapsed);
  updateWeather(dt, _elapsed);
});

// =====================================================
//  BOOT (start overlay wiring)
// =====================================================
const startEl = $('start'), keyInput = $('key-input');
if (apiKey && keyInput) keyInput.value = apiKey;
function begin(withKey) {
  if (withKey) { const k = keyInput ? keyInput.value.trim() : ''; if (k) { apiKey = k; localStorage.setItem('geminiApiKey', apiKey); } canTalk = !!apiKey; } else canTalk = false;
  if (startEl) startEl.style.display = 'none';
  const c = $('c'); if (c && c.requestPointerLock) { try { c.requestPointerLock(); } catch {} }
  start();
}
$('play-btn').onclick = () => begin(true);
$('explore-btn').onclick = () => begin(false);
$('reset-btn')?.addEventListener('click', () => {
  if (!confirm('Erase all progress (conversations, stats, relationships)?')) return;
  ['cote3dStats', 'cote3dConvos', 'cote3dSocial'].forEach(k => localStorage.removeItem(k)); location.reload();
});
// render immediately behind the overlay so the campus is visible
start();
