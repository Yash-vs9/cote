import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ===== extracted character rig =====
const capCache = new Map(), cylCache = new Map(), sphCache = new Map();
function geoCap(r, l) { const k = `${r},${l}`; if (!capCache.has(k)) capCache.set(k, new THREE.CapsuleGeometry(r, l, 4, 10)); return capCache.get(k); }
function geoCyl(rt, rb, h) { const k = `${rt},${rb},${h}`; if (!cylCache.has(k)) cylCache.set(k, new THREE.CylinderGeometry(rt, rb, h, 14)); return cylCache.get(k); }
function geoSph(r) { const k = `${r}`; if (!sphCache.has(k)) sphCache.set(k, new THREE.SphereGeometry(r, 18, 14)); return sphCache.get(k); }

// Cel-shading: a stepped gradient map + inverted-hull outline give the anime look.
const _toonGrad = (() => {
  const d = new Uint8Array([88, 148, 205, 255]);
  const t = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
})();
const _charMatCache = new Map();
function charMat(color) { if (!_charMatCache.has(color)) _charMatCache.set(color, new THREE.MeshToonMaterial({ color, gradientMap: _toonGrad })); return _charMatCache.get(color); }
const _charOutlineMat = new THREE.MeshBasicMaterial({ color: 0x1a1522, side: THREE.BackSide });
function addPart(parent, geo, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(geo, charMat(color));
  m.position.set(x, y, z); m.castShadow = !opts.noShadow;
  if (opts.scale) m.scale.set(...opts.scale);
  if (opts.rot) m.rotation.set(...opts.rot);
  parent.add(m);
  // outline the silhouette parts (body/head/hair/limbs) — skip tiny face details (noShadow)
  if (!opts.noShadow && !opts.noOutline) {
    const o = new THREE.Mesh(geo, _charOutlineMat);
    o.position.copy(m.position); o.rotation.copy(m.rotation);
    o.scale.set(m.scale.x * 1.07, m.scale.y * 1.07, m.scale.z * 1.07);
    parent.add(o);
  }
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
  for (const ex of [-0.048, 0.048]) {
    const g = new THREE.Group();
    g.position.set(ex, 0.01, 0.099);
    // toe the eyes slightly inward so the flat eye-disk follows the curved front face
    g.rotation.y = ex > 0 ? -0.28 : 0.28;
    head.add(g);
    // white of the eye: large, strongly flattened in z so it lies flat on the shell (front ~z0.106 = on surface)
    addPart(g, geoSph(0.033), 0xf6f7f8, 0, 0, 0, { noShadow: true, noOutline: true, scale: [0.92, 1.22, 0.22] });
    // big dark anime iris, sitting just in front of the white
    addPart(g, geoSph(0.03), cfg.eyes ?? 0x34281d, 0, -0.003, 0.004, { noShadow: true, noOutline: true, scale: [0.86, 1.18, 0.24] });
    // catch-light highlight, flattened so it hugs the iris
    addPart(g, geoSph(0.0085), 0xffffff, 0.008, 0.012, 0.011, { noShadow: true, noOutline: true, scale: [1, 1, 0.6] });
    eyes.push(g);
    // eyebrow resting on the forehead surface (z pulled back to 0.095 so it hugs, above the eye at y0.01)
    addPart(head, new THREE.BoxGeometry(0.046, 0.011, 0.012), cfg.hair, ex, 0.043, 0.095, { noShadow: true, noOutline: true, rot: [0, 0, ex > 0 ? -0.14 : 0.14] });
  }
  // subtle nose, protruding just slightly (front ~z0.120 vs surface ~0.1155)
  addPart(head, geoSph(0.011), skin, 0, -0.028, 0.112, { noShadow: true, noOutline: true, scale: [1, 1.4, 0.7] });
  // small mouth, flush on the lower face
  const mouth = addPart(head, new THREE.BoxGeometry(0.034, 0.009, 0.01), 0xa85a52, 0, -0.072, 0.099, { noShadow: true, noOutline: true });
  // ears at the true widest point of the ellipsoid (x~0.107, z~0)
  for (const ex of [-0.107, 0.107]) addPart(head, geoSph(0.024), skin, ex, -0.01, 0.0, { noShadow: true, noOutline: true, scale: [0.45, 1, 0.85] });
  return { eyes, mouth };
}

