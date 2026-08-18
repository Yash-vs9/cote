// =====================================================
// Classroom of the Elite — Campus Explorer
// A big walkable first-person campus at WEB-GL fidelity.
// Walk up to any building and enter its detailed WebGL scene.
// The Dormitory is a fully walkable multi-floor interior.
// =====================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ---------- Renderer ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 2000);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// Image-based lighting for believable PBR (same technique as the interiors).
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ---------- Sky + weather-ish atmosphere ----------
const skyMat = new THREE.ShaderMaterial({
  uniforms: { top: { value: new THREE.Color(0x3f7fc4) }, mid: { value: new THREE.Color(0xbfdcef) }, bot: { value: new THREE.Color(0xeef4f0) } },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} ',
  fragmentShader: 'uniform vec3 top,mid,bot; varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = h>0.0 ? mix(mid,top,pow(h,0.6)) : mix(mid,bot,pow(-h,0.5)); gl_FragColor = vec4(c,1.0);} ',
  side: THREE.BackSide, depthWrite: false, fog: false
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), skyMat));
scene.fog = new THREE.Fog(0xcfe0e6, 220, 900);

const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x6d7168, 0.65); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dc, 2.4);
sun.position.set(180, 300, 140); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera; sc.left = -260; sc.right = 260; sc.top = 260; sc.bottom = -260; sc.near = 1; sc.far = 900;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun); scene.add(sun.target);

// ---------- PBR material + texture helpers ----------
const matCache = new Map();
function std(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0.0 }, opts));
  matCache.set(key, m); return m;
}
function noiseTex(size, base, spread, spec, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < spec; i++) {
    const v = (Math.random() * 2 - 1) * spread | 0;
    g.fillStyle = `rgba(${128 + v},${128 + v},${128 + v},${0.04 + Math.random() * 0.08})`;
    g.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  if (draw) draw(g, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const texGrass = noiseTex(256, '#5f8f4e', 40, 3000, (g, s) => { for (let i = 0; i < 1400; i++) { g.strokeStyle = `rgba(60,${120 + Math.random() * 60 | 0},50,.25)`; const x = Math.random() * s, y = Math.random() * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1, y - 3); g.stroke(); } });
const texAsphalt = noiseTex(256, '#3a3d42', 26, 2600);
const texConcrete = noiseTex(256, '#c9c6bd', 24, 1800);
const texPave = noiseTex(256, '#b9b3a6', 22, 1400, (g, s) => { g.strokeStyle = 'rgba(90,86,78,.4)'; g.lineWidth = 2; for (let i = 0; i <= s; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); } });
const texSand = noiseTex(256, '#e3d5a8', 18, 1200);
function repeat(tex, rx, rz) { const t = tex.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, rz); t.needsUpdate = true; return t; }

// Window/facade strip texture — glowing rows of windows for tall buildings.
function facadeTex(cols, rows, wallCol, glassCol, lit) {
  const cell = 24, c = document.createElement('canvas');
  c.width = cols * cell; c.height = rows * cell;
  const g = c.getContext('2d');
  g.fillStyle = wallCol; g.fillRect(0, 0, c.width, c.height);
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const on = lit && Math.random() < 0.22;
    g.fillStyle = on ? '#ffe4a8' : glassCol;
    g.fillRect(k * cell + 4, r * cell + 5, cell - 8, cell - 10);
    g.strokeStyle = 'rgba(40,40,46,.5)'; g.lineWidth = 1.5;
    g.strokeRect(k * cell + 4, r * cell + 5, cell - 8, cell - 10);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// ---------- Collision world (Y-aware AABBs, so interiors can stack) ----------
const colliders = [];          // {minX,maxX,minZ,maxZ,minY,maxY}
function addBox(cx, cz, w, d, y0 = -1, y1 = 9999) { colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, minY: y0, maxY: y1 }); }
function blocked(x, z, y, r) {
  for (const c of colliders) {
    if (y + 1.6 < c.minY || y > c.maxY) continue;   // not on this vertical span
    if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true;
  }
  return false;
}

