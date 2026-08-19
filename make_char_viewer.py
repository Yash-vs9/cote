#!/usr/bin/env python3
# Extracts the character rig (capCache..animateRig) from game3d-campus.js into a
# standalone character-viewer.html + char-viewer.js so the characters can be seen close-up.
from pathlib import Path
src = Path('game3d-campus.js').read_text()

a = src.index('const capCache = new Map()')
# brace-match to the end of animateRig
fstart = src.index('function animateRig')
i = src.index('{', fstart); depth = 0
while True:
    ch = src[i]
    if ch == '{': depth += 1
    elif ch == '}':
        depth -= 1
        if depth == 0: break
    i += 1
rig = src[a:i+1]

viewer = '''import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ===== extracted character rig =====
''' + rig + '''

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
'''
Path('char-viewer.js').write_text(viewer)

html = '''<!DOCTYPE html><html><head><meta charset="utf-8"><title>Character Viewer</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#9fc3e0;font-family:system-ui}
#c{display:block}#hint{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);background:rgba(15,17,24,.8);color:#ffe9c7;padding:8px 16px;border-radius:20px;font-size:13px}</style></head>
<body><canvas id="c"></canvas><div id="hint">drag to orbit · scroll to zoom — Horikita / Kushida / Sudou / Kouenji / Sakura</div>
<script type="importmap">{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js", "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/" } }</script>
<script type="module" src="char-viewer.js"></script></body></html>'''
Path('character-viewer.html').write_text(html)
print("generated character-viewer.html + char-viewer.js (rig slice %d chars)" % len(rig))