function buildHair(head, cfg) {
  const c = cfg.hair, S = cfg.hairStyle;

  // ---- SHARED BASE (covers scalp: top, back, sides; recedes behind the face front) ----
  // Scalp cap: large dome pushed up and back so its front (z~0.096) recedes behind
  // the head front (z~0.118) and never covers the eyes. Big mass -> keep outline.
  addPart(head, geoSph(0.126), c, 0, 0.03, -0.045, { scale: [1.14, 1.1, 1.12] });
  // Back-of-skull filler so the nape/lower back never shows bare scalp. Outline.
  addPart(head, geoSph(0.118), c, 0, -0.02, -0.06, { scale: [1.05, 1.0, 0.9] });
  // Forehead fringe: bottom edge ~y0.058 (above the brows at y0.043), overlapping the
  // cap front so there is no bald gap; sits in front of the forehead. Outline.
  addPart(head, new THREE.BoxGeometry(0.225, 0.06, 0.09), c, 0, 0.088, 0.072, { rot: [0.16, 0, 0] });

  if (S === 'long') {
    // Long mane down the back.
    addPart(head, new THREE.BoxGeometry(0.245, 0.46, 0.12), c, 0, -0.19, -0.07);
    addPart(head, new THREE.BoxGeometry(0.2, 0.13, 0.11), c, 0, -0.42, -0.055);
    // Side locks framing the face, lateral and in front of the ears, clear of the eyes.
    for (const ex of [-0.118, 0.118])
      addPart(head, new THREE.BoxGeometry(0.055, 0.34, 0.08), c, ex, -0.13, 0.03, { rot: [0, 0, ex > 0 ? 0.05 : -0.05] });
    // Thin fringe wisps for softness (tiny detail -> noOutline), above the eyes.
    for (const ex of [-0.06, 0.06])
      addPart(head, new THREE.BoxGeometry(0.03, 0.07, 0.02), c, ex, 0.055, 0.108, { noShadow: true, noOutline: true, rot: [0.2, 0, ex > 0 ? -0.15 : 0.15] });

  } else if (S === 'medium') {
    // Side volume hugging the sides down to the jaw.
    for (const ex of [-0.122, 0.122])
      addPart(head, new THREE.BoxGeometry(0.06, 0.26, 0.14), c, ex, -0.07, 0.0, { rot: [0, 0, ex > 0 ? 0.06 : -0.06] });
    // Back volume.
    addPart(head, new THREE.BoxGeometry(0.235, 0.24, 0.11), c, 0, -0.08, -0.065);
    // Twin low tails (Kushida). Big-ish masses -> keep outline.
    for (const ex of [-0.148, 0.148])
      addPart(head, geoCap(0.05, 0.13), c, ex, -0.18, -0.02, { rot: [0.2, 0, ex > 0 ? 0.28 : -0.28] });

  } else if (S === 'spiky') {
    // Short spikes bursting from the crown, angled up/outward; none over the face.
    for (const [sx, sy, sz, rx, rz] of [
      [-0.075, 0.145, -0.02, -0.3, 0.55],
      [0.075, 0.145, -0.02, -0.3, -0.55],
      [0.0, 0.165, 0.02, 0.15, 0.0],
      [-0.115, 0.085, 0.0, -0.05, 0.95],
      [0.115, 0.085, 0.0, -0.05, -0.95],
      [-0.05, 0.14, 0.075, 0.5, 0.35],
      [0.05, 0.14, 0.075, 0.5, -0.35],
      [0.0, 0.11, -0.11, -0.5, 0.0]
    ]) addPart(head, new THREE.ConeGeometry(0.05, 0.13, 6), c, sx, sy, sz, { rot: [rx, 0, rz] });

  } else if (S === 'slick') {
    // Swept-back quiff rising up and combing rearward off the forehead.
    addPart(head, new THREE.BoxGeometry(0.245, 0.1, 0.22), c, 0, 0.115, -0.02, { rot: [-0.28, 0, 0] });
    // Side sweeps hugging the temples, angled back.
    for (const ex of [-0.11, 0.11])
      addPart(head, new THREE.BoxGeometry(0.05, 0.17, 0.17), c, ex, 0.02, -0.03, { rot: [-0.15, 0, 0] });
    // Slicked tail at the nape.
    addPart(head, new THREE.BoxGeometry(0.2, 0.12, 0.09), c, 0, -0.06, -0.08, { rot: [0.2, 0, 0] });
  }
}