// ---------- Mesh helpers ----------
function box(w, h, d, mat, x, y, z, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = !opts.noShadow; m.receiveShadow = true;
  (opts.parent || scene).add(m);
  return m;
}
function ground(w, d, tex, rx, rz, x, z, y = 0, col = 0xffffff) {
  const mat = new THREE.MeshStandardMaterial({ map: repeat(tex, rx, rz), roughness: 0.95, color: col });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m;
}

// ---------- Floating text labels ----------
function makeLabel(text, x, y, z, scale = 8) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(16,18,24,.78)'; g.beginPath();
  const r = 24; g.roundRect(6, 24, 500, 80, r); g.fill();
  g.strokeStyle = 'rgba(255,210,150,.6)'; g.lineWidth = 3; g.stroke();
  g.font = 'bold 46px Segoe UI, sans-serif'; g.fillStyle = '#ffeccf';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: true }));
  s.position.set(x, y, z); s.scale.set(scale * 2, scale * 0.5, 1); scene.add(s); return s;
}

// ---------- Building registry (entrances + WebGL scene portals) ----------
const WGL = 'WEB%20GL/';
const buildings = [];   // {name, door:[x,z], face, portal, enter?}
function registerDoor(name, x, z, portal, enter) { buildings.push({ name, door: [x, z], portal, enter }); }

// ---------- Building factories (multi-storey exteriors) ----------
// A general slab/tower block with floor bands of windows.
function towerBlock(cx, cz, w, d, floors, fh, wallCol, glassCol, opts = {}) {
  const h = floors * fh;
  const wall = std(wallCol, { roughness: 0.9 });
  const facade = new THREE.MeshStandardMaterial({ map: facadeTex(Math.max(3, Math.round(w / 3.2)), floors, cssHex(wallCol), cssHex(glassCol), opts.lit), roughness: 0.55, metalness: 0.12, emissive: 0x120e06, emissiveIntensity: opts.lit ? 0.35 : 0.0 });
  // core
  box(w, h, d, wall, cx, h / 2, cz);
  // window facades on the 4 sides (slightly proud of the wall)
  const fw = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.6, h - 0.6), facade); fw.position.set(cx, h / 2, cz + d / 2 + 0.03); scene.add(fw);
  const bw = fw.clone(); bw.position.z = cz - d / 2 - 0.03; bw.rotation.y = Math.PI; scene.add(bw);
  const lw = new THREE.Mesh(new THREE.PlaneGeometry(d - 0.6, h - 0.6), facade); lw.position.set(cx - w / 2 - 0.03, h / 2, cz); lw.rotation.y = -Math.PI / 2; scene.add(lw);
  const rw = lw.clone(); rw.position.x = cx + w / 2 + 0.03; rw.rotation.y = Math.PI / 2; scene.add(rw);
  // parapet + roof plant
  box(w + 1.2, 1.2, d + 1.2, std(0x8a8681), cx, h + 0.6, cz);
  box(w * 0.4, 3, d * 0.35, wall, cx + w * 0.1, h + 2.4, cz - d * 0.1);
  addBox(cx, cz, w, d);
  return { cx, cz, w, d, h };
}
function cssHex(c) { return '#' + c.toString(16).padStart(6, '0'); }

// A ground entrance canopy + doors, returns door world position.
function entrance(cx, cz, faceZ, w = 8) {
  const z = cz + faceZ * 0.5;
  box(w + 3, 0.4, 5, std(0x6d7075, { metalness: 0.4, roughness: 0.4 }), cx, 4.2, cz + faceZ * 3.2, { noShadow: true }); // canopy
  box(0.5, 4.2, 5, std(0x6d7075), cx - w / 2 - 1, 2.1, cz + faceZ * 3.2);
  box(0.5, 4.2, 5, std(0x6d7075), cx + w / 2 + 1, 2.1, cz + faceZ * 3.2);
  box(w, 4, 0.3, std(0x2a3138, { metalness: 0.6, roughness: 0.15, transparent: true, opacity: 0.7 }), cx, 2, cz + faceZ * 0.6, { noShadow: true }); // glass doors
  return [cx, cz + faceZ * 6];
}

// ---------- Layout the campus ----------
ground(1600, 1600, texGrass, 120, 120, 0, 0, 0);                 // grass
// road network
ground(30, 900, texAsphalt, 4, 90, 0, 0, 0.03);                  // main N-S avenue
ground(900, 30, texAsphalt, 90, 4, 0, 0, 0.03);                  // E-W avenue
ground(24, 500, texAsphalt, 3, 60, -150, -40, 0.03);
ground(24, 500, texAsphalt, 3, 60, 150, -20, 0.03);
ground(200, 200, texPave, 24, 24, 0, 0, 0.05);                   // central plaza

// central park / fountain
(function fountain() {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 1.2, 40), std(0xb8b3a8, { roughness: 0.6 }));
  base.position.y = 0.6; base.castShadow = base.receiveShadow = true; scene.add(base);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 0.4, 40), std(0x4d8fb8, { roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.85 }));
  water.position.y = 1.2; scene.add(water);
  box(1.4, 5, 1.4, std(0xb8b3a8), 0, 3, 0); addBox(0, 0, 22, 22);
})();
makeLabel('CENTRAL PARK', 0, 9, 16, 9);
registerDoor('Central Park', 0, 30, WGL + 'central-park.html');

// trees dotted around (avoid roads)
const trunkG = new THREE.CylinderGeometry(0.5, 0.7, 5, 8), leafG = new THREE.IcosahedronGeometry(3.2, 1);
const trunkM = std(0x6b4a2c), leafM = std(0x4f8a3f, { roughness: 1, flatShading: true });
for (const [tx, tz] of [[-40, 30], [40, 30], [-40, -30], [40, -30], [-70, 60], [70, 60], [-70, -60], [70, -60], [-30, 70], [30, 70], [-95, 20], [95, 20], [-30, -70], [30, -70]]) {
  const tr = new THREE.Mesh(trunkG, trunkM); tr.position.set(tx, 2.5, tz); tr.castShadow = true; scene.add(tr);
  const lf = new THREE.Mesh(leafG, leafM); lf.position.set(tx, 6.5, tz); lf.castShadow = true; scene.add(lf);
  addBox(tx, tz, 1.4, 1.4);
}

// --- Main Academic Building (north, big multi-wing, multi-floor) ---
(function academic() {
  const cx = 0, cz = -150;
  towerBlock(cx - 30, cz, 40, 34, 4, 4.2, 0xd8cbb0, 0x2c3a44, { lit: false });   // west wing
  towerBlock(cx + 30, cz, 40, 34, 4, 4.2, 0xd8cbb0, 0x2c3a44, { lit: false });   // east wing
  towerBlock(cx, cz - 6, 34, 30, 6, 4.2, 0xe0d4bb, 0x2c3a44, { lit: false });    // taller central tower
  const d = entrance(cx, cz + 15, 1, 12);
  makeLabel('MAIN ACADEMIC BUILDING', cx, 30, cz + 17, 15);
  registerDoor('Main Academic Building', d[0], d[1], WGL + 'academic-building.html');
})();

// --- Class 1-D & Student Council wings (near academic) ---
(function classWing() {
  towerBlock(-95, -150, 28, 24, 3, 4.2, 0xd4c7ac, 0x33424c);
  const d = entrance(-95, -138, 1, 8);
  makeLabel('CLASS 1-D', -95, 20, -136, 9);
  registerDoor('Class 1-D', d[0], d[1], WGL + 'classroom.html');
  towerBlock(95, -150, 28, 24, 3, 4.2, 0xd4c7ac, 0x33424c);
  const d2 = entrance(95, -138, 1, 8);
  makeLabel('STUDENT COUNCIL', 95, 20, -136, 10);
  registerDoor('Student Council Room', d2[0], d2[1], WGL + 'council-room.html');
})();

// --- Dormitory Tower (east, tall 15-story) — WALKABLE interior (built later) ---
const DORM = { cx: 175, cz: -30, w: 34, d: 34, floors: 15, fh: 4 };
(function dormExt() {
  towerBlock(DORM.cx, DORM.cz, DORM.w, DORM.d, DORM.floors, DORM.fh, 0xcdbfa6, 0x2a3640, { lit: true });
  makeLabel('DORMITORY TOWER · 15 FLOORS', DORM.cx, DORM.floors * DORM.fh + 8, DORM.cz + DORM.d / 2 + 6, 18);
  // entrance handled specially -> walkable interior (enter:true)
  registerDoor('Dormitory Tower (enter)', DORM.cx, DORM.cz + DORM.d / 2 + 7, WGL + 'dormitory-tower.html', 'dorm');
})();