function makeRig(cfg) {
  const skin = cfg.skin ?? 0xf1c9a5, blazer = cfg.blazer ?? 0xb23440;
  const female = cfg.gender === 'f';
  const lower = cfg.lower ?? (female ? 0x2f3550 : 0x2b2f3a);
  const shirtC = 0xf3f1e9;
  const scale = cfg.height ?? 1;
  const root = new THREE.Group();
  const body = new THREE.Group(); body.scale.setScalar(scale); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.92; body.add(hips);
  addPart(hips, geoCyl(0.145, 0.125, 0.16), lower, 0, -0.05, 0, { scale: [1, 1, 0.72] });
  const torso = new THREE.Group(); hips.add(torso);

  // --- Red blazer body (big silhouette part: keep the ink outline) ---
  addPart(torso, geoCyl(0.175, 0.142, 0.5), blazer, 0, 0.25, 0, { scale: [1, 1, 0.66] });

  // --- White shirt: a NARROW vertical strip flush on the blazer front (no protruding slab) ---
  // depth 0.03 sits at z 0.09..0.12, flush with the chest surface (~0.10-0.115)
  addPart(torso, new THREE.BoxGeometry(0.11, 0.32, 0.03), shirtC, 0, 0.31, 0.105, { noShadow: true, noOutline: true });

  // --- Tie: thin dark strip riding on top of the shirt strip, centered ---
  addPart(torso, new THREE.BoxGeometry(0.035, 0.2, 0.02), cfg.tie ?? 0x24304f, 0, 0.315, 0.122, { noShadow: true, noOutline: true });
  // small knot at the collar
  addPart(torso, new THREE.BoxGeometry(0.045, 0.045, 0.022), cfg.tie ?? 0x24304f, 0, 0.44, 0.122, { noShadow: true, noOutline: true });

  // --- White collar: two angled wings flanking the neck, forming a small V at the top ---
  for (const sx of [-0.045, 0.045])
    addPart(torso, new THREE.BoxGeometry(0.085, 0.06, 0.03), shirtC, sx, 0.455, 0.1, { noShadow: true, noOutline: true, rot: [0.18, 0, sx > 0 ? -0.55 : 0.55] });

  // --- Red blazer lapels: two diagonal panels forming a V that frames the white shirt ---
  // tops are OUTWARD near the shoulders, bottoms converge toward center-chest.
  for (const sx of [-0.075, 0.075])
    addPart(torso, new THREE.BoxGeometry(0.075, 0.3, 0.032), blazer, sx, 0.32, 0.11, { noShadow: true, noOutline: true, rot: [0, 0, sx > 0 ? -0.32 : 0.32] });

  // --- Neck / collar of the blazer ---
  addPart(torso, geoCyl(0.115, 0.13, 0.1), blazer, 0, 0.5, 0, { noShadow: true, noOutline: true, scale: [1, 1, 0.7] });
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
    addPart(el, geoSph(0.048), skin, 0, -0.27, 0, { noShadow: true, scale: [1, 0.9, 0.85] });
    arms['arm' + key] = sh; arms['elbow' + key] = el;
  }
  const legs = {};
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'R' : 'L';
    const hip = segment(hips, side * 0.082, -0.06, 0, 0.078, 0.4, female ? skin : lower);
    const knee = segment(hip, 0, -0.4, 0, 0.062, 0.38, female ? skin : lower);
    if (female) addPart(knee, geoCap(0.066, 0.16), 0x2b2f3a, 0, -0.3, 0, { noShadow: true });
    const foot = addPart(knee, new THREE.BoxGeometry(0.09, 0.055, 0.2), 0x24262c, 0, -0.4, 0.045, { noShadow: true });
    legs['leg' + key] = hip; legs['knee' + key] = knee; legs['foot' + key] = foot;
  }
  if (female) addPart(hips, geoCyl(0.15, 0.245, 0.24), lower, 0, -0.16, 0, { scale: [1, 1, 0.8] });

  return { root, body, hips, torso, head, face, ...arms, ...legs, height: 1.74 * scale };
}