// --- Keyaki Mall (west, glass atrium) + shops ---
(function mall() {
  const cx = -175, cz = -20;
  towerBlock(cx, cz, 70, 46, 3, 5, 0xcfd3d6, 0x2b3a45, { lit: true });
  // glass atrium
  box(24, 16, 24, std(0x88b0c8, { metalness: 0.6, roughness: 0.08, transparent: true, opacity: 0.45 }), cx, 8, cz + 20, { noShadow: true });
  const d = entrance(cx, cz + 23, 1, 14);
  makeLabel('KEYAKI MALL', cx, 22, cz + 25, 13);
  registerDoor('Keyaki Mall', d[0], d[1], WGL + 'keyaki-mall.html');
  registerDoor('Palette Café', cx - 26, cz + 25, WGL + 'palette-cafe.html');
  registerDoor('SIVCAMERA Store', cx + 26, cz + 25, WGL + 'sivcamera-store.html');
  registerDoor('Keyaki Karaoke', cx, cz - 25, WGL + 'keyaki-karaoke.html');
  makeLabel('CAFÉ', cx - 26, 8, cz + 25, 6); makeLabel('SIVCAMERA', cx + 26, 8, cz + 25, 7); makeLabel('KARAOKE', cx, 8, cz - 25, 7);
})();

// --- Gymnasium (SE, barrel-vault hall) ---
(function gym() {
  const cx = 130, cz = 95;
  box(52, 16, 40, std(0xd0cabb, { roughness: 0.8 }), cx, 8, cz);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(21, 21, 52, 24, 1, false, 0, Math.PI), std(0x9aa4ab, { metalness: 0.3, roughness: 0.5 }));
  roof.rotation.z = Math.PI / 2; roof.position.set(cx, 16, cz); roof.castShadow = true; scene.add(roof);
  addBox(cx, cz, 52, 40);
  const d = entrance(cx, cz - 20, -1, 10);
  makeLabel('SCHOOL GYMNASIUM', cx, 26, cz - 22, 13);
  registerDoor('School Gymnasium', d[0], d[1], WGL + 'school-gymnasium.html');
})();

// --- Aquatic Center (S) ---
(function aqua() {
  const cx = 55, cz = 150;
  towerBlock(cx, cz, 60, 34, 2, 6, 0xc4d2d8, 0x2f6f86, { lit: false });
  box(64, 0.4, 38, std(0x2f7f9e, { metalness: 0.4, roughness: 0.1, transparent: true, opacity: 0.5 }), cx, 12.2, cz, { noShadow: true });
  const d = entrance(cx, cz - 17, -1, 10);
  makeLabel('AQUATIC CENTER', cx, 20, cz - 19, 12);
  registerDoor('Aquatic Center', d[0], d[1], WGL + 'aquatic-center.html');
})();

// --- Memorial Library (NW) ---
(function library() {
  const cx = -120, cz = -140;
  towerBlock(cx, cz, 40, 34, 4, 4.4, 0xd9c9a2, 0x394a52);
  // colonnade
  for (let i = -2; i <= 2; i++) box(1.4, 8, 1.4, std(0xe7dcc4), cx + i * 8, 4, cz + 18);
  box(44, 1.6, 6, std(0xe7dcc4), cx, 8.8, cz + 18);
  const d = entrance(cx, cz + 16, 1, 10);
  makeLabel('MEMORIAL LIBRARY', cx, 24, cz + 20, 13);
  registerDoor('Memorial Library', d[0], d[1], WGL + 'memorial-library.html');
})();

// --- School Cafeteria (SW) ---
(function cafeteria() {
  const cx = -120, cz = 100;
  towerBlock(cx, cz, 48, 34, 2, 5.5, 0xdcd0b6, 0x35525c, { lit: true });
  const d = entrance(cx, cz - 17, -1, 12);
  makeLabel('CENTRAL CAFETERIA', cx, 18, cz - 19, 13);
  registerDoor('School Cafeteria', d[0], d[1], WGL + 'school-cafeteria.html');
})();