// Procedural Activity & Realistic Biomechanical Locomotion Engine
function animateRig(rig, a, dt) {
  a.blinkT = (a.blinkT ?? 2) - dt;
  if (a.blinkT < 0) a.blinkT = 2.4 + Math.random() * 3.5;
  const blink = a.blinkT < 0.13 ? Math.max(0.08, Math.abs(a.blinkT - 0.065) / 0.065) : 1;
  for (const e of rig.face.eyes) e.scale.y = blink;

  const damp = Math.min(1, dt * 9);
  const lerpTo = (obj, axis, target) => { obj.rotation[axis] += (target - obj.rotation[axis]) * damp; };

  const mode = a.mode || 'idle';

  if (a.moving) {
    // Biomechanical Gait Locomotion Cycle
    const p = a.phase;
    const s = Math.sin(p);
    const c = Math.cos(p);
    const stride = a.run ? 1.25 : (a.stride ?? 1.0);
    const lean = a.forwardLean ?? 0.06;
    const bounceAmp = a.bounce ?? 0.024;
    const swayAmp = a.hipSway ?? 0.018;
    const armSwing = a.armSwing ?? 0.42;

    // 1. Center of Gravity & Lateral Weight Transfer (Midstance peak bounce)
    rig.hips.position.y = 0.92 + Math.abs(Math.sin(p * 2)) * bounceAmp;
    rig.hips.position.x += (s * swayAmp - rig.hips.position.x) * damp;

    // 2. Pelvic List (Roll) & Pelvic Rotation (Yaw)
    rig.hips.rotation.z = -c * 0.038;
    rig.hips.rotation.y = s * 0.11;

    // 3. Counter Torso Rotation & Spine Compensation
    rig.torso.rotation.x = lean;
    rig.torso.rotation.y = -s * 0.085;
    rig.torso.rotation.z = c * 0.028;

    // 4. Legs: Hip, Knee, and Ankle Articulation
    // Left Leg
    rig.legL.rotation.x = s * 0.54 * stride;
    rig.kneeL.rotation.x = Math.max(0, -Math.sin(p + 0.65)) * 1.05 * stride;
    rig.footL.rotation.x = s > 0.2 ? -0.22 : (s < -0.35 ? 0.32 : 0);

    // Right Leg (opposite phase)
    rig.legR.rotation.x = -s * 0.54 * stride;
    rig.kneeR.rotation.x = Math.max(0, -Math.sin(p + 0.65 + Math.PI)) * 1.05 * stride;
    rig.footR.rotation.x = s < -0.2 ? -0.22 : (s > 0.35 ? 0.32 : 0);

    // 5. Arms: Pendulum Swing with Forearm Lag & Elbow Flexion
    rig.armL.rotation.x = -s * armSwing * stride;
    rig.armR.rotation.x = s * armSwing * stride;
    rig.armL.rotation.z = 0.07;
    rig.armR.rotation.z = -0.07;

    rig.elbowL.rotation.x = -0.22 - Math.max(0, -s) * 0.48;
    rig.elbowR.rotation.x = -0.22 - Math.max(0, s) * 0.48;

    // 6. Centrifugal Banking when turning
    const bank = a.banking ?? 0;
    rig.body.rotation.z += (bank - rig.body.rotation.z) * damp;
    rig.body.rotation.x = 0;
  } else if (mode === 'sit_desk') {
    // Seated Desk Pose (Classroom study / note writing)
    rig.hips.position.y += (0.48 - rig.hips.position.y) * damp;
    rig.hips.position.x += (0 - rig.hips.position.x) * damp;
    rig.body.rotation.z += (0 - rig.body.rotation.z) * damp;
    lerpTo(rig.legL, 'x', -1.57); lerpTo(rig.legR, 'x', -1.57);
    lerpTo(rig.kneeL, 'x', 1.57); lerpTo(rig.kneeR, 'x', 1.57);
    lerpTo(rig.footL, 'x', 0); lerpTo(rig.footR, 'x', 0);
    lerpTo(rig.torso, 'x', 0.08); lerpTo(rig.torso, 'y', 0); lerpTo(rig.torso, 'z', 0);
    lerpTo(rig.armL, 'x', -0.55); lerpTo(rig.armL, 'z', 0.22);
    lerpTo(rig.elbowL, 'x', -0.9);
    const write = Math.sin(a.idleT * 6.0) * 0.05;
    lerpTo(rig.armR, 'x', -0.55 + write); lerpTo(rig.armR, 'z', -0.22);
    lerpTo(rig.elbowR, 'x', -0.9 + write);
    rig.face.mouth.scale.y += (1 - rig.face.mouth.scale.y) * damp;
  } else if (mode === 'teach_lecture') {
    // Teacher podium lecturing pose
    rig.hips.position.y += (0.92 - rig.hips.position.y) * damp;
    rig.hips.position.x += (0 - rig.hips.position.x) * damp;
    rig.body.rotation.z += (0 - rig.body.rotation.z) * damp;
    for (const j of ['legL', 'legR', 'kneeL', 'kneeR', 'footL', 'footR']) lerpTo(rig[j], 'x', 0);
    lerpTo(rig.armL, 'x', -0.5); lerpTo(rig.elbowL, 'x', -0.7);
    const swing = Math.sin(a.idleT * 1.8) * 0.35;
    lerpTo(rig.armR, 'x', -0.4 + swing); lerpTo(rig.armR, 'z', -0.3);
    lerpTo(rig.elbowR, 'x', -0.8 + swing * 0.5);
    rig.face.mouth.scale.y = 1 + Math.abs(Math.sin(a.idleT * 3)) * 1.4;
  } else if (mode === 'sit_eat') {
    // Seated Dining / Eating Pose
    rig.hips.position.y += (0.48 - rig.hips.position.y) * damp;
    rig.hips.position.x += (0 - rig.hips.position.x) * damp;
    rig.body.rotation.z += (0 - rig.body.rotation.z) * damp;
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
    rig.hips.position.x += (0 - rig.hips.position.x) * damp;
    rig.body.rotation.z += (0 - rig.body.rotation.z) * damp;
    lerpTo(rig.legL, 'x', -1.57); lerpTo(rig.legR, 'x', -1.57);
    lerpTo(rig.kneeL, 'x', 1.57); lerpTo(rig.kneeR, 'x', 1.57);
    lerpTo(rig.torso, 'x', 0.12); lerpTo(rig.torso, 'y', 0); lerpTo(rig.torso, 'z', 0);
    lerpTo(rig.armL, 'x', -0.45); lerpTo(rig.armR, 'x', -0.45);
    lerpTo(rig.elbowL, 'x', -1.0); lerpTo(rig.elbowR, 'x', -1.0);
    lerpTo(rig.head, 'x', 0.35);
  } else if (mode === 'sport_drill') {
    // Athletic Court / Field Practice
    rig.hips.position.y += (0.85 - rig.hips.position.y) * damp;
    rig.hips.position.x += (0 - rig.hips.position.x) * damp;
    rig.body.rotation.z += (0 - rig.body.rotation.z) * damp;
    lerpTo(rig.legL, 'x', -0.2); lerpTo(rig.legR, 'x', 0.2);
    lerpTo(rig.kneeL, 'x', 0.4); lerpTo(rig.kneeR, 'x', 0.4);
    const dribble = Math.sin(a.idleT * 8.0) * 0.35;
    lerpTo(rig.armR, 'x', -0.3 + dribble); lerpTo(rig.elbowR, 'x', -0.7 + dribble);
    lerpTo(rig.armL, 'x', -0.2); lerpTo(rig.elbowL, 'x', -0.4);
  } else {
    // Default Natural Human Idle (Breathing, Posture Shifts & Subtle Sway)
    for (const j of ['legL', 'legR', 'kneeL', 'kneeR', 'armL', 'armR', 'footL', 'footR']) lerpTo(rig[j], 'x', 0);
    lerpTo(rig.elbowL, 'x', -0.16); lerpTo(rig.elbowR, 'x', -0.16);
    lerpTo(rig.torso, 'x', 0); lerpTo(rig.torso, 'y', 0); lerpTo(rig.hips, 'y', 0);
    rig.body.rotation.z += (0 - rig.body.rotation.z) * damp;

    // Natural Respiration (Breathing cycle)
    const breathe = Math.sin(a.idleT * 1.4) * 0.007;
    rig.hips.position.y += (0.92 + breathe - rig.hips.position.y) * damp;

    // Natural Weight Shifting between feet every 5-7s
    const weightShift = Math.sin(a.idleT * 0.38);
    rig.hips.position.x += (weightShift * 0.022 - rig.hips.position.x) * damp;
    rig.hips.rotation.z += (weightShift * 0.032 - rig.hips.rotation.z) * damp;
    rig.torso.rotation.z += (-weightShift * 0.024 - rig.torso.rotation.z) * damp;
    rig.armL.rotation.z += (0.08 + weightShift * 0.02 - rig.armL.rotation.z) * damp;
    rig.armR.rotation.z += (-0.08 + weightShift * 0.02 - rig.armR.rotation.z) * damp;

    if (a.talk) {
      const g = Math.sin(a.idleT * 3.1);
      rig.armR.rotation.x += (-0.45 - g * 0.22 - rig.armR.rotation.x) * damp;
      rig.elbowR.rotation.x += (-0.85 + g * 0.25 - rig.elbowR.rotation.x) * damp;
      rig.face.mouth.scale.y = 1 + Math.abs(Math.sin(a.idleT * 9)) * 2.2;
    } else rig.face.mouth.scale.y += (1 - rig.face.mouth.scale.y) * damp;
  }

  if (mode !== 'sit_read') {
    const wantY = a.lookAt ?? Math.sin(a.idleT * 0.45) * 0.18;
    const wantX = a.lookPitch ?? (Math.sin(a.idleT * 0.3) * 0.05);
    rig.head.rotation.y += (Math.max(-1.1, Math.min(1.1, wantY)) - rig.head.rotation.y) * Math.min(1, dt * 5.5);
    rig.head.rotation.x += (Math.max(-0.5, Math.min(0.5, wantX)) - rig.head.rotation.x) * Math.min(1, dt * 5.5);
  }
}