// --- Seaside Boulevard + ocean (far south) ---
(function seaside() {
  const zEdge = 300;
  ground(1600, 260, texSand, 60, 12, 0, zEdge - 40, 0.04, 0xe6d6a8);   // promenade/sand
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1600, 500), std(0x2a6f92, { metalness: 0.35, roughness: 0.12, transparent: true, opacity: 0.92 }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(0, 0.1, zEdge + 200); scene.add(ocean);
  for (let i = -1; i <= 1; i++) box(4, 3, 4, std(0x9a8f7a), i * 60, 1.5, zEdge - 60);   // barrier blocks
  makeLabel('SEASIDE BOULEVARD', 0, 12, zEdge - 62, 14);
  registerDoor('Seaside Boulevard', 0, zEdge - 66, WGL + 'seaside-boulevard.html');
})();

// perimeter wall
for (const [x, z, w, d] of [[0, -300, 1600, 4], [-300, 0, 4, 620], [300, 0, 4, 620]]) { box(w, 6, d, std(0x8f8b82), x, 3, z); addBox(x, z, w, d); }

// =====================================================
//  WALKABLE MULTI-FLOOR DORMITORY INTERIOR
// =====================================================
const dormInterior = new THREE.Group(); dormInterior.visible = false; scene.add(dormInterior);
const DORM_ORIGIN = { x: 600, z: 600 };     // built off to the side; player teleports here
const DFLOORS = 15, DFH = 4, HALL_LEN = 46, HALL_W = 6, ROOMS_PER_FLOOR = 8;
const dormColliders = [];                    // interior colliders (added to global while inside)
function idBox(cx, cz, w, d, y0, y1) { dormColliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, minY: y0, maxY: y1 }); }
const roomDoors = [];                         // {x,z,y,floor,room} -> portal to studio-401