// ===== viewer scaffold =====
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9fc3e0);
const camera = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, 0.1, 100);
camera.position.set(0, 1.35, 4.2);
const controls = new OrbitControls(camera, canvas); controls.target.set(0, 1.15, 0); controls.enableDamping = true;
addEventListener('resize', () => { camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
scene.add(new THREE.HemisphereLight(0xeef7ff, 0x8a9890, 1.1));
const sun = new THREE.DirectionalLight(0xfff6e5, 2.2); sun.position.set(3, 6, 4); sun.castShadow = true;
sun.shadow.mapSize.set(1024,1024); scene.add(sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(6, 40), new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 1 }));
ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);

function nameplate(text, x) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d');
  g.fillStyle = 'rgba(15,17,24,.82)'; g.fillRect(0,0,256,64); g.font = 'bold 30px Segoe UI'; g.fillStyle = '#ffe9c7';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 32);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true })); s.position.set(x, 2.15, 0); s.scale.set(1.2, 0.3, 1); scene.add(s);
}

const CFG = [
  ['Horikita', { hair:0x15151f, hairStyle:'long',  gender:'f', skin:0xf3d0b3, tie:0x8a2b3a, height:0.97 }, true],
  ['Kushida',  { hair:0x22305a, hairStyle:'medium',gender:'f', skin:0xf7d9bd, tie:0x8a2b3a, height:0.95 }, false],
  ['Sudou',    { hair:0x9b2618, hairStyle:'spiky', gender:'m', skin:0xecc39c, tie:0x2b4a8a, height:1.06 }, true],
  ['Kouenji',  { hair:0xd9b44a, hairStyle:'slick', gender:'m', skin:0xf1c9a5, tie:0x2b4a8a, height:1.05 }, false],
  ['Sakura',   { hair:0xf472b6, hairStyle:'long',  gender:'f', skin:0xf6d9c0, tie:0x8a2b3a, height:0.95 }, false],
];
const chars = [];
CFG.forEach(([name, cfg, walking], idx) => {
  const x = (idx - (CFG.length - 1) / 2) * 1.5;
  const rigObj = makeRig(cfg); rigObj.root.position.set(x, 0, 0); rigObj.root.rotation.y = Math.PI; scene.add(rigObj.root);
  rigObj.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  nameplate(name, x);
  chars.push({ rig: rigObj, anim: { moving: walking, phase: Math.random()*6, idleT: Math.random()*5, blinkT: Math.random()*4, mode: walking?'walk':'idle' } });
});

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  for (const ch of chars) { if (ch.anim.moving) ch.anim.phase += dt * 6; ch.anim.idleT += dt; animateRig(ch.rig, ch.anim, dt); }
  controls.update(); renderer.render(scene, camera);
}
loop();