function buildDormInterior() {
  const O = DORM_ORIGIN, wallMat = std(0xe4ded2, { roughness: 0.9 }), floorMat = std(0x8a8378, { roughness: 0.6 });
  const carpet = std(0x6d4a52, { roughness: 0.85 }), doorMat = std(0x7a5638, { roughness: 0.6 }), trimMat = std(0xcfc7b8);
  for (let f = 0; f < DFLOORS; f++) {
    const y = f * DFH;
    // floor slab + ceiling
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(HALL_LEN, HALL_W + 8), f === 0 ? floorMat : carpet);
    fl.rotation.x = -Math.PI / 2; fl.position.set(O.x, y + 0.02, O.z); fl.receiveShadow = true; dormInterior.add(fl);
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(HALL_LEN, HALL_W + 8), wallMat);
    cl.rotation.x = Math.PI / 2; cl.position.set(O.x, y + DFH - 0.1, O.z); dormInterior.add(cl);
    // side walls with doors
    for (const side of [-1, 1]) {
      const wz = O.z + side * (HALL_W / 2 + 0.2);
      for (let rIdx = 0; rIdx < ROOMS_PER_FLOOR / 2; rIdx++) {
        const x = O.x - HALL_LEN / 2 + 5 + rIdx * 11;
        // wall segments around the door
        wallSeg(O.x, wz, x, 11, y, side);
        // door
        const dr = box(2.4, 3, 0.2, doorMat, x, y + 1.5, wz - side * 0.02, { parent: dormInterior, noShadow: true });
        box(2.7, 3.2, 0.28, trimMat, x, y + 1.6, wz, { parent: dormInterior, noShadow: true });
        const num = (f + 1) * 100 + (side < 0 ? 0 : ROOMS_PER_FLOOR / 2) + rIdx + 1;   // 101..108, 201.. etc
        roomLabel(num, x, y + 2.6, wz - side * 0.35, side);
        roomDoors.push({ x, z: wz - side * 1.4, y, floor: f, num });
      }
    }
    // seal both corridor sides fully (doorways are closed doors + portals, not walkable openings)
    idBox(O.x, O.z - (HALL_W / 2 + 0.2), HALL_LEN, 0.4, y, y + DFH);
    idBox(O.x, O.z + (HALL_W / 2 + 0.2), HALL_LEN, 0.4, y, y + DFH);
    // end walls
    idBox(O.x - HALL_LEN / 2 - 0.2, O.z, 0.4, HALL_W + 8, y, y + DFH);
    idBox(O.x + HALL_LEN / 2 + 0.2, O.z, 0.4, HALL_W + 8, y, y + DFH);
    box(0.4, DFH, HALL_W + 8, wallMat, O.x - HALL_LEN / 2 - 0.2, y + DFH / 2, O.z, { parent: dormInterior, noShadow: true });
    box(0.4, DFH, HALL_W + 8, wallMat, O.x + HALL_LEN / 2 + 0.2, y + DFH / 2, O.z, { parent: dormInterior, noShadow: true });
    // ceiling lights
    for (let i = 0; i < 4; i++) { const lp = new THREE.PointLight(0xfff2d8, 8, 16, 2); lp.position.set(O.x - 16 + i * 11, y + DFH - 0.5, O.z); dormInterior.add(lp); box(2, 0.15, 0.6, std(0xfff0d0, { emissive: 0xffe6b0, emissiveIntensity: 1 }), O.x - 16 + i * 11, y + DFH - 0.2, O.z, { parent: dormInterior, noShadow: true }); }
    floorLabel(f, O.x - HALL_LEN / 2 + 1.5, y + 2.4, O.z + HALL_W / 2 + 3.6);
  }
  // elevator shaft on one end (x = O.x + HALL_LEN/2 + 3)
  const ex = O.x + HALL_LEN / 2 + 3.5;
  box(6, DFLOORS * DFH, 8, std(0x9aa0a6, { metalness: 0.3, roughness: 0.4 }), ex, DFLOORS * DFH / 2, O.z, { parent: dormInterior });
  for (let f = 0; f < DFLOORS; f++) box(3, 3, 0.3, std(0x30363c, { metalness: 0.7, roughness: 0.2 }), ex - 3, f * DFH + 1.5, O.z, { parent: dormInterior, noShadow: true });
  DORM_ELEV = { x: ex - 5, z: O.z };
}
function wallSeg(ox, wz, doorX, span, y, side) {
  const half = (span - 2.7) / 2;
  box(half, DFH, 0.3, std(0xe4ded2), doorX - (2.7 / 2 + half / 2), y + DFH / 2, wz, { parent: dormInterior, noShadow: true });
  box(half, DFH, 0.3, std(0xe4ded2), doorX + (2.7 / 2 + half / 2), y + DFH / 2, wz, { parent: dormInterior, noShadow: true });
  box(2.7, DFH - 3, 0.3, std(0xe4ded2), doorX, y + DFH - (DFH - 3) / 2, wz, { parent: dormInterior, noShadow: true });   // lintel
  idBox(doorX - (2.7 / 2 + half / 2), wz, half, 0.3, y, y + DFH);
  idBox(doorX + (2.7 / 2 + half / 2), wz, half, 0.3, y, y + DFH);
}
function roomLabel(num, x, y, z, side) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#2a2f36'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#ffd9a0'; g.font = 'bold 40px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(num), 64, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshBasicMaterial({ map: t })); m.position.set(x, y, z); m.rotation.y = side < 0 ? 0 : Math.PI; dormInterior.add(m);
}
function floorLabel(f, x, y, z) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,22,28,.85)'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#8fd0ff'; g.font = 'bold 54px Segoe UI'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FLOOR ' + (f + 1), 128, 48);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.5), new THREE.MeshBasicMaterial({ map: t, transparent: true })); m.position.set(x, y, z); dormInterior.add(m);
}
let DORM_ELEV = { x: 0, z: 0 };
buildDormInterior();



// merge interior walls into the global collision set (dorm sits far away at x~600)
colliders.push(...dormColliders);

// ---------- extension hooks (used by the merged game layer) ----------
const frameHooks = [];
function onFrame(fn) { frameHooks.push(fn); }
let interactHook = null;
function setInteractHook(fn) { interactHook = fn; }
let frozen = false;
function setFrozen(v) { frozen = v; }

// ---------- glowing entrance markers (so wide buildings show WHERE to enter) ----------
const markerMats = [];
function buildEntranceMarkers() {
  for (const b of buildings) {
    if (b.name === 'Central Park' || b.name === 'Seaside Boulevard') continue;
    const [x, z] = b.door;
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xffcf7a, emissive: 0xffb347, emissiveIntensity: 1.4, roughness: 0.4, transparent: true, opacity: 0.9 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.28, 10, 32), ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.15, z); scene.add(ring);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.16, depthWrite: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 14, 16, 1, true), beamMat);
    beam.position.set(x, 7, z); scene.add(beam);
    markerMats.push(ringMat);
  }
}
buildEntranceMarkers();

// =====================================================
//  FIRST-PERSON CONTROLLER + GAME RUNTIME
// =====================================================
const EYE = 1.7, RAD = 0.5;
const player = { x: 0, z: 44, yaw: 0, pitch: -0.02, mode: 'campus', floor: 0, floorBaseY: 0 };
camera.position.set(player.x, EYE, player.z);

const keys = {};
let locked = false, dragging = false;
const el = id => document.getElementById(id);
const hudLoc = el('loc'), hudPrompt = el('prompt'), crosshair = el('crosshair');
const portal = el('portal'), portalFrame = el('portal-frame'), elevator = el('elevator');

addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyE') interact();
  if (e.code === 'Escape') { if (portal.style.display === 'block') closePortal(); else if (player.mode === 'dorm') exitDorm(); }
});
addEventListener('keyup', e => keys[e.code] = false);

canvas.addEventListener('mousedown', e => {
  if (portal.style.display === 'block' || e.button !== 0) return;
  dragging = true; canvas.style.cursor = 'grabbing';
  if (!locked && canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (_) {} }
});
addEventListener('mouseup', () => { dragging = false; canvas.style.cursor = 'grab'; });
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; });
document.addEventListener('mousemove', e => {
  if (portal.style.display === 'block') return;
  if (locked || dragging) { player.yaw -= e.movementX * 0.0024; player.pitch = Math.max(-1.3, Math.min(1.3, player.pitch - e.movementY * 0.0024)); }
});

// ---------- interaction: nearest door within range ----------
let nearest = null;
function nearestDoor() {
  let best = null, bd = 9;
  const targets = player.mode === 'dorm' ? roomTargets() : buildings;
  for (const b of targets) {
    const d = Math.hypot(player.x - b.door[0], player.z - b.door[1]);
    if (d < bd && Math.abs((b.doorY ?? 0) - player.floorBaseY) < 2) { bd = d; best = b; }
  }
  return best;
}
function roomTargets() {
  const list = roomDoors.filter(r => r.floor === player.floor).map(r => ({ name: 'Room ' + r.num, door: [r.x, r.z], doorY: r.y, portal: WGL + 'studio-401.html' }));
  list.push({ name: 'Elevator', door: [DORM_ELEV.x, DORM_ELEV.z], doorY: player.floorBaseY, elevator: true });
  return list;
}
function interact() {
  if (portal.style.display === 'block') return;
  if (interactHook && interactHook()) return;
  const b = nearest;
  if (!b) return;
  if (b.enter === 'dorm') enterDorm();
  else if (b.elevator) toggleElevator();
  else if (b.portal) openPortal(b.portal, b.name);
}

// ---------- portals to the detailed WebGL scenes ----------
function openPortal(src, name) {
  portalFrame.src = src;
  portal.style.display = 'block';
  el('portal-title').textContent = name || '';
  if (document.pointerLockElement) document.exitPointerLock();
  elevator.style.display = 'none';
}
function closePortal() { portal.style.display = 'none'; portalFrame.src = 'about:blank'; }
el('portal-back').onclick = closePortal;

// ---------- dorm enter / exit + elevator ----------
function enterDorm() {
  player.mode = 'dorm'; player.floor = 0; player.floorBaseY = 0;
  dormInterior.visible = true;
  player.x = DORM_ELEV.x - 4; player.z = DORM_ORIGIN.z; player.yaw = -Math.PI / 2;
  showToast('Entered Dormitory Tower — use the elevator to change floors');
}
function exitDorm() {
  player.mode = 'campus'; player.floor = 0; player.floorBaseY = 0;
  dormInterior.visible = false;
  elevator.style.display = 'none';
  player.x = DORM.cx; player.z = DORM.cz + DORM.d / 2 + 9; player.yaw = Math.PI / 2;
}
function toggleElevator() { elevator.style.display = elevator.style.display === 'block' ? 'none' : 'block'; }
function gotoFloor(f) {
  player.floor = f; player.floorBaseY = f * DFH;
  player.x = DORM_ELEV.x - 4; player.z = DORM_ORIGIN.z;
  elevator.style.display = 'none';
  showToast('Floor ' + (f + 1));
}
// build the elevator floor buttons
(function elevatorUI() {
  const grid = el('elev-floors');
  for (let f = DFLOORS - 1; f >= 0; f--) {
    const btn = document.createElement('button');
    btn.textContent = f + 1; btn.onclick = () => gotoFloor(f);
    grid.appendChild(btn);
  }
  el('elev-exit').onclick = exitDorm;
})();

let toastT = 0;
function showToast(msg) { const t = el('toast'); t.textContent = msg; t.style.opacity = '1'; toastT = performance.now() + 2600; }

// ---------- movement with collision slide ----------
function tryMove(nx, nz) {
  const y = player.floorBaseY;
  if (!blocked(nx, player.z, y, RAD)) player.x = nx;
  if (!blocked(player.x, nz, y, RAD)) player.z = nz;
}

// ---------- render loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05); last = now;

  if (portal.style.display !== 'block' && !frozen) {
    const sp = (keys['ShiftLeft'] || keys['ShiftRight'] ? 12 : 6.5) * dt;
    const sinY = Math.sin(player.yaw), cosY = Math.cos(player.yaw);
    let mx = 0, mz = 0;
    if (keys['KeyW'] || keys['ArrowUp']) { mx -= sinY; mz -= cosY; }
    if (keys['KeyS'] || keys['ArrowDown']) { mx += sinY; mz += cosY; }
    if (keys['KeyA'] || keys['ArrowLeft']) { mx -= cosY; mz += sinY; }
    if (keys['KeyD'] || keys['ArrowRight']) { mx += cosY; mz -= sinY; }
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; tryMove(player.x + mx * sp, player.z + mz * sp); }
  }

  camera.position.set(player.x, player.floorBaseY + EYE, player.z);
  const dir = new THREE.Vector3(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch));
  camera.lookAt(camera.position.clone().add(dir));
  // keep the sun following the player so shadows stay crisp across the big map
  sun.position.set(player.x + 180, 300, player.z + 140); sun.target.position.set(player.x, 0, player.z);

  nearest = nearestDoor();
  if (portal.style.display === 'block') hudPrompt.style.display = 'none';
  else if (nearest) {
    hudPrompt.style.display = 'block';
    hudPrompt.innerHTML = nearest.enter === 'dorm' ? `Press <b>E</b> to enter the <b>Dormitory</b>`
      : nearest.elevator ? `Press <b>E</b> for the <b>Elevator</b>`
      : `Press <b>E</b> to enter <b>${nearest.name}</b>`;
  } else hudPrompt.style.display = 'none';

  hudLoc.textContent = player.mode === 'dorm' ? `🏢 Dormitory · Floor ${player.floor + 1}/${DFLOORS}` : '🗺️ Campus Grounds';
  if (toastT && now > toastT) { el('toast').style.opacity = '0'; toastT = 0; }

  // pulse entrance markers
  const pulse = 0.9 + Math.sin(now * 0.004) * 0.5;
  for (const m of markerMats) m.emissiveIntensity = pulse;

  // let the game layer update NPCs / weather / etc.
  for (const fn of frameHooks) fn(dt, now);

  renderer.render(scene, camera);
}

// click the on-screen prompt to enter (works even without pressing E)
hudPrompt.style.pointerEvents = 'auto';
hudPrompt.style.cursor = 'pointer';
hudPrompt.addEventListener('click', () => interact());

let started = false;
function start() { if (started) return; started = true; requestAnimationFrame(frame); }

// ---------- exports for the merged game layer ----------
export {
  THREE, scene, camera, renderer, player, EYE, RAD,
  colliders, blocked, addBox, box, std, ground, makeLabel,
  buildings, WGL, DORM, DORM_ORIGIN, DORM_ELEV, DFLOORS, DFH, dormInterior, roomDoors,
  sun, hemi, skyMat, showToast, openPortal, closePortal, enterDorm, exitDorm,
  onFrame, setInteractHook, setFrozen, start, nearestDoor
};
