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
let canTalk = apiKey.length > 0;
let stats = load('cote3dStats', { ...BASE_STATS });
let memory = load('cote3dConvos', {});
let story = load('cote3dStory', { i: -1, active: false, narrated: {} });
let storyConvo = load('cote3dStoryConvo', []);

function load(key, def) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? def; } catch { return def; } }
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.warn(e); } }
function toChatMessages(msgs) {
  return msgs.map(m => {
    const role = (m.role === 'model' || m.role === 'assistant') ? 'assistant' : 'user';
    let content = m.parts?.[0]?.text ?? (typeof m.content === 'string' ? m.content : '');
    if (role === 'assistant') {
      try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed.text === 'string') content = parsed.text;
      } catch {}
    }
    return { role, content };
  });
}

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

// =========================================================================
// CAMPUS PROCEDURAL WEB AUDIO SOUND ENGINE (HIGH-FIDELITY SFX & BIOMES)
// =========================================================================
export const CampusAudioEngine = {
  ctx: null,
  masterGain: null,
  sfxGain: null,
  ambGain: null,
  reverbNode: null,
  reverbGain: null,
  indoorFilter: null,
  isMuted: load('cote3dAudioMuted', false),
  volume: load('cote3dAudioVol', 0.85),
  sfxVol: load('cote3dSFXVol', 0.85),
  ambVol: load('cote3dAmbVol', 0.65),
  initialized: false,

  // Biome Nodes
  fountainNode: null,
  fountainGain: null,
  oceanNode: null,
  oceanGain: null,
  rainNode: null,
  rainGain: null,
  windNode: null,
  windGain: null,
  cricketNode: null,
  cricketGain: null,

  // Footstep Tracking
  footstepTimer: 0,
  footstepSide: 0, // 0 = left, 1 = right
  _lastThunder: 0,
  _isIndoors: false,

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Master Bus
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);

      // SFX Bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVol;
      this.sfxGain.connect(this.masterGain);

      // Ambiance Bus & Indoor Occlusion Lowpass Filter
      this.ambGain = this.ctx.createGain();
      this.ambGain.gain.value = this.ambVol;

      this.indoorFilter = this.ctx.createBiquadFilter();
      this.indoorFilter.type = 'lowpass';
      this.indoorFilter.frequency.value = 20000; // Open by default
      this.indoorFilter.connect(this.ambGain);
      this.ambGain.connect(this.masterGain);

      // Procedural Acoustic Courtyard Reverb Bus (0.85s RT60)
      this.initProceduralReverb();

      // Spatial Biomes Generator
      this.initAmbianceGenerators();
      this.initialized = true;
    } catch (e) {
      console.warn('CampusAudioEngine init error:', e);
    }
  },

  initProceduralReverb() {
    if (!this.ctx) return;
    try {
      const rate = this.ctx.sampleRate;
      const length = Math.floor(rate * 0.9); // 0.9s impulse
      const impulse = this.ctx.createBuffer(2, length, rate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);

      for (let i = 0; i < length; i++) {
        const decay = Math.exp(-i / (rate * 0.22));
        left[i] = (Math.random() * 2 - 1) * decay;
        right[i] = (Math.random() * 2 - 1) * decay;
      }

      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = impulse;

      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.value = 0.28;
      this.reverbNode.connect(this.reverbGain);
      this.reverbGain.connect(this.masterGain);
    } catch (e) {
      console.warn('Procedural reverb creation error:', e);
    }
  },

  resumeOnGesture() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  },

  toggleMute() {
    this.resumeOnGesture();
    this.isMuted = !this.isMuted;
    save('cote3dAudioMuted', this.isMuted);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  },

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    save('cote3dAudioVol', this.volume);
    if (this.masterGain && !this.isMuted && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  },

  setSFXVolume(vol) {
    this.sfxVol = Math.max(0, Math.min(1, vol));
    save('cote3dSFXVol', this.sfxVol);
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVol, this.ctx.currentTime, 0.05);
    }
  },

  setAmbVolume(vol) {
    this.ambVol = Math.max(0, Math.min(1, vol));
    save('cote3dAmbVol', this.ambVol);
    if (this.ambGain && this.ctx) {
      this.ambGain.gain.setTargetAtTime(this.ambVol, this.ctx.currentTime, 0.05);
    }
  },

  // 1. Westminster School Period Bell Chimes (Tubular Bell Physical Synthesis)
  playWestminsterChime() {
    if (this.isMuted) return;
    this.resumeOnGesture();
    if (!this.ctx) return;
    const now = this.ctx.currentTime + 0.05;

    // 4 Notes: E4 (329.63), G4 (392.00), F4 (349.23), B3 (246.94)
    const notes = [
      { freq: 329.63, time: 0.00, pan: -0.15 },
      { freq: 392.00, time: 0.55, pan: 0.15 },
      { freq: 349.23, time: 1.10, pan: -0.10 },
      { freq: 246.94, time: 1.65, pan: 0.10 }
    ];

    notes.forEach(n => {
      const startTime = now + n.time;
      const duration = 2.4;

      // Stereo Panner
      let panner = null;
      if (this.ctx.createStereoPanner) {
        panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(n.pan, startTime);
      }

      // 1. Strike transient (clapper impact noise)
      const strikeBuf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.015), this.ctx.sampleRate);
      const strikeData = strikeBuf.getChannelData(0);
      for (let i = 0; i < strikeData.length; i++) strikeData[i] = Math.random() * 2 - 1;
      const strikeSource = this.ctx.createBufferSource();
      strikeSource.buffer = strikeBuf;
      const strikeFilter = this.ctx.createBiquadFilter();
      strikeFilter.type = 'bandpass';
      strikeFilter.frequency.setValueAtTime(2400, startTime);
      strikeFilter.Q.setValueAtTime(3.0, startTime);
      const strikeGain = this.ctx.createGain();
      strikeGain.gain.setValueAtTime(0.35, startTime);
      strikeGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.02);
      strikeSource.connect(strikeFilter);
      strikeFilter.connect(strikeGain);

      // 2. Fundamental & Overtones (1.0, 2.002, 2.756, 5.404)
      const partials = [
        { mult: 1.0, gain: 0.40, decay: duration },
        { mult: 2.002, gain: 0.22, decay: duration * 0.85 },
        { mult: 2.756, gain: 0.15, decay: duration * 0.70 },
        { mult: 5.404, gain: 0.08, decay: duration * 0.45 }
      ];

      const noteSumGain = this.ctx.createGain();
      noteSumGain.gain.setValueAtTime(1.0, startTime);

      partials.forEach(p => {
        const osc = this.ctx.createOscillator();
        osc.type = p.mult === 1.0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(n.freq * p.mult, startTime);

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, startTime);
        g.gain.exponentialRampToValueAtTime(p.gain, startTime + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, startTime + p.decay);

        osc.connect(g);
        g.connect(noteSumGain);
        osc.start(startTime);
        osc.stop(startTime + p.decay);
      });

      strikeGain.connect(noteSumGain);

      if (panner) {
        noteSumGain.connect(panner);
        panner.connect(this.sfxGain);
        if (this.reverbNode) panner.connect(this.reverbNode);
      } else {
        noteSumGain.connect(this.sfxGain);
        if (this.reverbNode) noteSumGain.connect(this.reverbNode);
      }

      strikeSource.start(startTime);
      strikeSource.stop(startTime + 0.03);
    });
  },

  // 2. Hyper-Realistic Material Footstep Engine
  detectSurface(x, z) {
    if (x >= -68 && x <= -56 && z >= -25 && z <= -15) return 'wood'; // Class 1-D
    if (x >= -70 && x <= -44 && z >= 10 && z <= 34) return 'wood';   // Library
    if (x >= 34 && x <= 68 && z >= 10 && z <= 34) return 'wood';     // Gymnasium
    if (x >= -30 && x <= 30 && z >= -69 && z <= -43) return 'tile';  // Academic Hall
    if (x >= 34 && x <= 68 && z >= -34 && z <= -10) return 'tile';   // Cafeteria
    if (z >= 34 && x >= 20) return 'tile';                           // Commercial Mall / Café
    if (z <= -100) return 'gravel';                                  // Seaside Promenade
    if (x >= -24 && x <= 24 && z >= -18 && z <= 32) return 'grass';  // Courtyard & Park
    return 'concrete';
  },

  checkIndoors(x, z) {
    // Class 1-D, Library, Gym, Academic Hall, Cafeteria, Keyaki Mall
    if (x >= -72 && x <= -40 && z >= -28 && z <= 36) return true;
    if (x >= 30 && x <= 72 && z >= -36 && z <= 36) return true;
    if (x >= -32 && x <= 32 && z >= -72 && z <= -40) return true;
    if (x >= 18 && x <= 72 && z >= 40 && z <= 95) return true;
    return false;
  },

  playFootstep(surface, isSprint, rainIntensity) {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.footstepSide = 1 - this.footstepSide;
    const panVal = this.footstepSide === 0 ? -0.22 : 0.22;
    const pitchJitter = 0.96 + Math.random() * 0.08;

    let panner = null;
    if (this.ctx.createStereoPanner) {
      panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(panVal, now);
    }

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.06);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.playbackRate.setValueAtTime(pitchJitter, now);

    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    if (surface === 'wood') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime((isSprint ? 1450 : 1150) * pitchJitter, now);
      filter.Q.setValueAtTime(2.4, now);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    } else if (surface === 'grass') {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700 * pitchJitter, now);
      gain.gain.setValueAtTime(0.19, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    } else if (surface === 'gravel') {
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1900 * pitchJitter, now);
      gain.gain.setValueAtTime(0.23, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    } else if (surface === 'tile') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime((isSprint ? 3200 : 2700) * pitchJitter, now);
      filter.Q.setValueAtTime(3.2, now);
      gain.gain.setValueAtTime(0.29, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);
    } else { // Concrete
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime((isSprint ? 2200 : 1800) * pitchJitter, now);
      filter.Q.setValueAtTime(1.8, now);
      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.048);
    }

    // Low-frequency heel thump
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime((surface === 'wood' ? 175 : 120) * pitchJitter, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.04);
    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.16, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    noise.connect(filter);
    filter.connect(gain);
    osc.connect(oscGain);

    const stepOut = this.ctx.createGain();
    gain.connect(stepOut);
    oscGain.connect(stepOut);

    // Wet puddle splash layer during rain
    if (rainIntensity > 0.18) {
      const splashFilter = this.ctx.createBiquadFilter();
      splashFilter.type = 'highpass';
      splashFilter.frequency.setValueAtTime(3400, now);
      const splashGain = this.ctx.createGain();
      splashGain.gain.setValueAtTime(0.14 * Math.min(1, rainIntensity), now);
      splashGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      noise.connect(splashFilter);
      splashFilter.connect(splashGain);
      splashGain.connect(stepOut);
    }

    if (panner) {
      stepOut.connect(panner);
      panner.connect(this.sfxGain);
      if (this.reverbNode && (surface === 'tile' || surface === 'wood')) {
        panner.connect(this.reverbNode);
      }
    } else {
      stepOut.connect(this.sfxGain);
      if (this.reverbNode && (surface === 'tile' || surface === 'wood')) {
        stepOut.connect(this.reverbNode);
      }
    }

    noise.start(now);
    noise.stop(now + 0.07);
    osc.start(now);
    osc.stop(now + 0.05);
  },

  stepFootstep(dt, isMoving, isSprint, x, z, rainIntensity) {
    if (!isMoving) {
      this.footstepTimer = 0;
      return;
    }
    const interval = isSprint ? 0.28 : 0.44;
    this.footstepTimer += dt;
    if (this.footstepTimer >= interval) {
      this.footstepTimer = 0;
      const surface = this.detectSurface(x, z);
      this.playFootstep(surface, isSprint, rainIntensity);
    }
  },

  // 3. Continuous Spatial Ambiance Generator
  initAmbianceGenerators() {
    if (!this.ctx) return;
    const bufSize = this.ctx.sampleRate * 2;
    const pinkBuf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const out = pinkBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
      b6 = white * 0.115926;
    }

    // 1. Fountain Ambiance (Central Park)
    this.fountainNode = this.ctx.createBufferSource();
    this.fountainNode.buffer = pinkBuf;
    this.fountainNode.loop = true;
    const fFilter = this.ctx.createBiquadFilter();
    fFilter.type = 'bandpass';
    fFilter.frequency.value = 1100;
    fFilter.Q.value = 0.8;
    this.fountainGain = this.ctx.createGain();
    this.fountainGain.gain.value = 0;
    this.fountainNode.connect(fFilter);
    fFilter.connect(this.fountainGain);
    this.fountainGain.connect(this.indoorFilter);
    try { this.fountainNode.start(0); } catch {}

    // 2. Ocean Waves (Seaside Boulevard)
    this.oceanNode = this.ctx.createBufferSource();
    this.oceanNode.buffer = pinkBuf;
    this.oceanNode.loop = true;
    const oFilter = this.ctx.createBiquadFilter();
    oFilter.type = 'lowpass';
    oFilter.frequency.value = 420;
    this.oceanGain = this.ctx.createGain();
    this.oceanGain.gain.value = 0;
    this.oceanNode.connect(oFilter);
    oFilter.connect(this.oceanGain);
    this.oceanGain.connect(this.indoorFilter);
    try { this.oceanNode.start(0); } catch {}

    // 3. Rain Loop
    this.rainNode = this.ctx.createBufferSource();
    this.rainNode.buffer = pinkBuf;
    this.rainNode.loop = true;
    const rFilter = this.ctx.createBiquadFilter();
    rFilter.type = 'bandpass';
    rFilter.frequency.value = 1600;
    rFilter.Q.value = 0.5;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0;
    this.rainNode.connect(rFilter);
    rFilter.connect(this.rainGain);
    this.rainGain.connect(this.indoorFilter);
    try { this.rainNode.start(0); } catch {}

    // 4. Wind Breeze Loop
    this.windNode = this.ctx.createBufferSource();
    this.windNode.buffer = pinkBuf;
    this.windNode.loop = true;
    const wFilter = this.ctx.createBiquadFilter();
    wFilter.type = 'lowpass';
    wFilter.frequency.value = 350;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    this.windNode.connect(wFilter);
    wFilter.connect(this.windGain);
    this.windGain.connect(this.indoorFilter);
    try { this.windNode.start(0); } catch {}

    // 5. Japanese Summer Evening Cicadas & Crickets (Dusk / Night)
    this.cricketGain = this.ctx.createGain();
    this.cricketGain.gain.value = 0;
    this.cricketGain.connect(this.indoorFilter);
  },

  updateAmbiance(dt, px, pz, rainLevel, flash, clockMinute) {
    if (!this.initialized || this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Indoor vs Outdoor Occlusion Filter Transition
    const indoors = this.checkIndoors(px, pz);
    if (indoors !== this._isIndoors) {
      this._isIndoors = indoors;
      const targetCutoff = indoors ? 650 : 20000;
      this.indoorFilter.frequency.setTargetAtTime(targetCutoff, now, 0.35);
    }

    // Fountain distance from (0, 8)
    const distFount = Math.hypot(px - 0, pz - 8);
    const targetFountGain = Math.max(0, Math.min(0.35, (1 - distFount / 45) * 0.35));
    if (this.fountainGain) {
      this.fountainGain.gain.setTargetAtTime(targetFountGain, now, 0.2);
    }

    // Ocean distance from (0, -140)
    const distOcean = Math.hypot(px - 0, pz - (-140));
    const waveCycle = Math.sin(now * 1.15) * 0.5 + 0.5;
    const targetOceanGain = Math.max(0, Math.min(0.42, (1 - distOcean / 95) * (0.22 + 0.2 * waveCycle)));
    if (this.oceanGain) {
      this.oceanGain.gain.setTargetAtTime(targetOceanGain, now, 0.2);
    }

    // Rain intensity
    const targetRainGain = Math.min(0.52, (rainLevel || 0) * 0.42);
    if (this.rainGain) {
      this.rainGain.gain.setTargetAtTime(targetRainGain, now, 0.2);
    }

    // Wind breeze intensity (higher in storms and sunsets)
    const targetWind = (rainLevel > 0.5 ? 0.28 : 0.08) * (Math.sin(now * 0.4) * 0.3 + 0.7);
    if (this.windGain) {
      this.windGain.gain.setTargetAtTime(targetWind, now, 0.4);
    }

    // Evening / Night Crickets (18:30 to 05:30)
    const isNightAmbiance = (clockMinute >= 1110 || clockMinute < 330) && !indoors;
    if (isNightAmbiance && Math.random() < dt * 1.2 && now - (this._lastCricket || 0) > 1.8) {
      this._lastCricket = now;
      this.playCricketChirp();
    }

    // Physics-Based Thunder crackle with speed of sound delay
    if (flash > 0.8 && (!this._lastThunder || now - this._lastThunder > 4.5)) {
      this._lastThunder = now;
      const strikeDist = 100 + Math.random() * 400; // 100m to 500m
      const soundDelay = strikeDist / 340; // ~0.3s to 1.5s delay
      setTimeout(() => { this.playThunder(strikeDist); }, soundDelay * 1000);
    }
  },

  playCricketChirp() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(4600 + Math.random() * 300, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.035;
      gain.gain.setValueAtTime(0.045, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    }

    osc.connect(gain);
    gain.connect(this.ambGain);
    osc.start(now);
    osc.stop(now + 0.14);
  },

  playThunder(dist = 250) {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(75, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 1.8);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.max(60, 220 - dist * 0.3), now);

    const gain = this.ctx.createGain();
    const vol = Math.max(0.15, Math.min(0.55, 1.0 - dist / 600));
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    if (this.reverbNode) gain.connect(this.reverbNode);

    osc.start(now);
    osc.stop(now + 2.2);
  },

  // 4. Interactive UI Sound Effects
  playUIClick() {
    if (this.isMuted || !this.ctx) return;
    this.resumeOnGesture();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.04);
  },

  playDialogueChirp() {
    if (this.isMuted || !this.ctx) return;
    this.resumeOnGesture();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.045);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.055);
  },

  playObjectiveJingle() {
    if (this.isMuted || !this.ctx) return;
    this.resumeOnGesture();
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      const startTime = now + idx * 0.10;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      if (this.reverbNode) gain.connect(this.reverbNode);
      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
  }
};
window.CampusAudioEngine = CampusAudioEngine;

const audioChip = document.createElement('div');
audioChip.style.cssText = 'background:rgba(13,16,24,.88);border:1px solid var(--border);border-radius:10px;padding:8px 14px;font-size:13px;backdrop-filter:blur(10px);pointer-events:auto;cursor:pointer;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.5);';
audioChip.title = 'Campus SFX & Chimes on/off (K)';
function refreshAudioChip() { audioChip.textContent = CampusAudioEngine.isMuted ? '🔇 SFX Muted' : '🔊 SFX on'; }
function toggleAudio() {
  CampusAudioEngine.toggleMute();
  refreshAudioChip();
  const btn = $('atm-mute-btn');
  if (btn) btn.textContent = CampusAudioEngine.isMuted ? '🔇 SFX: Muted' : '🔊 SFX: ON';
  showToast(CampusAudioEngine.isMuted ? '🔇 Campus SFX muted' : '🔊 Campus SFX on', 2200);
}
audioChip.onclick = toggleAudio;
refreshAudioChip();
$('topright').appendChild(audioChip);

const studioChip = document.createElement('div');
studioChip.style.cssText = 'background:rgba(13,16,24,.88);border:1px solid var(--border);border-radius:10px;padding:8px 14px;font-size:13px;backdrop-filter:blur(10px);pointer-events:auto;cursor:pointer;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.5);';
studioChip.title = 'Open Atmosphere & Audio Studio (F4)';
studioChip.innerHTML = '🎛️ Studio';
function toggleAtmosphereStudio() {
  const p = $('atmosphere-panel');
  if (p) p.style.display = (p.style.display === 'flex' ? 'none' : 'flex');
}
studioChip.onclick = toggleAtmosphereStudio;
$('topright').appendChild(studioChip);
window.toggleAtmosphereStudio = toggleAtmosphereStudio;

function initAtmosphereStudio() {
  const p = $('atmosphere-panel');
  const closeBtn = $('atm-close');
  if (closeBtn) closeBtn.onclick = () => { if (p) p.style.display = 'none'; };

  const timeSlider = $('atm-time-slider');
  const timeVal = $('atm-time-val');
  if (timeSlider) {
    timeSlider.oninput = (e) => {
      const h = parseFloat(e.target.value);
      const hh = String(Math.floor(h)).padStart(2, '0');
      const mm = String(Math.floor((h % 1) * 60)).padStart(2, '0');
      if (timeVal) timeVal.textContent = `${hh}:${mm}`;
      window.skipToTime(h);
    };
  }

  const masterSlider = $('atm-master-slider');
  const masterVal = $('atm-master-val');
  if (masterSlider) {
    masterSlider.oninput = (e) => {
      const v = parseFloat(e.target.value);
      if (masterVal) masterVal.textContent = `${Math.round(v * 100)}%`;
      CampusAudioEngine.setVolume(v);
    };
  }

  const sfxSlider = $('atm-sfx-slider');
  const sfxVal = $('atm-sfx-val');
  if (sfxSlider) {
    sfxSlider.oninput = (e) => {
      const v = parseFloat(e.target.value);
      if (sfxVal) sfxVal.textContent = `${Math.round(v * 100)}%`;
      CampusAudioEngine.setSFXVolume(v);
    };
  }

  const ambSlider = $('atm-amb-slider');
  const ambVal = $('atm-amb-val');
  if (ambSlider) {
    ambSlider.oninput = (e) => {
      const v = parseFloat(e.target.value);
      if (ambVal) ambVal.textContent = `${Math.round(v * 100)}%`;
      CampusAudioEngine.setAmbVolume(v);
    };
  }
}
window.toggleAudioStudioMute = toggleAudio;

// Emissive Lamp & Night Lighting Management
const campusNightLamps = [];
const campusNightWindows = [];
const campusNightPointLights = [];

export function registerNightEmissive(mesh, type = 'lamp') {
  if (!mesh) return;
  if (type === 'lamp') campusNightLamps.push(mesh);
  else if (type === 'window') campusNightWindows.push(mesh);
}
export function registerNightLight(light) {
  if (light) campusNightPointLights.push(light);
}

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
renderer.toneMappingExposure = 1.16;
renderer.outputColorSpace = THREE.SRGBColorSpace;
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
  uniforms: { topC: { value: new THREE.Color(0x4a93e0) }, botC: { value: new THREE.Color(0xe9f3fb) } },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 topC; uniform vec3 botC; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*0.5+0.5, 0.0, 1.0); gl_FragColor = vec4(mix(botC, topC, pow(h, 0.75)), 1.0); }',
  side: THREE.BackSide, depthWrite: false, fog: false
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(650, 32, 16), skyMat);
scene.add(skyDome);

// Celestial Sun and Moon Objects
const celestialGroup = new THREE.Group();
scene.add(celestialGroup);

// Visible Sun Mesh & Corona Glow
const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffae0, fog: false });
const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 16), sunMat);
celestialGroup.add(sunMesh);

const sunGlowMat = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(0xffd580) } },
  vertexShader: 'varying vec3 vNorm; void main(){ vNorm = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 uColor; varying vec3 vNorm; void main(){ float i = pow(0.65 - dot(vNorm, vec3(0, 0, 1.0)), 2.0); gl_FragColor = vec4(uColor, i * 0.85); }',
  side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false
});
const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(22, 16, 16), sunGlowMat);
sunMesh.add(sunGlow);

// Visible Moon Mesh & Ethereal Corona Glow
const moonMat = new THREE.MeshBasicMaterial({ color: 0xd8e6ff, fog: false });
const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(11, 16, 16), moonMat);
celestialGroup.add(moonMesh);

const moonGlowMat = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(0x93c5fd) } },
  vertexShader: 'varying vec3 vNorm; void main(){ vNorm = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 uColor; varying vec3 vNorm; void main(){ float i = pow(0.7 - dot(vNorm, vec3(0, 0, 1.0)), 2.2); gl_FragColor = vec4(uColor, i * 0.7); }',
  side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false
});
const moonGlow = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 16), moonGlowMat);
moonMesh.add(moonGlow);

// Twinkling Celestial Starfield (1000 Stars)
const STAR_COUNT = 1000;
const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(STAR_COUNT * 3);
const starSizes = new Float32Array(STAR_COUNT);
const starPhases = new Float32Array(STAR_COUNT);

for (let i = 0; i < STAR_COUNT; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(Math.random() * 0.92 + 0.08);
  const r = 620;
  starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = r * Math.cos(phi);
  starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  starSizes[i] = 1.5 + Math.random() * 2.5;
  starPhases[i] = Math.random() * Math.PI * 2;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));

const starMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uOpacity: { value: 0 }
  },
  vertexShader: `
    uniform float uTime;
    attribute float aSize;
    attribute float aPhase;
    varying float vAlpha;
    void main() {
      vAlpha = sin(uTime * 2.5 + aPhase) * 0.35 + 0.65;
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * (350.0 / -mvPos.z);
      gl_Position = projectionMatrix * mvPos;
    }
  `,
  fragmentShader: `
    uniform float uOpacity;
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      if (d > 0.5) discard;
      float intensity = smoothstep(0.5, 0.0, d) * vAlpha * uOpacity;
      gl_FragColor = vec4(0.92, 0.96, 1.0, intensity);
    }
  `,
  transparent: true,
  depthWrite: false,
  fog: false
});
const starField = new THREE.Points(starGeo, starMat);
scene.add(starField);

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

// ---------- Collision System & Developer Debug Visualizer ----------
export const colliders = [];
export function addCollider(x, z, w, d) {
  const c = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, x, z, w, d };
  colliders.push(c);
  return c;
}
export function collidesAt(x, z, r) {
  for (const c of colliders) {
    if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true;
  }
  return false;
}

const debugColliderGroup = new THREE.Group();
debugColliderGroup.name = 'DebugColliders';
scene.add(debugColliderGroup);
let debugCollidersVisible = false;

export function toggleDebugColliders() {
  debugCollidersVisible = !debugCollidersVisible;
  debugColliderGroup.clear();
  if (debugCollidersVisible) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3366, wireframe: true });
    const fillMat = new THREE.MeshBasicMaterial({ color: 0xff3366, transparent: true, opacity: 0.18, depthWrite: false });
    for (const c of colliders) {
      const geo = new THREE.BoxGeometry(c.w, 3.2, c.d);
      const wire = new THREE.Mesh(geo, mat);
      wire.position.set(c.x, 1.6, c.z);
      const fill = new THREE.Mesh(geo, fillMat);
      fill.position.set(c.x, 1.6, c.z);
      debugColliderGroup.add(wire, fill);
    }
    showToast('🛡️ Collision Visualizer: ON (Press C to hide)', 3000);
  } else {
    showToast('🛡️ Collision Visualizer: OFF', 2000);
  }
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

// Data-Driven Activity Registry
export const ACTIVITIES = {
  ARRIVING_AT_SCHOOL: {
    label: 'School Arrival',
    destination: 'courtyard',
    spotType: null,
    targetState: 'ARRIVING_AT_SCHOOL',
    arrivedState: 'IDLE_AT_DESTINATION',
    animMode: 'idle'
  },
  CLASS: {
    label: 'Homeroom Lecture',
    destination: 'class1d',
    spotType: 'desk_seat',
    targetState: 'GOING_TO_CLASS',
    arrivedState: 'IN_CLASS',
    animMode: 'sit_desk'
  },
  AFTERNOON_CLASS: {
    label: 'Afternoon Lecture',
    destination: 'class1d',
    spotType: 'desk_seat',
    targetState: 'GOING_TO_CLASS',
    arrivedState: 'IN_CLASS',
    animMode: 'sit_desk'
  },
  BREAK: {
    label: 'Classroom Break',
    destination: 'class1d',
    spotType: 'desk_seat',
    targetState: 'IN_CLASS',
    arrivedState: 'IN_CLASS',
    animMode: 'sit_desk'
  },
  LUNCH: {
    label: 'Cafeteria Lunch',
    destination: 'cafeteria',
    spotType: 'dining_seat',
    targetState: 'GOING_TO_LUNCH',
    arrivedState: 'EATING',
    animMode: 'sit_eat'
  },
  PERSONAL_ACTIVITY: {
    label: 'Clubs & Leisure',
    destination: 'library',
    spotType: 'library_seat',
    targetState: 'GOING_TO_ACTIVITY',
    arrivedState: 'IDLE_AT_DESTINATION',
    animMode: 'idle'
  },
  EVENING_LEISURE: {
    label: 'Evening Leisure',
    destination: 'mall',
    spotType: null,
    targetState: 'GOING_TO_ACTIVITY',
    arrivedState: 'IDLE_AT_DESTINATION',
    animMode: 'idle'
  },
  DORM_TIME: {
    label: 'Dormitory Free Time',
    destination: 'dorm',
    spotType: null,
    targetState: 'GOING_TO_DORM',
    arrivedState: 'IDLE_AT_DESTINATION',
    animMode: 'idle'
  },
  NIGHT_REST: {
    label: 'Curfew & Rest',
    destination: 'dorm',
    spotType: null,
    targetState: 'GOING_TO_DORM',
    arrivedState: 'IDLE_AT_DESTINATION',
    animMode: 'idle'
  }
};

// =========================================================================
// CAMPUS BUILDINGS & LOCATIONS REGISTRY
// =========================================================================
export const campusBuildings = {
  academicMain: {
    label: 'Main Academic Building & Hall',
    bounds: { minX: -30, maxX: 30, minZ: -69, maxZ: -43 },
    entrance: [0, -43],
    interior: [0, -50],
    node: 'hallA',
    doorNode: 'hallDoor',
    interiorNode: 'hallLobby'
  },
  classroom1D: {
    label: 'Class 1-D (West Wing)',
    bounds: { minX: -68, maxX: -56, minZ: -25, maxZ: -15 },
    entrance: [-56, -20],
    interior: [-60, -20],
    node: 'classA',
    doorNode: 'classDoor',
    interiorNode: 'classInterior'
  },
  library: {
    label: 'Memorial Library (West Wing)',
    bounds: { minX: -76, maxX: -48, minZ: 8, maxZ: 36 },
    entrance: [-50, 22],
    interior: [-58, 22],
    node: 'libA',
    doorNode: 'libDoor',
    interiorNode: 'libInterior'
  },
  cafeteria: {
    label: 'School Cafeteria (East Wing)',
    bounds: { minX: 48, maxX: 76, minZ: -35, maxZ: -5 },
    entrance: [52, -20],
    interior: [58, -20],
    node: 'cafA',
    doorNode: 'cafDoor',
    interiorNode: 'cafInterior'
  },
  gymnasium: {
    label: 'Gymnasium (East Wing)',
    bounds: { minX: 46, maxX: 78, minZ: 6, maxZ: 38 },
    entrance: [50, 22],
    interior: [58, 22],
    node: 'gymA',
    doorNode: 'gymDoor',
    interiorNode: 'gymInterior'
  },
  dormitory: {
    label: 'Dormitory Tower & Rooms',
    bounds: { minX: -48, maxX: -20, minZ: 44, maxZ: 72 },
    entrance: [-34, 44],
    interior: [-34, 54],
    node: 'dormA',
    doorNode: 'dormDoor',
    interiorNode: 'dormLobby'
  }
};

export const campusLocations = {
  courtyard:   { label: 'Central Courtyard',           c: [0, 8],     node: 'courtA' },
  class1d:     { label: 'Class 1-D (West Wing)',       c: [-62, -20], node: 'classA', entrance: [-56, -20], interior: [-60, -20] },
  library:     { label: 'Memorial Library (West Wing)',c: [-62, 22],  node: 'libA', entrance: [-50, 22], interior: [-58, 22] },
  hall:        { label: 'Main Hall & Academic Center', c: [0, -56],   node: 'hallA', entrance: [0, -43], interior: [0, -50] },
  council:     { label: 'Student Council Room',        c: [26, -56],  node: 'councilA', entrance: [20, -56], interior: [26, -56] },
  cafeteria:   { label: 'Cafeteria (East Wing)',       c: [62, -20],  node: 'cafA', entrance: [52, -20], interior: [58, -20] },
  gym:         { label: 'Gymnasium (East Wing)',       c: [62, 22],   node: 'gymA', entrance: [50, 22], interior: [58, 22] },
  field:       { label: 'Sports Field & Track',        c: [-62, 60],  node: 'fieldW' },
  aquatic:     { label: 'Olympic Aquatic Center',      c: [-62, 92],  node: 'aquaW' },
  dorm:        { label: 'Dormitory Tower',             c: [-34, 58],  node: 'dormA', entrance: [-34, 44], interior: [-34, 54] },
  room401:     { label: 'Room 401 (Ayanokouji Dorm)',  c: [-50, 58],  node: 'roomA', entrance: [-50, 52], interior: [-50, 58] },
  store:       { label: 'Convenience Store & SIV',     c: [34, 54],   node: 'storeA', entrance: [34, 48], interior: [34, 54] },
  cafe:        { label: 'Palette Café',                c: [54, 54],   node: 'cafeA', entrance: [54, 48], interior: [54, 54] },
  mall:        { label: 'Keyaki Mall & Atrium',        c: [44, 78],   node: 'mallA', entrance: [44, 66], interior: [44, 74] },
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
for (let row = 0; row < 5; row++) {
  for (let col = 0; col < 5; col++) {
    const seatNum = row * 5 + col + 1;
    const seatId = `CLASS_1D_SEAT_${String(seatNum).padStart(2, '0')}`;
    const deskX = -65.5 + col * 1.5;
    const deskZ = -22.4 + row * 1.2;
    const seatX = deskX;
    const seatZ = deskZ + 0.45;
    registerSpot(seatId, 'class1d', seatX, 0, seatZ, Math.PI, 'desk_seat', {
      deskPos: { x: deskX, y: 0.72, z: deskZ },
      row, col
    });
  }
}
registerSpot('CLASS_1D_TEACHER', 'class1d', -64.0, 0, -23.2, 0, 'podium');

// 2. Generate Cafeteria Dining Tables (6 tables x 4 seats = 24 seats)
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 2; c++) {
    const tableNum = r * 2 + c + 1;
    const tx = 56 + c * 12, tz = -26 + r * 6;
    const seatOffsets = [
      { sx: tx - 1.2, sz: tz - 0.7, f: 0 },
      { sx: tx + 1.2, sz: tz - 0.7, f: 0 },
      { sx: tx - 1.2, sz: tz + 0.7, f: Math.PI },
      { sx: tx + 1.2, sz: tz + 0.7, f: Math.PI }
    ];
    seatOffsets.forEach((so, si) => {
      const sId = `CAFETERIA_T${tableNum}_S${si + 1}`;
      registerSpot(sId, 'cafeteria', so.sx, 0, so.sz, so.f, 'dining_seat', { table: tableNum });
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
registerSpot('GYM_HOOP_N', 'gym', 62, 0, 12, Math.PI, 'sport_drill');
registerSpot('GYM_HOOP_S', 'gym', 62, 0, 32, 0, 'sport_drill');
registerSpot('GYM_COURT_MID', 'gym', 62, 0, 22, 0, 'sport_drill');
for (let b = 1; b <= 4; b++) {
  registerSpot(`GYM_BENCH_${b}`, 'gym', 53 + b * 1.8, 0, 22, -Math.PI / 2, 'bench');
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
// TOPOLOGICAL NAVIGATION GRAPH & MULTI-CORRIDOR NETWORK
// =========================================================================
const NAV_NODES = {
  // Central Courtyard & Plaza Perimeter
  hub: [0, 0], courtA: [0, 8], fountW: [-9, 8], fountE: [9, 8],
  courtNW: [-14, 18], courtNE: [14, 18], courtSW: [-14, -8], courtSE: [14, -8],
  plazaN: [0, 22], plazaS: [0, -20], plazaW: [-24, 0], plazaE: [24, 0],

  // Academic Main Building & South Corridors
  hallA: [0, -40], hallDoor: [0, -43], hallLobby: [0, -50],
  hallW: [-24, -40], hallE: [24, -40], councilDoor: [20, -56], councilA: [26, -56],
  seaN: [0, -125], seaWalk: [0, -140],

  // West Wing: Class 1-D, Library & Approaches
  wMid: [-46, 0],
  classA: [-46, -20],
  classSouthCorr: [-46, -34],
  classNorthCorr: [-46, -10],
  classApproach1: [-52, -20],
  classApproach2: [-53, -18],
  classApproach3: [-53, -22],
  classDoor: [-56, -20],
  classInterior: [-60, -20],
  classAisleN: [-60, -23],
  classAisleS: [-60, -17],

  libA: [-46, 22],
  libNorthCorr: [-46, 34],
  libSouthCorr: [-46, 10],
  libApproach1: [-48, 22],
  libApproach2: [-48, 24],
  libApproach3: [-48, 20],
  libDoor: [-50, 22],
  libInterior: [-58, 22],

  // West Athletics & Dormitory Sector
  fieldW: [-62, 44], aquaW: [-62, 76],
  westPromenadeN: [-62, 34],
  fieldEastPath: [-44, 56],
  dormA: [-34, 44], dormDoor: [-34, 48], dormLobby: [-34, 54], roomDoor: [-50, 52], roomA: [-50, 58],

  // East Wing: Cafeteria, Gymnasium & Approaches
  eMid: [46, 0],
  cafA: [46, -20],
  cafSouthCorr: [46, -34],
  cafNorthCorr: [46, -10],
  cafApproach1: [48, -20],
  cafApproach2: [48, -18],
  cafApproach3: [48, -22],
  cafDoor: [52, -20],
  cafInterior: [58, -20],

  gymA: [46, 22],
  gymNorthCorr: [46, 34],
  gymSouthCorr: [46, 10],
  gymApproach1: [48, 22],
  gymApproach2: [48, 24],
  gymApproach3: [48, 20],
  gymDoor: [50, 22],
  gymInterior: [58, 22],

  // North Sector: Commercial Arcade & Front Gate
  northA: [0, 44], northB: [0, 70], gateN: [0, 90],
  storeA: [34, 44], storeDoor: [34, 48],
  cafeA: [54, 44], cafeDoor: [54, 48],
  mallA: [44, 66], mallDoor: [44, 72],
  eNorth: [46, 44], eastPromenadeN: [62, 54]
};

const NAV_EDGES = [
  // 1. Central Courtyard & Plaza Multi-Ring Network
  ['hub', 'fountW'], ['hub', 'fountE'], ['fountW', 'courtA'], ['fountE', 'courtA'],
  ['hub', 'plazaS'], ['hub', 'plazaN'], ['hub', 'plazaW'], ['hub', 'plazaE'],
  ['courtA', 'courtNW'], ['courtA', 'courtNE'], ['courtA', 'courtSW'], ['courtA', 'courtSE'],
  ['courtNW', 'plazaN'], ['courtNE', 'plazaN'], ['courtSW', 'plazaS'], ['courtSE', 'plazaS'],
  ['courtNW', 'plazaW'], ['courtSW', 'plazaW'], ['courtNE', 'plazaE'], ['courtSE', 'plazaE'],
  ['plazaW', 'wMid'], ['plazaE', 'eMid'],

  // 2. Academic Main & South Corridors (Multiple East-West Branches)
  ['plazaS', 'hallA'], ['hallA', 'hallDoor'], ['hallDoor', 'hallLobby'], ['hallLobby', 'councilDoor'], ['councilDoor', 'councilA'],
  ['hallA', 'hallW'], ['hallA', 'hallE'],
  ['hallW', 'classSouthCorr'], ['hallE', 'cafSouthCorr'],
  ['hallA', 'seaN'], ['seaN', 'seaWalk'],

  // 3. West Wing Corridors & Class 1-D Multi-Route Approaches
  ['wMid', 'classA'], ['wMid', 'classNorthCorr'], ['classNorthCorr', 'classA'],
  ['classA', 'classSouthCorr'],
  ['classA', 'classApproach1'], ['classSouthCorr', 'classApproach2'], ['classNorthCorr', 'classApproach3'],
  ['classApproach1', 'classDoor'], ['classApproach2', 'classDoor'], ['classApproach3', 'classDoor'],
  ['classDoor', 'classInterior'],
  ['classInterior', 'classAisleN'], ['classInterior', 'classAisleS'],

  // 4. West Wing: Library Multi-Route Approaches
  ['wMid', 'libA'], ['wMid', 'libSouthCorr'], ['libSouthCorr', 'libA'],
  ['libA', 'libNorthCorr'],
  ['libA', 'libApproach1'], ['libNorthCorr', 'libApproach2'], ['libSouthCorr', 'libApproach3'],
  ['libApproach1', 'libDoor'], ['libApproach2', 'libDoor'], ['libApproach3', 'libDoor'],
  ['libDoor', 'libInterior'],

  // 5. West Wing & Athletics Connections
  ['dormA', 'fieldW'], ['fieldW', 'aquaW'], ['dormA', 'fieldEastPath'], ['fieldEastPath', 'fieldW'],
  ['fieldW', 'westPromenadeN'], ['westPromenadeN', 'libA'],
  ['dormA', 'libA'], ['dormA', 'libNorthCorr'],
  ['classSouthCorr', 'libSouthCorr'],

  // 6. East Wing: Cafeteria Multi-Route Approaches
  ['eMid', 'cafA'], ['eMid', 'cafNorthCorr'], ['cafNorthCorr', 'cafA'],
  ['cafA', 'cafSouthCorr'],
  ['cafA', 'cafApproach1'], ['cafSouthCorr', 'cafApproach2'], ['cafNorthCorr', 'cafApproach3'],
  ['cafApproach1', 'cafDoor'], ['cafApproach2', 'cafDoor'], ['cafApproach3', 'cafDoor'],
  ['cafDoor', 'cafInterior'],

  // 7. East Wing: Gymnasium Multi-Route Approaches
  ['eMid', 'gymA'], ['eMid', 'gymSouthCorr'], ['gymSouthCorr', 'gymA'],
  ['gymA', 'gymNorthCorr'],
  ['gymA', 'gymApproach1'], ['gymNorthCorr', 'gymApproach2'], ['gymSouthCorr', 'gymApproach3'],
  ['gymApproach1', 'gymDoor'], ['gymApproach2', 'gymDoor'], ['gymApproach3', 'gymDoor'],
  ['gymDoor', 'gymInterior'],
  ['cafSouthCorr', 'gymSouthCorr'],

  // 8. North Promenade, Commercial Sector & Front Gate Network
  ['plazaN', 'northA'], ['northA', 'northB'], ['northB', 'gateN'],
  ['northA', 'dormA'], ['plazaN', 'dormA'],
  ['northA', 'storeA'], ['plazaN', 'storeA'],
  ['storeA', 'storeDoor'], ['storeA', 'cafeA'], ['cafeA', 'cafeDoor'],
  ['storeA', 'eNorth'], ['storeA', 'eMid'],
  ['eNorth', 'mallA'], ['mallA', 'mallDoor'],
  ['eNorth', 'gymA'], ['eNorth', 'gymNorthCorr'],
  ['eNorth', 'eastPromenadeN'], ['eastPromenadeN', 'gymA']
];

const NAV_ADJ = {};
for (const k of Object.keys(NAV_NODES)) NAV_ADJ[k] = [];
for (const [a, b] of NAV_EDGES) {
  if (NAV_ADJ[a] && NAV_ADJ[b]) {
    NAV_ADJ[a].push(b);
    NAV_ADJ[b].push(a);
  }
}

// =========================================================================
// TRAFFIC MANAGER (CORRIDOR LOAD MONITORING)
// =========================================================================
export const TrafficManager = {
  edgeTraffic: {},
  nodeTraffic: {},
  edgeKey(a, b) {
    return a < b ? `${a}---${b}` : `${b}---${a}`;
  },
  addRouteTraffic(npcId, nodeKeys) {
    if (!nodeKeys || nodeKeys.length === 0) return;
    for (let i = 0; i < nodeKeys.length; i++) {
      const n = nodeKeys[i];
      this.nodeTraffic[n] = (this.nodeTraffic[n] || 0) + 1;
      if (i < nodeKeys.length - 1) {
        const ek = this.edgeKey(nodeKeys[i], nodeKeys[i + 1]);
        this.edgeTraffic[ek] = (this.edgeTraffic[ek] || 0) + 1;
      }
    }
  },
  removeRouteTraffic(npcId, nodeKeys) {
    if (!nodeKeys || nodeKeys.length === 0) return;
    for (let i = 0; i < nodeKeys.length; i++) {
      const n = nodeKeys[i];
      if (this.nodeTraffic[n]) this.nodeTraffic[n] = Math.max(0, this.nodeTraffic[n] - 1);
      if (i < nodeKeys.length - 1) {
        const ek = this.edgeKey(nodeKeys[i], nodeKeys[i + 1]);
        if (this.edgeTraffic[ek]) this.edgeTraffic[ek] = Math.max(0, this.edgeTraffic[ek] - 1);
      }
    }
  },
  getRouteTrafficCost(nodeKeys) {
    if (!nodeKeys || nodeKeys.length < 2) return 0;
    let cost = 0;
    for (let i = 0; i < nodeKeys.length - 1; i++) {
      const ek = this.edgeKey(nodeKeys[i], nodeKeys[i + 1]);
      const load = this.edgeTraffic[ek] || 0;
      cost += load * 7.5; // 7.5m equivalent distance cost per other student on edge
    }
    return cost;
  },
  getNodeLoad(nodeKey) {
    return this.nodeTraffic[nodeKey] || 0;
  }
};

// =========================================================================
// DOORWAY QUEUE MANAGER (BOTTLENECK FLOW ARBITRATION)
// =========================================================================
export const DoorwayQueueManager = {
  doors: {
    class1d:   { pos: [-56.0, -20.0], occupant: null, expireAt: 0 },
    library:   { pos: [-50.0, 22.0],  occupant: null, expireAt: 0 },
    cafeteria: { pos: [52.0, -20.0],  occupant: null, expireAt: 0 },
    gym:       { pos: [50.0, 22.0],   occupant: null, expireAt: 0 },
    dorm:      { pos: [-34.0, 48.0],  occupant: null, expireAt: 0 }
  },
  canEnterDoor(doorKey, npcId, now) {
    const door = this.doors[doorKey];
    if (!door) return true;
    if (door.occupant === npcId) return true;
    if (!door.occupant || now > door.expireAt) {
      door.occupant = npcId;
      door.expireAt = now + 2.2;
      return true;
    }
    return false;
  },
  clearDoor(doorKey, npcId) {
    const door = this.doors[doorKey];
    if (door && door.occupant === npcId) {
      door.occupant = null;
      door.expireAt = 0;
    }
  },
  clearAllForNPC(npcId) {
    for (const d of Object.values(this.doors)) {
      if (d.occupant === npcId) {
        d.occupant = null;
        d.expireAt = 0;
      }
    }
  }
};

// =========================================================================
// ROUTE MANAGER (MULTI-CANDIDATE PATH GENERATION & SCORING)
// =========================================================================
export const RouteManager = {
  findCandidateRoutes(fromNode, toNode) {
    if (fromNode === toNode) return [[fromNode]];
    const candidates = [];
    
    // 1. Primary shortest path
    const p1 = this._shortestPath(fromNode, toNode, []);
    if (p1) candidates.push(p1);

    // 2. Discover alternate diverse paths by penalizing intermediate segments
    if (p1 && p1.length > 2) {
      for (let i = 1; i < p1.length - 1; i++) {
        const bannedEdge = TrafficManager.edgeKey(p1[i], p1[i + 1]);
        const pAlt = this._shortestPath(fromNode, toNode, [bannedEdge]);
        if (pAlt && !candidates.some(c => this._pathsEqual(c, pAlt))) {
          candidates.push(pAlt);
          if (candidates.length >= 4) break;
        }
      }
    }

    if (candidates.length === 0) return [[fromNode, toNode]];
    return candidates;
  },

  _pathsEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  },

  _shortestPath(from, to, bannedEdges = []) {
    const q = [[from]];
    const visited = new Set();
    while (q.length > 0) {
      const path = q.shift();
      const cur = path[path.length - 1];
      if (cur === to) return path;
      if (visited.has(cur) && path.length > 6) continue;
      visited.add(cur);
      const neighbors = NAV_ADJ[cur] || [];
      for (const nb of neighbors) {
        if (path.includes(nb)) continue;
        const ek = TrafficManager.edgeKey(cur, nb);
        if (bannedEdges.includes(ek)) continue;
        q.push([...path, nb]);
      }
    }
    return null;
  },

  _pathDistance(nodeKeys) {
    let d = 0;
    for (let i = 0; i < nodeKeys.length - 1; i++) {
      const a = NAV_NODES[nodeKeys[i]], b = NAV_NODES[nodeKeys[i + 1]];
      if (a && b) d += Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
    return d;
  },

  selectBestRoute(fromNode, toNode, npc) {
    const candidates = this.findCandidateRoutes(fromNode, toNode);
    if (candidates.length === 1) return { route: candidates[0], routeId: 'ROUTE_PRIMARY_DIRECT', allCandidates: candidates };

    let bestScore = Infinity;
    let bestRoute = candidates[0];
    let bestIdx = 0;

    let hash = 0;
    const seedStr = (npc?.id || '') + '_' + Math.floor(clockMin / 15);
    for (let i = 0; i < seedStr.length; i++) hash = (hash * 31 + seedStr.charCodeAt(i)) & 0xffffffff;
    const seedOffset = ((Math.abs(hash) % 5) - 2) * 1.6;

    candidates.forEach((cand, idx) => {
      const dist = this._pathDistance(cand);
      const traffic = TrafficManager.getRouteTrafficCost(cand);
      const score = dist + traffic + (idx === (Math.abs(hash) % candidates.length) ? -2.2 : seedOffset);
      if (score < bestScore) {
        bestScore = score;
        bestRoute = cand;
        bestIdx = idx;
      }
    });

    const routeLetter = String.fromCharCode(65 + bestIdx);
    const routeId = `ROUTE_${routeLetter}_${bestRoute.length}ND`;
    return { route: bestRoute, routeId, allCandidates: candidates };
  }
};

function navPath(from, to, options = {}) {
  const res = RouteManager.selectBestRoute(from, to, options);
  return res.route;
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
    const bulbMat = std({ color: 0xfff3d4, emissive: 0xffd97d, emissiveIntensity: 0.0 });
    const bulb = makeBox(0.6, 0.2, 0.4, bulbMat, lx, 4.2, lz, g);
    registerNightEmissive(bulb, 'lamp');
    const pl = new THREE.PointLight(0xffeedd, 0, 16, 2);
    pl.position.set(lx, 4.0, lz);
    pl.userData.baseIntensity = 18;
    g.add(pl);
    registerNightLight(pl);
    addCollider(lx, lz + 8, 0.5, 0.5);
  });
}

function buildAcademicBuilding() {
  const g = grpAcademicNorth;
  g.position.set(0, 0, 0);

  const M = {
    steel: std({ color: 0x3a3d40, roughness: 0.3, metalness: 0.85 }),
    glass: phys({ color: 0xa8c2d4, transmission: 0.88, roughness: 0.1, ior: 1.5 }),
    glassDoor: phys({ color: 0x7fa0b8, transmission: 0.8, roughness: 0.12 }),
    concrete: std({ color: 0xb0b0b0, roughness: 0.45 }),
    concreteDark: std({ color: 0x808388, roughness: 0.55 }),
    roofGrey: std({ color: 0x71747a, roughness: 0.7 }),
    wood: std({ color: 0x5c3a21, roughness: 0.5 }),
    floor: phys({ map: tileTexture('#e2ded4', '#d0ccc0', 8), roughness: 0.25, clearcoat: 0.4 }),
    sign: std({ map: textSignTexture('MAIN ACADEMIC CENTER', 90, '#FFFFFF', '#0F172A'), emissive: 0xffffff, emissiveIntensity: 0.8 })
  };

  const BLD = { L: 60, D: 26, H: 17, stories: 4 };
  const bZ = -56;

  // Floor slabs
  for (let k = 0; k <= BLD.stories; k++) {
    makeBox(BLD.L, 0.4, BLD.D, M.concreteDark, 0, 4.25 * k + 0.2, bZ, g);
  }

  // Interior ground floor lobby
  makeBox(58, 0.05, 24, M.floor, 0, 0.02, bZ, g);
  makeBox(6, 1.1, 1.4, M.wood, 0, 0.55, bZ + 7, g); // Reception desk
  makeBox(0.1, 3.8, 10, std({ color: 0xefede8 }), 16, 1.9, bZ, g); // Corridor partition

  // Soft interior light
  const lobbyLight = new THREE.PointLight(0xfff8ee, 30, 20, 2);
  lobbyLight.position.set(0, 3.8, bZ + 6);
  lobbyLight.userData.baseIntensity = 30;
  g.add(lobbyLight);
  registerNightLight(lobbyLight);

  // Exterior glass facade & structural pillars
  const rows = 4, bays = 12;
  const bayW = BLD.L / bays, glassH = 3.8;
  for (let r = 0; r < rows; r++) {
    for (let b = 0; b < bays; b++) {
      const bx = -BLD.L / 2 + bayW * (b + 0.5);
      const by = 2.2 + 4.25 * r;
      // Skip doorway bay on ground floor
      if (r === 0 && Math.abs(bx) < 3.5) continue;
      const win1 = makeBox(bayW - 0.1, glassH, 0.05, M.glass, bx, by, bZ + BLD.D / 2, g, false);
      const win2 = makeBox(bayW - 0.1, glassH, 0.05, M.glass, bx, by, bZ - BLD.D / 2, g, false);
      registerNightEmissive(win1, 'window');
      registerNightEmissive(win2, 'window');
    }
  }

  for (let b = 0; b <= bays; b++) {
    const px = -BLD.L / 2 + bayW * b;
    makeBox(0.6, BLD.H, 0.6, M.steel, px, BLD.H / 2, bZ + BLD.D / 2 + 0.1, g);
    makeBox(0.6, BLD.H, 0.6, M.steel, px, BLD.H / 2, bZ - BLD.D / 2 - 0.1, g);
  }

  // Entrance Canopy & Steps (South entrance at Z = -43)
  makeBox(16, 0.4, 5.5, M.concrete, 0, 6.4, bZ + BLD.D / 2 + 3.0, g);
  makeBox(0.5, 6.4, 0.5, M.steel, -7.0, 3.2, bZ + BLD.D / 2 + 5.2, g);
  makeBox(0.5, 6.4, 0.5, M.steel, 7.0, 3.2, bZ + BLD.D / 2 + 5.2, g);
  makeBox(12, 0.6, 3.5, M.concrete, 0, 0.3, bZ + BLD.D / 2 + 2.0, g);

  // Sliding glass entrance doors at X = 0, Z = -43
  makeBox(0.1, 3.8, 0.1, M.steel, -2.5, 1.9, bZ + BLD.D / 2, g);
  makeBox(0.1, 3.8, 0.1, M.steel, 2.5, 1.9, bZ + BLD.D / 2, g);
  makeBox(5.0, 0.4, 0.15, M.steel, 0, 3.8, bZ + BLD.D / 2, g);
  makeBox(4.8, 0.5, 0.1, M.sign, 0, 4.4, bZ + BLD.D / 2 + 0.05, g);

  // Roof utilities
  makeBox(8, 3.2, 8, M.concreteDark, 0, BLD.H + 1.6, bZ, g);
  makeBox(5, 1.8, 3.5, M.roofGrey, -16, BLD.H + 0.9, bZ - 4, g);
  makeBox(4, 1.5, 3.0, M.roofGrey, 16, BLD.H + 0.75, bZ + 4, g);

  // Complete Colliders: North/West/East walls + South wall split around entrance
  addCollider(0, bZ - BLD.D / 2, 60, 1.0);  // Back wall
  addCollider(-30, bZ, 1.0, 26);             // Left wall
  addCollider(30, bZ, 1.0, 26);              // Right wall
  addCollider(-16.25, bZ + BLD.D / 2, 27.5, 1.0); // South wall left
  addCollider(16.25, bZ + BLD.D / 2, 27.5, 1.0);  // South wall right
  addCollider(0, bZ + 7, 6.0, 1.4);         // Reception desk

  makeLabel('MAIN HALL & ACADEMIC', 0, 18.5, bZ + 13.5, 0xffffff, 3.0);
}

function buildClassroom1D() {
  const g = grpWestWing;
  const cX = -62, cZ = -20;

  const matFloor = phys({ map: tileTexture('#d4a373', '#b98b5b', 6), roughness: 0.25, clearcoat: 0.5 });
  const matWall = std({ color: 0xefede8, roughness: 0.9 });
  const matBoard = phys({ color: 0x1a3d2e, roughness: 0.2, clearcoat: 0.6 });
  const matDesk = std({ color: 0xe6c280, roughness: 0.4 });
  const matChair = std({ color: 0xdcb283, roughness: 0.45 });
  const matSteel = std({ color: 0x333333, roughness: 0.3, metalness: 0.85 });
  const matGlass = phys({ color: 0xdfe8f0, transmission: 0.92, roughness: 0.05 });
  const matLocker = std({ color: 0x333842, roughness: 0.4, metalness: 0.7 });
  const matCeiling = std({ color: 0xf4f4f0, roughness: 0.9 });
  const matDoor = phys({ color: 0x8f6036, roughness: 0.35, clearcoat: 0.4 });
  const matFrame = std({ color: 0x3a3f44, roughness: 0.4, metalness: 0.5 });

  // 1. Walkable Hardwood Floor (12m x 9m)
  makeBox(12, 0.05, 9, matFloor, cX, 0.02, cZ, g, false, true);

  // 2. North Front Wall (Z = -24.5) with Whiteboard, Wall Displays & Teacher Dais
  makeBox(12, 3.5, 0.3, matWall, cX, 1.75, cZ - 4.5, g);
  makeBox(4.5, 1.3, 0.05, matBoard, cX, 1.8, cZ - 4.32, g);
  for (const dx of [-4.2, 4.2]) {
    makeBox(1.2, 0.7, 0.05, matSteel, cX + dx, 2.0, cZ - 4.32, g);
  }
  // Teacher Dais & Walnut Podium
  makeBox(4.5, 0.15, 1.4, std({ color: 0x9c7148 }), cX - 1.0, 0.075, cZ - 3.2, g);
  makeBox(0.8, 1.0, 0.55, matDoor, cX - 2.0, 0.58, cZ - 3.2, g);

  // 3. South Storage Wall (Z = -15.5) with 5x5 Locker Bank
  makeBox(12, 3.5, 0.3, matWall, cX, 1.75, cZ + 4.5, g);
  makeBox(10.0, 2.4, 0.4, matLocker, cX, 1.2, cZ + 4.2, g);

  // 4. West Glass Curtain Wall (X = -68) with Daylight Windows & Blinds
  makeBox(0.3, 3.5, 9, matWall, cX - 6.0, 1.75, cZ, g);
  makeBox(0.05, 2.4, 7.8, matGlass, cX - 6.05, 1.8, cZ, g);

  // 5. East Entrance Wall (X = -56) with REAL WALKABLE DOORWAY (at Z = -20)
  // North segment (Z: -24.5 to -20.7, length 3.8m)
  makeBox(0.3, 3.5, 3.8, matWall, cX + 6.0, 1.75, cZ - 2.6, g);
  // South segment (Z: -19.3 to -15.5, length 3.8m)
  makeBox(0.3, 3.5, 3.8, matWall, cX + 6.0, 1.75, cZ + 2.6, g);
  // Doorway Header (above Y = 2.5m)
  makeBox(0.3, 1.0, 1.4, matWall, cX + 6.0, 3.0, cZ, g);

  // Doorway Detailing: Jambs, Threshold Step, Entrance Mat, Door Leaf
  makeBox(0.34, 2.5, 0.1, matFrame, cX + 6.0, 1.25, cZ - 0.7, g);
  makeBox(0.34, 2.5, 0.1, matFrame, cX + 6.0, 1.25, cZ + 0.7, g);
  makeBox(0.34, 0.1, 1.5, matFrame, cX + 6.0, 2.5, cZ, g);
  makeBox(0.6, 0.03, 1.4, std({ color: 0x666a70 }), cX + 6.0, 0.015, cZ, g); // stone threshold
  makeBox(0.8, 0.015, 1.2, std({ color: 0x33423a }), cX + 4.8, 0.01, cZ, g);  // entrance mat
  // Open hinged door leaf
  makeBox(0.05, 2.1, 0.85, matDoor, cX + 5.5, 1.05, cZ - 0.9, g);

  // Room Entrance Label Sign
  makeBox(0.08, 0.45, 1.8, std({ map: textSignTexture('CLASS 1-D', 90, '#FFFFFF', '#1E293B'), emissive: 0xffffff, emissiveIntensity: 0.8 }), cX + 6.18, 2.85, cZ, g);

  // 6. Suspended Acoustic Ceiling & Recessed LED Lights
  makeBox(12, 0.15, 9, matCeiling, cX, 3.55, cZ, g);
  for (const px of [-65, -62, -59]) {
    for (const pz of [-22, -18]) {
      makeBox(1.5, 0.02, 1.0, std({ color: 0xfff8e7, emissive: 0xfff3d6, emissiveIntensity: 1.2 }), px, 3.48, pz, g);
    }
  }

  // Soft Interior Lighting Point
  const classLight = new THREE.PointLight(0xfff5e6, 30, 16, 2);
  classLight.position.set(cX, 3.1, cZ);
  g.add(classLight);

  // 7. Student Seating Array (5x5 = 25 Desks & Chairs)
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const deskX = -65.5 + col * 1.5;
      const deskZ = -22.4 + row * 1.2;
      // Desk
      makeBox(0.75, 0.04, 0.48, matDesk, deskX, 0.72, deskZ, g);
      makeBox(0.04, 0.7, 0.04, matSteel, deskX - 0.32, 0.35, deskZ - 0.2, g);
      makeBox(0.04, 0.7, 0.04, matSteel, deskX + 0.32, 0.35, deskZ - 0.2, g);
      makeBox(0.04, 0.7, 0.04, matSteel, deskX - 0.32, 0.35, deskZ + 0.2, g);
      makeBox(0.04, 0.7, 0.04, matSteel, deskX + 0.32, 0.35, deskZ + 0.2, g);
      // Chair (facing North toward whiteboard)
      const chairZ = deskZ + 0.45;
      makeBox(0.42, 0.04, 0.4, matChair, deskX, 0.45, chairZ, g);
      makeBox(0.42, 0.45, 0.03, matChair, deskX, 0.72, chairZ + 0.18, g);
      makeBox(0.03, 0.44, 0.03, matSteel, deskX - 0.18, 0.22, chairZ - 0.16, g);
      makeBox(0.03, 0.44, 0.03, matSteel, deskX + 0.18, 0.22, chairZ - 0.16, g);
    }
  }

  // 8. Solid Colliders: 4 Exterior Walls (Doorway open) + Dais + Desk Rows
  addCollider(cX, cZ - 4.5, 12.0, 0.4);  // North wall
  addCollider(cX, cZ + 4.5, 12.0, 0.4);  // South wall
  addCollider(cX - 6.0, cZ, 0.4, 9.0);   // West wall
  addCollider(cX + 6.0, cZ - 2.6, 0.4, 3.8); // East wall North
  addCollider(cX + 6.0, cZ + 2.6, 0.4, 3.8); // East wall South
  addCollider(cX - 1.0, cZ - 3.2, 4.5, 1.4); // Teacher dais
  for (let r = 0; r < 5; r++) {
    addCollider(cX - 0.5, cZ - 2.4 + r * 1.2, 6.8, 0.5); // Desk row colliders
  }

  makeLabel('CLASS 1-D', cX + 6.5, 3.5, cZ, 0xffffff, 2.2);
}

function buildMemorialLibrary() {
  const g = grpWestWing;
  const cX = -62, cZ = 22;

  const matWood = std({ color: 0x5c3a21, roughness: 0.5 });
  const matFloor = phys({ map: tileTexture('#8a6238', '#6b4a2c', 8), roughness: 0.35, clearcoat: 0.4 });
  const matGlass = phys({ color: 0xf7ead2, transmission: 0.85, roughness: 0.1 });
  const matBanker = std({ color: 0x1b4d3e, emissive: 0x37c46e, emissiveIntensity: 1.5 });
  const matStone = std({ color: 0x94a3b8, roughness: 0.6 });

  // Walkable Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), matFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cX, 0.03, cZ);
  floor.receiveShadow = true;
  g.add(floor);

  // Exterior Glass Curtain Wall with East Entrance (X = -50, Z = 22)
  const wallMesh = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 6, 32, 1, true, 0.3, Math.PI * 1.8), matGlass);
  wallMesh.position.set(cX, 3.0, cZ);
  g.add(wallMesh);

  // Entrance Casing & Steps at X = -50, Z = 22
  makeBox(0.4, 3.8, 0.2, matStone, cX + 12, 1.9, cZ - 2.0, g);
  makeBox(0.4, 3.8, 0.2, matStone, cX + 12, 1.9, cZ + 2.0, g);
  makeBox(0.4, 0.4, 4.2, matStone, cX + 12, 3.8, cZ, g);
  makeBox(1.6, 0.05, 3.8, matStone, cX + 12, 0.02, cZ, g);

  // Interior radial bookshelves
  for (let a = 0.5; a < Math.PI * 1.5; a += 0.45) {
    const rx = cX + Math.cos(a) * 8.5, rz = cZ + Math.sin(a) * 8.5;
    const shelf = makeBox(3.8, 4.2, 0.8, matWood, rx, 2.1, rz, g);
    shelf.rotation.y = -a + Math.PI / 2;
  }

  // Central librarian desk
  const desk = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 1.1, 20), matWood);
  desk.position.set(cX, 0.55, cZ);
  g.add(desk);

  // Study tables
  for (const sx of [-4, 4]) {
    makeBox(3.2, 0.75, 1.2, matWood, cX + sx, 0.38, cZ + 4, g);
    makeBox(0.4, 0.2, 0.2, matBanker, cX + sx, 0.85, cZ + 4, g);
    makeBox(3.2, 0.75, 1.2, matWood, cX + sx, 0.38, cZ - 4, g);
    makeBox(0.4, 0.2, 0.2, matBanker, cX + sx, 0.85, cZ - 4, g);
  }

  // Interior Light
  const libLight = new THREE.PointLight(0xfff3d6, 30, 18, 2);
  libLight.position.set(cX, 3.5, cZ);
  g.add(libLight);

  // Complete Colliders (Doorway open at X = -50, Z = 22)
  addCollider(cX, cZ + 12.0, 24.0, 1.0);  // North wall
  addCollider(cX, cZ - 12.0, 24.0, 1.0);  // South wall
  addCollider(cX - 12.0, cZ, 1.0, 24.0);  // West wall
  addCollider(cX + 12.0, cZ + 6.5, 1.0, 11.0); // East wall North
  addCollider(cX + 12.0, cZ - 6.5, 1.0, 11.0); // East wall South
  addCollider(cX, cZ, 4.0, 4.0);          // Central librarian desk

  makeLabel('MEMORIAL LIBRARY', cX + 8, 4.5, cZ, 0xffffff, 2.2);
}

function buildCouncilRoom() {
  const g = grpAcademicNorth;
  const cX = 26, cZ = -56;

  const matCarpet = std({ color: 0x2b2d38, roughness: 0.95 });
  const matMahogany = phys({ color: 0x3d1c06, roughness: 0.2, metalness: 0.1, clearcoat: 0.8 });
  const matLeather = std({ color: 0x181818, roughness: 0.3 });
  const matWall = std({ color: 0x383430, roughness: 0.85 });

  makeBox(12, 0.05, 8, matCarpet, cX, 0.03, cZ, g);
  makeBox(12, 3.2, 0.2, matWall, cX, 1.6, cZ - 4.0, g);
  makeBox(12, 3.2, 0.2, matWall, cX, 1.6, cZ + 4.0, g);
  makeBox(0.2, 3.2, 8, matWall, cX + 6.0, 1.6, cZ, g);
  // West wall with door opening to main hall
  makeBox(0.2, 3.2, 2.8, matWall, cX - 6.0, 1.6, cZ - 2.6, g);
  makeBox(0.2, 3.2, 2.8, matWall, cX - 6.0, 1.6, cZ + 2.6, g);
  makeBox(0.2, 0.8, 2.4, matWall, cX - 6.0, 2.8, cZ, g);

  // Conference table & chairs
  makeBox(6.0, 0.08, 1.4, matMahogany, cX, 0.75, cZ, g);
  for (const dx of [-2.0, 0, 2.0]) {
    makeBox(0.55, 0.08, 0.55, matLeather, cX + dx, 0.48, cZ - 1.2, g);
    makeBox(0.55, 0.08, 0.55, matLeather, cX + dx, 0.48, cZ + 1.2, g);
  }

  // Colliders
  addCollider(cX, cZ - 4.0, 12, 0.4);
  addCollider(cX, cZ + 4.0, 12, 0.4);
  addCollider(cX + 6.0, cZ, 0.4, 8);
  addCollider(cX - 6.0, cZ - 2.6, 0.4, 2.8);
  addCollider(cX - 6.0, cZ + 2.6, 0.4, 2.8);
  addCollider(cX, cZ, 6.0, 1.4);

  makeLabel('STUDENT COUNCIL', cX - 6.2, 3.2, cZ, 0xffffff, 2.0);
}

function buildSchoolCafeteria() {
  const g = grpEastWing;
  const cX = 62, cZ = -20;

  const matFloor = phys({ color: 0xe5d3b3, roughness: 0.15, clearcoat: 0.6 });
  const matSteel = std({ color: 0xc6c9ce, roughness: 0.25, metalness: 0.9 });
  const matTable = std({ color: 0xd6c49a, roughness: 0.5 });
  const matWall = std({ color: 0xf2efe8, roughness: 0.9 });

  // 1. Walkable Floor
  makeBox(24, 0.05, 24, matFloor, cX, 0.02, cZ, g);

  // 2. North, South, East Walls
  makeBox(24, 5.0, 0.3, matWall, cX, 2.5, cZ - 12.0, g);
  makeBox(24, 5.0, 0.3, matWall, cX, 2.5, cZ + 12.0, g);
  makeBox(0.3, 5.0, 24, matWall, cX + 12.0, 2.5, cZ, g);

  // 3. West Entrance Wall (X = 50) with Walkable Doorway at Z = -20
  makeBox(0.3, 5.0, 10.0, matWall, cX - 12.0, 2.5, cZ - 7.0, g);
  makeBox(0.3, 5.0, 10.0, matWall, cX - 12.0, 2.5, cZ + 7.0, g);
  makeBox(0.3, 1.5, 4.0, matWall, cX - 12.0, 4.25, cZ, g);

  // Serving counter & food display along East wall
  makeBox(1.6, 1.1, 16.0, matSteel, cX + 9.5, 0.55, cZ, g);
  makeBox(0.6, 0.05, 16.0, phys({ color: 0xffffff, transmission: 0.9 }), cX + 9.5, 1.4, cZ, g);

  // 6 Dining Tables with Benches
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      const tx = cX - 6 + c * 12, tz = cZ - 6 + r * 6;
      makeBox(6.0, 0.06, 1.4, matTable, tx, 0.75, tz, g);
      makeBox(6.0, 0.05, 0.45, matTable, tx, 0.45, tz - 1.1, g);
      makeBox(6.0, 0.05, 0.45, matTable, tx, 0.45, tz + 1.1, g);
    }
  }

  // Vending machines
  for (let v = 0; v < 4; v++) {
    const col = [0xd63031, 0x0984e3, 0x00b894, 0x6c5ce7][v];
    makeBox(1.2, 2.1, 0.9, std({ color: col }), cX - 10 + v * 1.8, 1.05, cZ + 10.5, g);
  }

  // Interior Light
  const cafLight = new THREE.PointLight(0xfff5e0, 30, 18, 2);
  cafLight.position.set(cX, 3.5, cZ);
  g.add(cafLight);

  // Complete Colliders (Doorway open at X = 50, Z = -20)
  addCollider(cX, cZ - 12.0, 24.0, 1.0);  // North wall
  addCollider(cX, cZ + 12.0, 24.0, 1.0);  // South wall
  addCollider(cX + 12.0, cZ, 1.0, 24.0);  // East wall
  addCollider(cX - 12.0, cZ - 7.0, 1.0, 10.0); // West wall North
  addCollider(cX - 12.0, cZ + 7.0, 1.0, 10.0); // West wall South
  addCollider(cX + 9.5, cZ, 2.0, 16.0);  // Food counter

  makeLabel('CAFETERIA', cX - 8, 4.5, cZ, 0xffffff, 2.2);
}

function buildGymnasium() {
  const g = grpEastWing;
  const cX = 62, cZ = 22;

  const matCourt = phys({ map: tileTexture('#e3c08d', '#d9b37e', 16), roughness: 0.15, clearcoat: 0.6 });
  const matConcrete = std({ color: 0x9a9da0, roughness: 0.9 });
  const matTruss = std({ color: 0x8f979e, metalness: 0.7, roughness: 0.35 });
  const matGlass = phys({ color: 0xdfeaf4, transmission: 0.85, roughness: 0.1 });

  // Walkable Floor
  makeBox(24, 0.05, 28, matCourt, cX, 0.02, cZ, g);

  // North, South, East Walls
  makeBox(24, 6.0, 0.4, matConcrete, cX, 3.0, cZ - 14.0, g);
  makeBox(24, 6.0, 0.4, matConcrete, cX, 3.0, cZ + 14.0, g);
  makeBox(0.4, 6.0, 28, matConcrete, cX + 12.0, 3.0, cZ, g);

  // West Entrance Wall with Double Doorway at Z = 22
  makeBox(0.4, 6.0, 12.0, matConcrete, cX - 12.0, 3.0, cZ - 8.0, g);
  makeBox(0.4, 6.0, 12.0, matConcrete, cX - 12.0, 3.0, cZ + 8.0, g);
  makeBox(0.4, 2.0, 4.0, matConcrete, cX - 12.0, 5.0, cZ, g);

  // Basketball hoops North & South
  for (const s of [-1, 1]) {
    makeBox(0.2, 4.2, 0.2, matTruss, cX, 2.1, cZ + s * 12.0, g);
    makeBox(2.2, 1.4, 0.08, phys({ color: 0xffffff, transmission: 0.9 }), cX, 3.6, cZ + s * 11.2, g);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 8, 16), std({ color: 0xe65100 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(cX, 3.05, cZ + s * 10.7);
    g.add(rim);
  }

  // Bleachers along East wall
  for (let b = 0; b < 4; b++) {
    makeBox(1.0, 0.45 * (b + 1), 22, matConcrete, cX + 9.5 - b * 1.0, 0.225 * (b + 1), cZ, g);
  }

  // Interior Light
  const gymLight = new THREE.PointLight(0xfff8ee, 35, 20, 2);
  gymLight.position.set(cX, 5.0, cZ);
  g.add(gymLight);

  // Complete Colliders (Doorway open at X = 50, Z = 22)
  addCollider(cX, cZ - 14.0, 24.0, 1.0);  // North wall
  addCollider(cX, cZ + 14.0, 24.0, 1.0);  // South wall
  addCollider(cX + 12.0, cZ, 1.0, 28.0);  // East wall
  addCollider(cX - 12.0, cZ - 8.0, 1.0, 12.0); // West wall North
  addCollider(cX - 12.0, cZ + 8.0, 1.0, 12.0); // West wall South

  makeLabel('GYMNASIUM', cX - 12.5, 6.0, cZ, 0xffffff, 2.2);
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

  const dormLamps = [[-26, 44], [-44, 44], [-26, 68], [-44, 68]];
  dormLamps.forEach(([lx, lz]) => {
    makeBox(0.25, 4.2, 0.25, std({ color: 0x3a3f47 }), lx, 2.1, lz, g);
    const bulbMat = std({ color: 0xfff3d4, emissive: 0xffd97d, emissiveIntensity: 0.0 });
    const bulb = makeBox(0.6, 0.2, 0.4, bulbMat, lx, 4.2, lz, g);
    registerNightEmissive(bulb, 'lamp');
    const pl = new THREE.PointLight(0xffeedd, 0, 16, 2);
    pl.position.set(lx, 4.0, lz);
    pl.userData.baseIntensity = 18;
    g.add(pl);
    registerNightLight(pl);
  });

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

  const comLamps = [[26, 44], [46, 44], [60, 44], [26, 68], [60, 68]];
  comLamps.forEach(([lx, lz]) => {
    makeBox(0.25, 4.2, 0.25, std({ color: 0x3a3f47 }), lx, 2.1, lz, g);
    const bulbMat = std({ color: 0xfff3d4, emissive: 0xffd97d, emissiveIntensity: 0.0 });
    const bulb = makeBox(0.6, 0.2, 0.4, bulbMat, lx, 4.2, lz, g);
    registerNightEmissive(bulb, 'lamp');
    const pl = new THREE.PointLight(0xffeedd, 0, 16, 2);
    pl.position.set(lx, 4.0, lz);
    pl.userData.baseIntensity = 18;
    g.add(pl);
    registerNightLight(pl);
  });

  const mallG = new THREE.Group();
  mallG.position.set(44, 0, 78);

  const M = {
    concreteDark: std({ color: 0x3a3f47, roughness: 0.5 }),
    chrome: std({ color: 0xd0d5dd, roughness: 0.2, metalness: 0.9 }),
    glass: phys({ color: 0x9ec0db, transmission: 0.9, roughness: 0.1, ior: 1.5, emissive: 0xffea9f, emissiveIntensity: 0.0 }),
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
      const w1 = makeBox(bayW - 0.15, 5.5, 0.05, M.glass, bx, 3.2 + 6.0 * t, -BLD.D / 2, mallG, false);
      const w2 = makeBox(bayW - 0.15, 5.5, 0.05, M.glass, bx, 3.2 + 6.0 * t, BLD.D / 2, mallG, false);
      registerNightEmissive(w1, 'window');
      registerNightEmissive(w2, 'window');
    }
  }

  const pyrGeo = new THREE.ConeGeometry(14 * Math.SQRT2, 9, 4, 1, true);
  const pyrMesh = new THREE.Mesh(pyrGeo, M.glass);
  pyrMesh.position.y = BLD.H + 4.5;
  pyrMesh.rotation.y = Math.PI / 4;
  registerNightEmissive(pyrMesh, 'window');
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

  const gateLamps = [[-12, 18], [12, 18], [-12, -10], [12, -10]];
  gateLamps.forEach(([lx, lz]) => {
    makeBox(0.25, 4.2, 0.25, std({ color: 0x3a3f47 }), lx, 2.1, lz, g);
    const bulbMat = std({ color: 0xfff3d4, emissive: 0xffd97d, emissiveIntensity: 0.0 });
    const bulb = makeBox(0.6, 0.2, 0.4, bulbMat, lx, 4.2, lz, g);
    registerNightEmissive(bulb, 'lamp');
    const pl = new THREE.PointLight(0xffeedd, 0, 16, 2);
    pl.position.set(lx, 4.0, lz);
    pl.userData.baseIntensity = 18;
    g.add(pl);
    registerNightLight(pl);
  });

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
    const bulbMat = std({ color: 0xffffff, emissive: 0xfff3d4, emissiveIntensity: 0.0 });
    const bulb = makeBox(0.6, 0.12, 0.3, bulbMat, x, 4.5, 2.5, g);
    registerNightEmissive(bulb, 'lamp');
    const pl = new THREE.PointLight(0xffeedd, 0, 16, 2);
    pl.position.set(x, 4.3, 2.5);
    pl.userData.baseIntensity = 16;
    g.add(pl);
    registerNightLight(pl);
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

export function getStudentArchetype(traits) {
  const { intelligence = 0.5, athleticism = 0.5, social = 0.5, discipline = 0.5, curiosity = 0.5 } = traits || {};
  if (intelligence >= 0.85 || (intelligence >= 0.8 && discipline >= 0.8)) return 'Academic / Nerdy';
  if (athleticism >= 0.85) return 'Sports Athlete';
  if (social >= 0.85) return 'Social Butterfly';
  if (discipline <= 0.35 && social >= 0.6) return 'Slacker / Casual';
  if (intelligence >= 0.75 && social >= 0.75) return 'Class Leader';
  return 'Balanced Student';
}

function createStudentNPC(id, name, persona, traits, assignedSeat, cfg) {
  const rig = makeRig(cfg);
  const startLoc = LOC[cfg.spawnLoc || 'gate']?.c || [0, 0];
  const s = findFreeSpot(startLoc[0] + (Math.random() - 0.5) * 3, startLoc[1] + (Math.random() - 0.5) * 3, 0.5);
  rig.root.position.set(s.x, 0, s.z);
  rig.root.rotation.y = Math.PI;
  scene.add(rig.root);

  const label = makeLabel(name, s.x, 2.05, s.z, 0xffffff, 1.4);

  // Compute individual lateral lane offset for pathway walking (-0.6m to +0.6m)
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  const laneOffset = ((Math.abs(hash) % 5) - 2) * 0.32;

  const GAIT_PROFILES = {
    kouenji:   { forwardLean: -0.03, stride: 1.05, armSwing: 0.38, bounce: 0.020, hipSway: 0.024 },
    sudou:     { forwardLean: 0.12,  stride: 1.25, armSwing: 0.55, bounce: 0.032, hipSway: 0.018 },
    horikita:  { forwardLean: 0.04,  stride: 0.95, armSwing: 0.36, bounce: 0.020, hipSway: 0.015 },
    kushida:   { forwardLean: 0.06,  stride: 1.02, armSwing: 0.44, bounce: 0.030, hipSway: 0.022 },
    chabashira:{ forwardLean: 0.03,  stride: 1.05, armSwing: 0.35, bounce: 0.018, hipSway: 0.014 },
    sakura:    { forwardLean: 0.05,  stride: 0.88, armSwing: 0.28, bounce: 0.018, hipSway: 0.012 },
    hirata:    { forwardLean: 0.05,  stride: 1.08, armSwing: 0.42, bounce: 0.022, hipSway: 0.016 },
    karuizawa: { forwardLean: 0.05,  stride: 0.96, armSwing: 0.38, bounce: 0.024, hipSway: 0.025 },
    yukimura:  { forwardLean: 0.06,  stride: 0.94, armSwing: 0.34, bounce: 0.018, hipSway: 0.012 },
    ike:       { forwardLean: 0.08,  stride: 1.08, armSwing: 0.48, bounce: 0.026, hipSway: 0.020 },
    yamauchi:  { forwardLean: 0.07,  stride: 1.04, armSwing: 0.46, bounce: 0.025, hipSway: 0.022 }
  };
  const gait = GAIT_PROFILES[id] || { forwardLean: 0.06, stride: 1.0, armSwing: 0.42, bounce: 0.024, hipSway: 0.018 };

  const npcTraits = {
    intelligence: traits.intelligence ?? 0.5,
    athleticism: traits.athleticism ?? 0.5,
    social: traits.social ?? 0.5,
    discipline: traits.discipline ?? 0.5,
    curiosity: traits.curiosity ?? 0.5
  };

  const npc = {
    id, name, persona, traits: npcTraits,
    archetype: getStudentArchetype(npcTraits),
    role: cfg.role || 'student',
    assignedSeat,
    preferredActivities: cfg.preferredActivities || ['LIBRARY', 'CAFETERIA'],
    cfg, rig, label,
    currentSpot: cfg.spawnLoc || 'gate',
    spawnLoc: cfg.spawnLoc || 'gate',
    targetSpotId: null,
    targetSpot: null,
    laneOffset,
    curSpeed: 0,
    // State machine
    state: 'ARRIVING_AT_SCHOOL',
    currentActivity: 'ARRIVING_AT_SCHOOL',
    activityReason: 'Engaged in morning routine prior to homeroom.',
    path: [],
    pathI: 0,
    routeId: 'ROUTE_NONE',
    candidateRoutesCount: 1,
    activeRouteNodes: [],
    speed: cfg.speed ?? 2.4,
    facing: Math.PI,
    anim: {
      moving: false, phase: 0, talk: false, idleT: Math.random() * 6, blinkT: Math.random() * 4,
      lookAt: null, run: false, mode: 'idle', banking: 0,
      ...gait
    },
    _stuckTime: 0, _skips: 0,
    wantsTalk: false, waitUntil: 0, bubble: null, bubbleUntil: 0, chatWith: null,
    userData: { isNPC: true, npcId: id, canTalk: true, name },
    lines: cfg.lines || {
      greet: ['...Ayanokouji-kun.', 'Hello.'],
      idle: ['Class 1-D...', 'The campus is huge.'],
      rain: ['It is raining.']
    }
  };

  rig.root.userData = { isNPC: true, npcId: id, canTalk: true, npc };
  rig.root.traverse(child => {
    if (child.isMesh) child.userData = { isNPC: true, npcId: id, canTalk: true, npc };
  });

  npcs.push(npc);
  return npc;
}

// 1. Named Class 1-D Main Cast with Diverse Morning Spawn Locations
createStudentNPC('horikita', 'Horikita',
  'Horikita Suzune — reserved, direct, serious, determined to reach Class A. Quietly observant, dry warmth.',
  { intelligence: 0.98, discipline: 0.95, athleticism: 0.60, social: 0.15, curiosity: 0.85 },
  'CLASS_1D_SEAT_13', // Center desk beside Ayanokouji (Seat 14)
  {
    hair: 0x15151f, hairStyle: 'long', gender: 'f', skin: 0xf3d0b3, tie: 0x8a2b3a, height: 0.97,
    spawnLoc: 'dorm', speed: 2.4, preferredActivities: ['LIBRARY', 'STUDY', 'COURTYARD'],
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
    spawnLoc: 'courtyard', speed: 2.5, preferredActivities: ['PALETTE_CAFE', 'KEYAKI_MALL', 'CAFETERIA', 'COURTYARD'],
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
    spawnLoc: 'field', speed: 2.9, preferredActivities: ['GYMNASIUM', 'SPORTS_FIELD', 'AQUATIC_CENTER', 'CAFETERIA'],
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
    spawnLoc: 'cafe', speed: 2.0, preferredActivities: ['PALETTE_CAFE', 'COURTYARD', 'SIV_STORE', 'DORMITORY', 'SEASIDE'],
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

// 2. Additional Class 1-D Classmate Cohort with Distinct Origins
const COHORT = [
  { id: 'hirata', name: 'Hirata', traits: { intelligence: 0.82, discipline: 0.90, athleticism: 0.85, social: 0.92, curiosity: 0.75 }, seat: 'CLASS_1D_SEAT_11', act: ['CAFETERIA', 'COURTYARD', 'SPORTS_FIELD'], hair: 0x6b4f3b, hairStyle: 'medium', gender: 'm', spawn: 'courtyard', speed: 2.5 },
  { id: 'karuizawa', name: 'Karuizawa', traits: { intelligence: 0.55, discipline: 0.50, athleticism: 0.40, social: 0.95, curiosity: 0.70 }, seat: 'CLASS_1D_SEAT_17', act: ['KEYAKI_MALL', 'PALETTE_CAFE'], hair: 0xe0a96d, hairStyle: 'long', gender: 'f', spawn: 'store', speed: 2.2 },
  { id: 'yukimura', name: 'Yukimura', traits: { intelligence: 0.94, discipline: 0.92, athleticism: 0.30, social: 0.40, curiosity: 0.88 }, seat: 'CLASS_1D_SEAT_06', act: ['LIBRARY', 'STUDY'], hair: 0x1f2937, hairStyle: 'medium', gender: 'm', spawn: 'library', speed: 2.3 },
  { id: 'sakura', name: 'Sakura', traits: { intelligence: 0.70, discipline: 0.80, athleticism: 0.30, social: 0.20, curiosity: 0.82 }, seat: 'CLASS_1D_SEAT_22', act: ['SIV_STORE', 'COURTYARD'], hair: 0xf472b6, hairStyle: 'long', gender: 'f', spawn: 'dorm', speed: 2.0 },
  { id: 'ike', name: 'Ike', traits: { intelligence: 0.40, discipline: 0.35, athleticism: 0.65, social: 0.80, curiosity: 0.60 }, seat: 'CLASS_1D_SEAT_02', act: ['CAFETERIA', 'KEYAKI_MALL'], hair: 0x854d0e, hairStyle: 'spiky', gender: 'm', spawn: 'cafeteria', speed: 2.3 },
  { id: 'yamauchi', name: 'Yamauchi', traits: { intelligence: 0.38, discipline: 0.30, athleticism: 0.60, social: 0.78, curiosity: 0.55 }, seat: 'CLASS_1D_SEAT_04', act: ['CAFETERIA', 'COURTYARD'], hair: 0x6b4a2c, hairStyle: 'spiky', gender: 'm', spawn: 'gate', speed: 2.2 }
];

COHORT.forEach(c => {
  createStudentNPC(c.id, c.name, `${c.name} — Class 1-D Student.`, c.traits, c.seat, {
    hair: c.hair, hairStyle: c.hairStyle, gender: c.gender, skin: 0xf1c9a5, height: 0.98,
    spawnLoc: c.spawn, speed: c.speed, preferredActivities: c.act
  });
});

const playerAvatar = makeRig({ hair: 0xa89478, hairStyle: 'medium', gender: 'm', skin: 0xf0c9a0, blazer: 0xb23440, tie: 0xf3f1ea });
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
  if (t.discipline < 0.35) return pick(['cafe', 'dorm', 'courtyard', 'seaside']);
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
      return { loc: 'council', spotId: null, state: 'GOING_TO_ACTIVITY' };
    }
    if (evt.activity === 'ARRIVING_AT_SCHOOL') {
      return { loc: 'hall', spotId: null, state: 'IDLE_AT_DESTINATION' };
    }
    return { loc: 'hall', spotId: null, state: 'IDLE_AT_DESTINATION' };
  }

  // Student Decisions
  switch (evt.activity) {
    case 'ARRIVING_AT_SCHOOL': {
      const morningLoc = npc.spawnLoc || 'courtyard';
      npc.currentActivity = 'MORNING_LEISURE';
      npc.activityReason = `Spending early morning free time at ${LOC[morningLoc]?.label || 'campus'}.`;
      return { loc: morningLoc, spotId: null, state: 'ARRIVING_AT_SCHOOL' };
    }

    case 'CLASS':
    case 'AFTERNOON_CLASS': {
      let targetSpot = npc.assignedSeat;
      if (!targetSpot || !ReservationManager.reserve(targetSpot, npc.id)) {
        const avail = ReservationManager.findAvailableSpot('class1d', 'desk_seat');
        if (avail) {
          ReservationManager.reserve(avail.id, npc.id);
          targetSpot = avail.id;
        }
      }
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
      const nextState = chosenLoc === 'library' ? 'GOING_TO_LIBRARY' : (chosenLoc === 'gym' || chosenLoc === 'field' || chosenLoc === 'aquatic') ? 'GOING_TO_SPORTS' : 'GOING_TO_ACTIVITY';
      return { loc: chosenLoc, spotId, state: nextState };
    }

    case 'EVENING_LEISURE': {
      ReservationManager.releaseAllForNPC(npc.id);
      const eveLoc = pick(['mall', 'cafe', 'store', 'seaside', 'dorm']);
      npc.targetSpotId = null;
      npc.currentActivity = 'EVENING_FREE_TIME';
      npc.activityReason = `Spending free evening time at ${LOC[eveLoc].label}.`;
      return { loc: eveLoc, spotId: null, state: 'GOING_TO_ACTIVITY' };
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

// Multi-Stage Route Calculation with Traffic-Aware Candidate Selection
function routeNPCToSpot(npc, destLoc, spotId) {
  // Clean up previous route traffic
  if (npc.activeRouteNodes && npc.activeRouteNodes.length > 0) {
    TrafficManager.removeRouteTraffic(npc.id, npc.activeRouteNodes);
    npc.activeRouteNodes = [];
  }

  const p = npc.rig.root.position;
  const fromNode = nearestNode(p.x, p.z);
  const path = [];

  let chosenTargetNode = 'hub';
  let approachNode = null;
  let doorCoord = null;
  let interiorCoord = null;
  let doorKey = null;

  if (destLoc === 'class1d') {
    doorKey = 'class1d';
    // Approach variations based on departure slot or random hash
    const approaches = ['classA', 'classSouthCorr', 'classNorthCorr'];
    let h = 0;
    for (let i = 0; i < (npc.id || '').length; i++) h = (h * 31 + npc.id.charCodeAt(i)) & 0xffffffff;
    chosenTargetNode = approaches[Math.abs(h) % approaches.length];
    approachNode = ['classApproach1', 'classApproach2', 'classApproach3'][Math.abs(h) % 3];
    doorCoord = { x: -56.0, z: -20.0 };
    interiorCoord = { x: -60.0, z: -20.0 };
  } else if (destLoc === 'library') {
    doorKey = 'library';
    const approaches = ['libA', 'libNorthCorr', 'libSouthCorr'];
    let h = 0;
    for (let i = 0; i < (npc.id || '').length; i++) h = (h * 31 + npc.id.charCodeAt(i)) & 0xffffffff;
    chosenTargetNode = approaches[Math.abs(h) % approaches.length];
    approachNode = ['libApproach1', 'libApproach2', 'libApproach3'][Math.abs(h) % 3];
    doorCoord = { x: -50.0, z: 22.0 };
    interiorCoord = { x: -58.0, z: 22.0 };
  } else if (destLoc === 'cafeteria') {
    doorKey = 'cafeteria';
    const approaches = ['cafA', 'cafSouthCorr', 'cafNorthCorr'];
    let h = 0;
    for (let i = 0; i < (npc.id || '').length; i++) h = (h * 31 + npc.id.charCodeAt(i)) & 0xffffffff;
    chosenTargetNode = approaches[Math.abs(h) % approaches.length];
    approachNode = ['cafApproach1', 'cafApproach2', 'cafApproach3'][Math.abs(h) % 3];
    doorCoord = { x: 52.0, z: -20.0 };
    interiorCoord = { x: 58.0, z: -20.0 };
  } else if (destLoc === 'gym') {
    doorKey = 'gym';
    const approaches = ['gymA', 'gymNorthCorr', 'gymSouthCorr'];
    let h = 0;
    for (let i = 0; i < (npc.id || '').length; i++) h = (h * 31 + npc.id.charCodeAt(i)) & 0xffffffff;
    chosenTargetNode = approaches[Math.abs(h) % approaches.length];
    approachNode = ['gymApproach1', 'gymApproach2', 'gymApproach3'][Math.abs(h) % 3];
    doorCoord = { x: 50.0, z: 22.0 };
    interiorCoord = { x: 58.0, z: 22.0 };
  } else if (destLoc === 'hall' || destLoc === 'council') {
    chosenTargetNode = destLoc === 'council' ? 'councilA' : 'hallA';
  } else {
    chosenTargetNode = LOC[destLoc]?.node || 'hub';
  }

  // Dynamic Route Selection from RouteManager
  const routeResult = RouteManager.selectBestRoute(fromNode, chosenTargetNode, npc);
  const routeKeys = routeResult.route;
  npc.routeId = routeResult.routeId;
  npc.candidateRoutesCount = routeResult.allCandidates.length;
  npc.activeRouteNodes = [...routeKeys];

  // Register route traffic
  TrafficManager.addRouteTraffic(npc.id, routeKeys);

  // 1. Add corridor waypoints
  routeKeys.forEach(k => {
    if (NAV_NODES[k]) {
      path.push({ x: NAV_NODES[k][0], z: NAV_NODES[k][1], stage: 'HALLWAY', nodeKey: k });
    }
  });

  // 2. Add approach point
  if (approachNode && NAV_NODES[approachNode]) {
    path.push({ x: NAV_NODES[approachNode][0], z: NAV_NODES[approachNode][1], stage: 'DOOR_APPROACH', doorKey });
  }

  // 3. Add door threshold
  if (doorCoord) {
    path.push({ x: doorCoord.x, z: doorCoord.z, stage: 'DOOR', doorKey });
  }

  // 4. Add interior aisle
  if (interiorCoord) {
    path.push({ x: interiorCoord.x, z: interiorCoord.z, stage: 'INTERIOR_AISLE', doorKey });
  }

  // 5. Add final spot or interior target
  if (spotId && SPOTS[spotId]) {
    const s = SPOTS[spotId];
    path.push({ x: s.x, z: s.z, facing: s.facing, stage: 'SEAT', isSeat: true });
    npc.targetSpot = s;
  } else if (destLoc === 'class1d') {
    path.push({ x: -62.0, z: -20.0, facing: Math.PI, stage: 'INTERIOR' });
    npc.targetSpot = null;
  } else if (destLoc === 'hall' || destLoc === 'council') {
    path.push({ x: LOC[destLoc].c[0], z: LOC[destLoc].c[1], stage: 'INTERIOR' });
    npc.targetSpot = null;
  } else {
    const f = findFreeSpot(LOC[destLoc].c[0] + (Math.random() - 0.5) * 2, LOC[destLoc].c[1] + (Math.random() - 0.5) * 2, 0.5);
    path.push({ x: f.x, z: f.z, facing: Math.PI, stage: 'DESTINATION' });
    npc.targetSpot = null;
  }

  // Clean and deduplicate consecutive identical waypoints
  const cleanPath = [];
  for (let i = 0; i < path.length; i++) {
    if (i === 0 || Math.hypot(path[i].x - cleanPath[cleanPath.length - 1].x, path[i].z - cleanPath[cleanPath.length - 1].z) > 0.35) {
      cleanPath.push(path[i]);
    }
  }

  // Only apply mild lateral lane offset on wide open outdoor plaza nodes (never in narrow hallways or door approaches)
  const laneOffset = (npc.laneOffset || 0) * 0.45;
  for (let i = 0; i < cleanPath.length; i++) {
    const wp = cleanPath[i];
    if (wp.stage === 'PATH' && wp.nodeKey && (wp.nodeKey.startsWith('plaza') || wp.nodeKey.startsWith('court') || wp.nodeKey.startsWith('sea') || wp.nodeKey.startsWith('north'))) {
      wp.x += laneOffset;
    }
  }

  npc.path = cleanPath;
  npc.pathI = 0;
  npc._stuckTime = 0;
  npc._skips = 0;
}

// Steering and Obstacle/Crowd Avoidance
function planar(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }

function computeAvoidance(npc, vx, vz) {
  let ax = 0, az = 0;
  const p = npc.rig.root.position;

  // 1. Separate from other NPCs (Smooth local steering)
  for (const o of npcs) {
    if (o === npc) continue;
    const op = o.rig.root.position;
    const d = planar(p.x, p.z, op.x, op.z);
    if (d > 0.01 && d < 1.2) {
      const f = (1.2 - d) / 1.2;
      ax += ((p.x - op.x) / d) * f * 1.5;
      az += ((p.z - op.z) / d) * f * 1.5;
    }
  }

  // 2. Separate from Player
  const pd = planar(p.x, p.z, camera.position.x, camera.position.z);
  if (pd > 0.01 && pd < 1.5) {
    const pf = (1.5 - pd) / 1.5;
    ax += ((p.x - camera.position.x) / pd) * pf * 1.8;
    az += ((p.z - camera.position.z) / pd) * pf * 1.8;
  }

  return { x: vx + ax, z: vz + az };
}

function shortestAngle(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function stepNPCToTarget(npc, tx, tz, dt, isFinal = false) {
  const p = npc.rig.root.position;
  let dx = tx - p.x, dz = tz - p.z;
  const dist = Math.hypot(dx, dz);

  // 1. Intermediate Waypoint Arrival: Seamlessly pass through corner waypoints without deceleration halting
  if (!isFinal && dist < 0.95) {
    npc._stuckTime = 0;
    return true; // Immediately proceed to next waypoint along corner
  }

  // 2. Final Destination Arrival: Smoothly decelerate to a gentle stop
  if (isFinal && dist < 0.32) {
    npc.curSpeed = THREE.MathUtils.lerp(npc.curSpeed || 0, 0, dt * 7.5);
    if ((npc.curSpeed || 0) < 0.08) {
      npc.curSpeed = 0;
      npc.anim.moving = false;
      npc._stuckTime = 0;
      return true;
    }
  }

  dx /= (dist || 1); dz /= (dist || 1);
  const steer = computeAvoidance(npc, dx, dz);
  const sLen = Math.hypot(steer.x, steer.z) || 1;
  const vx = (steer.x / sLen);
  const vz = (steer.z / sLen);

  // 3. Smooth Heading Alignment & Turn Cornering Dynamics
  const targetYaw = Math.atan2(dx, dz);
  const angleDiff = shortestAngle(npc.facing, targetYaw);
  const turnRate = Math.max(-6.5, Math.min(6.5, angleDiff * 7.5));
  npc.facing += turnRate * dt;
  npc.anim.banking = THREE.MathUtils.lerp(npc.anim.banking || 0, -turnRate * 0.035, dt * 8.0);

  // Modulate speed gracefully around sharp corners
  const turnFactor = Math.max(0.45, Math.cos(angleDiff * 0.7));
  const baseTargetSpeed = isFinal && dist < 1.4 ? npc.speed * Math.max(0.35, dist / 1.4) : npc.speed;
  const targetSpeed = baseTargetSpeed * turnFactor;
  npc.curSpeed = THREE.MathUtils.lerp(npc.curSpeed || 0, targetSpeed, dt * 5.0);

  const step = (npc.curSpeed || targetSpeed) * dt;
  const sx = p.x, sz = p.z;
  const rad = 0.26; // Safe clearance radius for corridor corners
  let stepped = false;

  // 4. Multi-Vector Step Resolution with Corner Wall Sliding
  if (!collidesAt(p.x + vx * step, p.z + vz * step, rad)) {
    p.x += vx * step; p.z += vz * step; stepped = true;
  } else if (!collidesAt(p.x + dx * step, p.z + dz * step, rad)) {
    p.x += dx * step; p.z += dz * step; stepped = true;
  } else if (!collidesAt(p.x + dx * step, p.z, rad)) { // Slide along X
    p.x += dx * step; stepped = true;
  } else if (!collidesAt(p.x, p.z + dz * step, rad)) { // Slide along Z
    p.z += dz * step; stepped = true;
  } else {
    // 30-degree deflection test for tight corridor vertices
    const cos30 = 0.866, sin30 = 0.5;
    const defX1 = dx * cos30 - dz * sin30, defZ1 = dx * sin30 + dz * cos30;
    const defX2 = dx * cos30 + dz * sin30, defZ2 = -dx * sin30 + dz * cos30;
    if (!collidesAt(p.x + defX1 * step, p.z + defZ1 * step, rad)) {
      p.x += defX1 * step; p.z += defZ1 * step; stepped = true;
    } else if (!collidesAt(p.x + defX2 * step, p.z + defZ2 * step, rad)) {
      p.x += defX2 * step; p.z += defZ2 * step; stepped = true;
    }
  }

  const moved = stepped && Math.hypot(p.x - sx, p.z - sz) > step * 0.12;
  if (moved) {
    npc._stuckTime = 0;
    npc.anim.moving = true;
    npc.anim.phase += dt * (npc.curSpeed || npc.speed) * 2.8;
  } else {
    npc.anim.moving = false; // Immediately disable leg/arm swing when stationary
    npc._stuckTime = (npc._stuckTime || 0) + dt;

    // Stuck Recovery: Evasive Reroute after 3.2s
    if (npc._stuckTime > 3.2) {
      npc._stuckTime = 0;
      const near = nearestNode(p.x, p.z);
      if (near && npc._destLoc) {
        routeNPCToSpot(npc, npc._destLoc, npc._destSpotId);
      }
      return true;
    }
  }

  return false;
}

// Update Individual NPC Lifecycle & Animation State
function updateNPCBehavior(npc, dt, elapsed) {
  const p = npc.rig.root.position;
  npc.label.position.set(p.x, 2.05, p.z);
  if (npc.bubble) npc.bubble.position.set(p.x, 2.45, p.z);
  npc.anim.idleT += dt;
  npc.anim.talk = npc.speaking === true || activeNPC === npc || npc.state === 'TALKING';

  // Staggered Departure Delay: wait before beginning departure
  if (npc.departureDelay > 0) {
    npc.departureDelay -= dt;
    if (npc.departureDelay <= 0) {
      npc.departureDelay = 0;
      npc.isDeparted = true;
      npc.state = npc._intendedState || 'GOING_TO_CLASS';
      routeNPCToSpot(npc, npc._destLoc, npc._destSpotId);
    } else {
      // Waiting to depart — remain in natural standing idle animation
      npc.anim.moving = false;
      npc.curSpeed = 0;
      animateRig(npc.rig, npc.anim, dt);
      return;
    }
  }

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
  if (activeNPC === npc || npc.state === 'TALKING') {
    npc.anim.moving = false;
    npc.curSpeed = 0;
    npc.anim.mode = 'idle';
    const dx = camera.position.x - p.x, dz = camera.position.z - p.z;
    npc.facing = Math.atan2(dx, dz);
  } else if (npc.path && npc.path.length > 0 && npc.pathI < npc.path.length) {
    // Traveling to Destination Waypoints
    const isLast = npc.pathI === npc.path.length - 1;
    const wp = npc.path[npc.pathI];
    npc.anim.mode = 'idle';

    // Corner Shortcut Smoothing: If close to waypoint and next waypoint is clear, cut corner smoothly
    if (!isLast && npc.pathI + 1 < npc.path.length) {
      const nextWp = npc.path[npc.pathI + 1];
      const dToNext = Math.hypot(nextWp.x - p.x, nextWp.z - p.z);
      const dToCur = Math.hypot(wp.x - p.x, wp.z - p.z);
      if (dToNext < dToCur && dToCur < 1.6 && !collidesAt((p.x + nextWp.x) / 2, (p.z + nextWp.z) / 2, 0.28)) {
        npc.pathI++;
      }
    }

    // Doorway queueing and state progression
    if (wp.stage === 'DOOR_APPROACH' && wp.doorKey) {
      const canPass = DoorwayQueueManager.canEnterDoor(wp.doorKey, npc.id, clock.elapsedTime);
      if (!canPass) {
        // Yield at approach point
        npc.state = npc._destLoc === 'class1d' ? 'WAITING_AT_CLASS_DOOR' : 'WAITING_AT_DOOR';
        npc.curSpeed = 0;
        npc.anim.moving = false;
        animateRig(npc.rig, npc.anim, dt);
        return;
      }
    } else if (wp.stage === 'DOOR') {
      npc.state = npc._destLoc === 'class1d' ? 'ENTERING_CLASSROOM' : 'ENTERING_BUILDING';
    } else if (wp.stage === 'INTERIOR_AISLE') {
      if (wp.doorKey) DoorwayQueueManager.clearDoor(wp.doorKey, npc.id);
      npc.state = npc._destLoc === 'class1d' ? 'GOING_TO_SEAT' : 'FINDING_SEAT';
    } else if (wp.stage === 'SEAT') {
      npc.state = 'GOING_TO_SEAT';
    }

    if (stepNPCToTarget(npc, wp.x, wp.z, dt, isLast)) {
      npc.pathI++;
      if (npc.pathI >= npc.path.length) {
        // Arrived at destination!
        npc.anim.moving = false;
        npc.curSpeed = 0;
        npc.path = [];
        if (npc.activeRouteNodes && npc.activeRouteNodes.length > 0) {
          TrafficManager.removeRouteTraffic(npc.id, npc.activeRouteNodes);
          npc.activeRouteNodes = [];
        }
        npc.currentSpot = npc._destLoc || npc.currentSpot;
        if (wp.facing !== undefined) npc.facing = wp.facing;

        // Transition to arrived activity state
        if (npc._destLoc === 'class1d') {
          npc.state = npc.role === 'teacher' ? 'TEACHING_CLASS' : 'IN_CLASS';
          npc.anim.mode = npc.role === 'teacher' ? 'teach_lecture' : 'sit_desk';
        } else if (npc._destLoc === 'cafeteria') {
          npc.state = 'EATING';
          npc.anim.mode = 'sit_eat';
        } else if (npc._destLoc === 'library') {
          npc.state = 'STUDYING';
          npc.anim.mode = 'sit_read';
        } else if (npc._destLoc === 'gym' || npc._destLoc === 'field' || npc._destLoc === 'aquatic') {
          npc.state = 'PLAYING_SPORT';
          npc.anim.mode = 'sport_drill';
        } else if (npc._destLoc === 'cafe' || npc._destLoc === 'mall' || npc._destLoc === 'courtyard') {
          npc.state = 'SOCIALIZING';
          npc.anim.mode = 'idle';
        } else {
          npc.state = 'IDLE_AT_DESTINATION';
          npc.anim.mode = 'idle';
        }
      }
    }
  } else {
    // Performing Current Activity
    npc.anim.moving = false;
    npc.curSpeed = 0;
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

  const angleDiff = shortestAngle(npc.rig.root.rotation.y, npc.facing);
  npc.rig.root.rotation.y += angleDiff * Math.min(1, dt * 7.5);
  animateRig(npc.rig, npc.anim, dt);
}

// Master Schedule Tick Manager with Staggered Departures
let currentScheduleEvent = null;

function updateSchoolScheduleSystem() {
  const evt = getCurrentScheduleEvent(clockMin);
  if (!currentScheduleEvent || currentScheduleEvent.id !== evt.id) {
    const isInitial = (currentScheduleEvent === null);
    currentScheduleEvent = evt;
    showToast(`🔔 ${hhmm()} — ${evt.label}`);
    if (!isInitial) {
      CampusAudioEngine.playWestminsterChime();
    }

    for (let i = 0; i < npcs.length; i++) {
      const npc = npcs[i];
      const decision = evaluateNPCPurpose(npc, evt);
      npc._destLoc = decision.loc;
      npc._destSpotId = decision.spotId;
      npc._intendedState = decision.state;

      // Natural Staggered Timing Across Different Times (0.5s to 38.0s)
      if (npc.role === 'teacher') {
        npc.departureDelay = 0.5; // Teacher prepares first
      } else {
        const disc = npc.traits?.discipline ?? 0.5;
        if (npc.id === 'horikita') npc.departureDelay = 1.8;
        else if (npc.id === 'yukimura') npc.departureDelay = 3.2;
        else if (npc.id === 'hirata') npc.departureDelay = 5.0;
        else if (npc.id === 'kushida') npc.departureDelay = 10.5;
        else if (npc.id === 'sakura') npc.departureDelay = 14.0;
        else if (npc.id === 'karuizawa') npc.departureDelay = 18.5;
        else if (npc.id === 'sudou') npc.departureDelay = 24.0;
        else if (npc.id === 'ike') npc.departureDelay = 28.0;
        else if (npc.id === 'yamauchi') npc.departureDelay = 32.5;
        else if (npc.id === 'kouenji') npc.departureDelay = 38.0;
        else {
          const baseSlot = (i % 8) * 4.0;
          const personalityDelay = (1 - disc) * 12.0 + (i * 1.5) % 4.0;
          npc.departureDelay = Math.max(1.0, baseSlot + personalityDelay);
        }
      }
      npc.isDeparted = (npc.departureDelay <= 0.05);

      if (!npc.isDeparted) {
        npc.state = 'PREPARING_TO_LEAVE';
        npc.anim.moving = false;
      } else {
        npc.state = decision.state;
        routeNPCToSpot(npc, decision.loc, decision.spotId);
      }
    }
    updateDebugRoster();
  }
}

// =========================================================================
// 24-HOUR ASTRONOMICAL DIURNAL LIGHTING & SKY ENGINE
// =========================================================================
const diurnalBands = {
  dawn:    { top: new THREE.Color(0x2d2b55), bot: new THREE.Color(0xf59e0b), fog: new THREE.Color(0xd97706), sunColor: new THREE.Color(0xffddaa), sunInt: 1.5, hemiInt: 0.9, fogNear: 100, fogFar: 460 },
  day:     { top: new THREE.Color(0x2563eb), bot: new THREE.Color(0xe0f2fe), fog: new THREE.Color(0xd6e8f8), sunColor: new THREE.Color(0xfffaf0), sunInt: 2.5, hemiInt: 1.0, fogNear: 140, fogFar: 540 },
  sunset:  { top: new THREE.Color(0x581c87), bot: new THREE.Color(0xea580c), fog: new THREE.Color(0xc2410c), sunColor: new THREE.Color(0xff7733), sunInt: 1.8, hemiInt: 0.85, fogNear: 90, fogFar: 420 },
  night:   { top: new THREE.Color(0x030712), bot: new THREE.Color(0x0f172a), fog: new THREE.Color(0x080d1a), sunColor: new THREE.Color(0x88aaff), sunInt: 0.35, hemiInt: 0.45, fogNear: 50, fogFar: 280 }
};

const _curTop = new THREE.Color(), _curBot = new THREE.Color(), _curFog = new THREE.Color(), _curSun = new THREE.Color();

function updateDiurnalLighting(dt, elapsed = 0) {
  // 1. Orbital Sun / Moon trajectory
  const progress = ((clockMin - 360) / 1440) * Math.PI * 2;
  const sunDist = 240;
  const sx = Math.cos(progress) * sunDist * 0.85;
  const sy = Math.sin(progress) * sunDist;
  const sz = Math.cos(progress * 0.5) * 65;
  sun.position.set(sx, sy > 15 ? sy : 15 + (15 - sy) * 0.1, sz);

  // 2. Position visible celestial bodies (Sun & Moon)
  if (sunMesh && moonMesh) {
    sunMesh.position.set(sx, Math.max(-20, sy), sz);
    sunMesh.visible = (sy > -18);
    sunMat.color.copy(_curSun);
    sunGlowMat.uniforms.uColor.value.copy(_curSun);

    moonMesh.position.set(-sx, Math.max(-20, -sy), -sz);
    moonMesh.visible = (-sy > -18);
  }

  // 3. Twinkling Starfield Opacity
  if (starMat) {
    starMat.uniforms.uTime.value = elapsed;
    let targetStarAlpha = 0;
    if (clockMin >= 1080 && clockMin < 1200) targetStarAlpha = (clockMin - 1080) / 120; // Sunset fade-in
    else if (clockMin >= 1200 || clockMin < 300) targetStarAlpha = 1.0;                 // Midnight
    else if (clockMin >= 300 && clockMin < 390) targetStarAlpha = 1.0 - (clockMin - 300) / 90; // Dawn fade-out
    starMat.uniforms.uOpacity.value = THREE.MathUtils.lerp(starMat.uniforms.uOpacity.value, targetStarAlpha, Math.min(1, dt * 2));
  }

  // 4. Determine base astronomical time band
  let bandA, bandB, blendT = 0;
  if (clockMin >= 330 && clockMin < 480) { // 05:30 - 08:00 (Dawn -> Day)
    bandA = diurnalBands.dawn; bandB = diurnalBands.day; blendT = (clockMin - 330) / 150;
  } else if (clockMin >= 480 && clockMin < 990) { // 08:00 - 16:30 (Day)
    bandA = diurnalBands.day; bandB = diurnalBands.day; blendT = 0;
  } else if (clockMin >= 990 && clockMin < 1125) { // 16:30 - 18:45 (Sunset)
    bandA = diurnalBands.day; bandB = diurnalBands.sunset; blendT = (clockMin - 990) / 135;
  } else if (clockMin >= 1125 && clockMin < 1260) { // 18:45 - 21:00 (Sunset -> Night)
    bandA = diurnalBands.sunset; bandB = diurnalBands.night; blendT = (clockMin - 1125) / 135;
  } else if (clockMin >= 1260 || clockMin < 300) { // 21:00 - 05:00 (Deep Night)
    bandA = diurnalBands.night; bandB = diurnalBands.night; blendT = 0;
  } else { // 05:00 - 05:30 (Night -> Dawn)
    bandA = diurnalBands.night; bandB = diurnalBands.dawn; blendT = (clockMin - 300) / 30;
  }

  _curTop.copy(bandA.top).lerp(bandB.top, blendT);
  _curBot.copy(bandA.bot).lerp(bandB.bot, blendT);
  _curFog.copy(bandA.fog).lerp(bandB.fog, blendT);
  _curSun.copy(bandA.sunColor).lerp(bandB.sunColor, blendT);

  let targetSunInt = THREE.MathUtils.lerp(bandA.sunInt, bandB.sunInt, blendT);
  let targetHemiInt = THREE.MathUtils.lerp(bandA.hemiInt, bandB.hemiInt, blendT);
  let targetNear = THREE.MathUtils.lerp(bandA.fogNear, bandB.fogNear, blendT);
  let targetFar = THREE.MathUtils.lerp(bandA.fogFar, bandB.fogFar, blendT);

  // Weather overlay modulation
  if (wCur.rain > 0.1 || wTargetKey === 'storm' || wTargetKey === 'overcast') {
    const rainFactor = Math.min(1, (wCur.rain || 0.5) * 0.8);
    _curTop.lerp(new THREE.Color(0x374151), rainFactor);
    _curBot.lerp(new THREE.Color(0x6b7280), rainFactor);
    _curFog.lerp(new THREE.Color(0x4b5563), rainFactor);
    targetSunInt *= (1 - rainFactor * 0.7);
    targetHemiInt *= (1 - rainFactor * 0.4);
    targetFar = Math.min(targetFar, 220);
  }

  // Smooth lerp into active materials
  const k = Math.min(1, dt * 2.5);
  skyMat.uniforms.topC.value.lerp(_curTop, k);
  skyMat.uniforms.botC.value.lerp(_curBot, k);
  scene.fog.color.lerp(_curFog, k);
  scene.fog.near = THREE.MathUtils.lerp(scene.fog.near, targetNear, k);
  scene.fog.far = THREE.MathUtils.lerp(scene.fog.far, targetFar, k);
  sun.color.lerp(_curSun, k);
  sun.intensity = THREE.MathUtils.lerp(sun.intensity, targetSunInt + flash * 2.0, k);
  hemi.intensity = THREE.MathUtils.lerp(hemi.intensity, targetHemiInt + flash * 1.2, k);

  // 5. Night Lamp & Window Emissive Manager (Ignites at 17:30 / clockMin >= 1050 or < 360)
  const isNight = (clockMin >= 1050 || clockMin < 360);
  const lampTargetInt = isNight ? 2.4 : 0.0;
  const winTargetInt = isNight ? 1.6 : 0.0;

  for (let i = 0; i < campusNightLamps.length; i++) {
    const l = campusNightLamps[i];
    if (l.material && l.material.emissiveIntensity !== undefined) {
      l.material.emissiveIntensity = THREE.MathUtils.lerp(l.material.emissiveIntensity, lampTargetInt, k * 2);
    }
  }
  for (let i = 0; i < campusNightWindows.length; i++) {
    const w = campusNightWindows[i];
    if (w.material && w.material.emissiveIntensity !== undefined) {
      // Subtle window room variation
      const roomFlicker = 0.85 + Math.sin(i * 13.7) * 0.15;
      w.material.emissiveIntensity = THREE.MathUtils.lerp(w.material.emissiveIntensity, winTargetInt * roomFlicker, k * 2);
    }
  }
  for (let i = 0; i < campusNightPointLights.length; i++) {
    const pl = campusNightPointLights[i];
    const base = pl.userData.baseIntensity || 20;
    pl.intensity = THREE.MathUtils.lerp(pl.intensity, isNight ? base : 0, k * 2);
  }
}

// ---------- Dynamic Weather Engine ----------
const WEATHERS = {
  clear:    { icon: '☀️', name: 'Clear',    top: 0x4a93e0, bot: 0xe9f3fb, fog: 0xd6e8f8, near: 140, far: 520, sun: 2.5,  hemi: 1.00, rain: 0, cloud: 0.12, wet: 0.00 },
  cloudy:   { icon: '⛅', name: 'Cloudy',   top: 0x7fa3c4, bot: 0xe4ecf2, fog: 0xd6e0e8, near: 120, far: 440, sun: 1.6,  hemi: 0.95, rain: 0, cloud: 0.55, wet: 0.05 },
  overcast: { icon: '☁️', name: 'Overcast', top: 0x8d9aa6, bot: 0xd3d9dd, fog: 0xc9d1d6, near: 90,  far: 360, sun: 0.9,  hemi: 0.85, rain: 0, cloud: 0.9,  wet: 0.12 },
  rain:     { icon: '🌧️', name: 'Rain',     top: 0x6b7784, bot: 0xb9c2c8, fog: 0xa9b4bb, near: 60,  far: 260, sun: 0.5,  hemi: 0.72, rain: 1, cloud: 1.0,  wet: 0.34 },
  storm:    { icon: '⛈️', name: 'Storm',    top: 0x4d5661, bot: 0x929ba3, fog: 0x8b959c, near: 40,  far: 190, sun: 0.3,  hemi: 0.6,  rain: 1.7, cloud: 1.0, wet: 0.45 },
  sunset:   { icon: '🌇', name: 'Sunset',   top: 0x3f6ea8, bot: 0xf6c69a, fog: 0xe8b98f, near: 110, far: 420, sun: 1.8,  hemi: 0.9,  rain: 0, cloud: 0.35, wet: 0.02 },
};
const W_ORDER = ['clear', 'cloudy', 'overcast', 'rain', 'storm', 'sunset'];
const wCur = { ...WEATHERS.clear, top: new THREE.Color(0x4a93e0), bot: new THREE.Color(0xe9f3fb), fog: new THREE.Color(0xd6e8f8) };
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

  if (wTargetKey === 'storm' && Math.random() < dt * 0.35) flash = 1;
  flash = Math.max(0, flash - dt * 3.5);

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

function getClosestNPC(maxDist = 4.2) {
  let closest = null, bestScore = maxDist;
  const camDir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  for (const n of npcs) {
    if (!n.rig || !n.rig.root) continue;
    const p = n.rig.root.position;
    const d = planar(camera.position.x, camera.position.z, p.x, p.z);
    if (d < maxDist) {
      const toNPC = new THREE.Vector3(p.x - camera.position.x, 0, p.z - camera.position.z).normalize();
      const dot = camDir.dot(toNPC);
      const score = d - (dot > 0 ? dot * 0.75 : 0);
      if (score < bestScore) {
        bestScore = score;
        closest = n;
      }
    }
  }
  return closest;
}

addEventListener('keydown', e => {
  keys[e.code] = true;
  CampusAudioEngine.resumeOnGesture();
  if ((e.code === 'KeyE' || e.key === 'e' || e.key === 'E') && document.activeElement !== dlgInput) {
    if (dialogue.style.display !== 'flex' && storyEl.style.display !== 'flex') {
      const target = nearNPC || getClosestNPC(4.2);
      if (target) {
        openDialogue(target);
        e.preventDefault();
      }
    }
  }
  if (e.code === 'KeyV' && document.activeElement !== dlgInput) cycleWeather();
  if (e.code === 'KeyM' && document.activeElement !== dlgInput) toggleTTS();
  if ((e.code === 'KeyK' || e.code === 'KeyN') && document.activeElement !== dlgInput) toggleAudio();
  if (e.code === 'KeyP' && document.activeElement !== dlgInput) toggleTimePause();
  if (e.code === 'KeyC' && document.activeElement !== dlgInput) toggleDebugColliders();
  if (e.code === 'F4') { toggleAtmosphereStudio(); e.preventDefault(); }
  if (e.code === 'F3') { toggleDebugHUD(); e.preventDefault(); }
});
addEventListener('keyup', e => keys[e.code] = false);

const cv = renderer.domElement; cv.style.cursor = 'grab';
cv.addEventListener('mousedown', e => {
  CampusAudioEngine.resumeOnGesture();
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

// Raycasting to click directly on NPCs
const _raycaster = new THREE.Raycaster();
const _mouseVec = new THREE.Vector2();
cv.addEventListener('click', e => {
  CampusAudioEngine.resumeOnGesture();
  if (camMode !== 'free' || locked) return;
  const rect = cv.getBoundingClientRect();
  _mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  _mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  _raycaster.setFromCamera(_mouseVec, camera);
  const roots = npcs.map(n => n.rig?.root).filter(Boolean);
  const hits = _raycaster.intersectObjects(roots, true);
  if (hits.length > 0) {
    for (const h of hits) {
      let obj = h.object;
      while (obj) {
        if (obj.userData?.npc) {
          const target = obj.userData.npc;
          const dist = planar(camera.position.x, camera.position.z, target.rig.root.position.x, target.rig.root.position.z);
          if (dist <= 4.5 && dialogue.style.display !== 'flex' && storyEl.style.display !== 'flex') {
            openDialogue(target);
            return;
          }
        }
        obj = obj.parent;
      }
    }
  }
});

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
  if (document.pointerLockElement) { try { document.exitPointerLock(); } catch {} }
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
if (promptEl) {
  promptEl.onclick = () => {
    const target = nearNPC || getClosestNPC(4.5);
    if (target && dialogue.style.display !== 'flex' && storyEl.style.display !== 'flex') {
      openDialogue(target);
    }
  };
}

function updateProximity() {
  nearNPC = getClosestNPC(4.0);
  const busy = dialogue.style.display === 'flex' || storyEl.style.display === 'flex' || camMode !== 'free';
  if (nearNPC && !busy) {
    promptEl.style.display = 'block';
    promptEl.innerHTML = `Press <b>E</b> to talk to <b>${nearNPC.name}</b>`;
  } else {
    promptEl.style.display = 'none';
  }
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

// ---------- Simulation Clock & Pacing Engine ----------
let DAY_REAL_MIN = load('cote3dDayRealMin', 60); // 60 real minutes per full 24h cycle (calibrated for natural RPG exploration)
let timeSpeedScale = 1.0; // 0 = pause, 0.5x, 1.0x, 2.0x, 5.0x
let isTimePaused = false;
let clockMin = 7.75 * 60; // 07:45 Morning Arrival
let gameDay = load('cote3dDay', 1);

function getMinutesPerSecond() {
  return 1440 / (DAY_REAL_MIN * 60);
}

export function setTimeScale(scale) {
  timeSpeedScale = Math.max(0, scale);
  isTimePaused = (timeSpeedScale === 0);
  updateTimeSpeedUI();
  showToast(isTimePaused ? '⏸️ Simulation Time: Paused' : `⏱️ Simulation Speed: ${timeSpeedScale}x`, 1600);
}
window.setTimeScale = setTimeScale;

export function toggleTimePause() {
  if (isTimePaused || timeSpeedScale === 0) setTimeScale(1.0);
  else setTimeScale(0.0);
}
window.toggleTimePause = toggleTimePause;

const SPEED_OPTIONS = [1, 2, 5, 0];
export function cycleTimeSpeed() {
  const curIdx = SPEED_OPTIONS.indexOf(timeSpeedScale);
  const nextIdx = (curIdx + 1) % SPEED_OPTIONS.length;
  setTimeScale(SPEED_OPTIONS[nextIdx]);
}
window.cycleTimeSpeed = cycleTimeSpeed;

function updateTimeSpeedUI() {
  const spdMap = { 0: 'spd-btn-0', 0.5: 'spd-btn-05', 1: 'spd-btn-1', 2: 'spd-btn-2', 5: 'spd-btn-5' };
  Object.keys(spdMap).forEach(k => {
    const btn = $(spdMap[k]);
    if (btn) {
      if (parseFloat(k) === timeSpeedScale) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });
}

const clockChip = document.createElement('div');
clockChip.style.cssText = 'background:rgba(13,16,24,.88);border:1px solid var(--border);border-radius:10px;padding:8px 14px;font-size:13px;backdrop-filter:blur(10px);pointer-events:auto;cursor:pointer;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.5);';
clockChip.title = 'Click to cycle simulation speed (1x -> 2x -> 5x -> Pause) or press P';
clockChip.onclick = cycleTimeSpeed;
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
    const isSprint = (keys['ShiftLeft'] || keys['ShiftRight']);
    const speed = (isSprint ? 10 : 5.5) * dt;
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    let mx = 0, mz = 0;
    if (keys['KeyW'] || keys['ArrowUp']) { mx += fwd.x; mz += fwd.z; }
    if (keys['KeyS'] || keys['ArrowDown']) { mx -= fwd.x; mz -= fwd.z; }
    if (keys['KeyD'] || keys['ArrowRight']) { mx += right.x; mz += right.z; }
    if (keys['KeyA'] || keys['ArrowLeft']) { mx -= right.x; mz -= right.z; }
    const len = Math.hypot(mx, mz);
    const isMoving = len > 0;
    if (isMoving) { mx /= len; mz /= len; tryMove(camera.position.x + mx * speed, camera.position.z + mz * speed); }
    CampusAudioEngine.stepFootstep(dt, isMoving, isSprint, camera.position.x, camera.position.z, wCur.rain);
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

  // School Routine & NPC Update (Auto-pauses during active NPC dialogue & story narration)
  const inActiveConvo = (camMode === 'talk' || (dialogue && dialogue.style.display === 'flex') || (storyEl && storyEl.style.display === 'flex'));
  const effectiveSpeed = inActiveConvo ? 0.0 : (isTimePaused ? 0.0 : timeSpeedScale);

  const prevMin = clockMin;
  clockMin = (clockMin + dt * getMinutesPerSecond() * effectiveSpeed) % (24 * 60);
  if (clockMin < prevMin) { gameDay++; save('cote3dDay', gameDay); }
  updateSchoolScheduleSystem();

  for (const n of npcs) updateNPCBehavior(n, dt, elapsed);
  updateDiurnalLighting(dt, elapsed);
  updateWeather(dt, elapsed);
  CampusAudioEngine.updateAmbiance(dt, camera.position.x, camera.position.z, wCur.rain, flash, clockMin);
  updateDebugPathVisualizer();

  const evt = getCurrentScheduleEvent(clockMin);
  const statusPrefix = inActiveConvo ? '💬 ' : (isTimePaused ? '⏸️ ' : (timeSpeedScale !== 1 ? `⏩ ${timeSpeedScale}x ` : ''));
  clockChip.textContent = `${statusPrefix}🕗 ${hhmm()} · Day ${gameDay} · ${evt.label}`;

  updateProximity();
  updateSceneLabel();
  if (story.active) checkSceneArrival();
  renderer.render(scene, camera);
}

// ---------- 3D Route Visualizer & Path Lines Group ----------
const debugPathGroup = new THREE.Group();
debugPathGroup.name = 'DebugPaths';
scene.add(debugPathGroup);
let debugPathsVisible = true; // Enabled by default for immediate developer visibility

const NPC_ROUTE_COLORS = {
  horikita:   0x38bdf8,
  kushida:    0xf472b6,
  sudou:      0xef4444,
  kouenji:    0xf59e0b,
  chabashira: 0xa855f7,
  hirata:     0x10b981,
  karuizawa:  0xfb7185,
  yukimura:   0x6366f1,
  sakura:     0xec4899,
  ike:        0xeab308,
  yamauchi:   0x64748b
};

export function toggleDebugPaths() {
  debugPathsVisible = !debugPathsVisible;
  debugPathGroup.clear();
  const btn = $('dbg-toggle-paths');
  if (btn) btn.textContent = debugPathsVisible ? '🛣️ Visual Paths: ON' : '🛣️ Visual Paths: OFF';
  showToast(debugPathsVisible ? '🗺️ 3D Route Visualizer: ON (Showing multi-route paths)' : '🗺️ 3D Route Visualizer: OFF', 2500);
}
window.toggleDebugPaths = toggleDebugPaths;

function updateDebugPathVisualizer() {
  if (!debugPathsVisible) return;
  debugPathGroup.clear();
  for (const n of npcs) {
    if (!n.path || n.path.length <= 1 || n.pathI >= n.path.length) continue;
    const color = NPC_ROUTE_COLORS[n.id] || 0x38bdf8;
    const points = [];
    // Start from current NPC 3D position
    points.push(new THREE.Vector3(n.rig.root.position.x, 0.45, n.rig.root.position.z));
    for (let i = n.pathI || 0; i < n.path.length; i++) {
      points.push(new THREE.Vector3(n.path[i].x, 0.45, n.path[i].z));
    }
    if (points.length >= 2) {
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({ color, linewidth: 3, transparent: true, opacity: 0.85 });
      const line = new THREE.Line(geo, mat);
      debugPathGroup.add(line);

      // Waypoint destination nodes
      points.forEach((pt, pi) => {
        if (pi === 0) return;
        const spGeo = new THREE.SphereGeometry(pi === points.length - 1 ? 0.24 : 0.12, 8, 6);
        const spMat = new THREE.MeshBasicMaterial({ color });
        const spMesh = new THREE.Mesh(spGeo, spMat);
        spMesh.position.copy(pt);
        debugPathGroup.add(spMesh);
      });
    }
  }
}

// ---------- Automated Campus Navigation & Multi-Route Test Suite ----------
export function testCampusNavigation() {
  console.log('%c======================================================', 'color: #38bdf8; font-weight: bold;');
  console.log('%c🚀 RUNNING CAMPUS NAVIGATION & MULTI-ROUTE TEST SUITE', 'color: #38bdf8; font-weight: bold;');
  console.log('%c======================================================', 'color: #38bdf8; font-weight: bold;');

  const testPairs = [
    { name: 'School Entrance ➔ Classroom 1D', from: 'gateN', to: 'classDoor' },
    { name: 'Classroom 1D ➔ Cafeteria', from: 'classDoor', to: 'cafDoor' },
    { name: 'Cafeteria ➔ Memorial Library', from: 'cafDoor', to: 'libDoor' },
    { name: 'Cafeteria ➔ Sports Field & Gym', from: 'cafDoor', to: 'gymDoor' },
    { name: 'Memorial Library ➔ Classroom 1D', from: 'libDoor', to: 'classDoor' },
    { name: 'Sports Field ➔ Classroom 1D', from: 'fieldW', to: 'classDoor' }
  ];

  let passedCount = 0;
  const results = [];

  testPairs.forEach(t => {
    const candidates = RouteManager.findCandidateRoutes(t.from, t.to);
    const reachable = candidates.length > 0 && candidates[0].length > 0;
    const multiRoute = candidates.length >= 2;
    const success = reachable && multiRoute;

    if (success) passedCount++;

    const res = {
      test: t.name,
      reachable,
      candidateRoutes: candidates.length,
      primaryPath: candidates[0]?.join(' ➔ ') || 'NONE',
      alternatePath: candidates[1]?.join(' ➔ ') || 'NONE',
      status: success ? 'PASSED' : reachable ? 'PASSED (Single route)' : 'FAILED'
    };
    results.push(res);

    if (success) {
      console.log(`%c[PATH TEST PASSED] %c${t.name} — ${candidates.length} distinct valid candidate routes discovered.`, 'color: #10b981; font-weight: bold;', 'color: #cbd5e1;');
      console.log(`   Route A: ${candidates[0].join(' ➔ ')}`);
      console.log(`   Route B: ${candidates[1].join(' ➔ ')}`);
    } else if (reachable) {
      console.warn(`[PATH TEST WARNING] ${t.name} — Reachable but only 1 candidate route found.`);
    } else {
      console.error(`[PATH TEST FAILED] ${t.name} — No valid route found from ${t.from} to ${t.to}!`);
    }
  });

  console.log('%c======================================================', 'color: #38bdf8; font-weight: bold;');
  console.log(`%c📊 RESULT: ${passedCount}/${testPairs.length} Route Tests Passed with Multi-Route Candidate Diversity.`, passedCount === testPairs.length ? 'color: #10b981; font-weight: bold;' : 'color: #f59e0b; font-weight: bold;');
  console.log('%c======================================================', 'color: #38bdf8; font-weight: bold;');

  showToast(`🧪 Test Suite: ${passedCount}/${testPairs.length} Routes Validated with Multi-Path Diversity`, 4000);
  return results;
}
window.testCampusNavigation = testCampusNavigation;
window.validateCampusNavigation = testCampusNavigation;

// ---------- Debug Diagnostics HUD (F3) ----------
function toggleDebugHUD() {
  if (debugPanel.classList.contains('active')) debugPanel.classList.remove('active');
  else { debugPanel.classList.add('active'); updateDebugRoster(); }
}
if ($('dbg-close')) $('dbg-close').onclick = () => debugPanel.classList.remove('active');

// =========================================================================
// JAVA SIMULATION BACKEND CONNECTOR / BRIDGE
// =========================================================================
export const JavaSimulationBridge = {
  serverUrl: 'http://localhost:8080',
  connected: false,
  lastCheck: 0,

  async checkServer() {
    try {
      const res = await fetch(`${this.serverUrl}/api/health`, { method: 'GET', mode: 'cors', cache: 'no-cache' });
      if (res.ok) {
        const wasConnected = this.connected;
        this.connected = true;
        if (!wasConnected) {
          showToast('🟢 Connected to COTE Java Simulation Server (port 8080)', 3500);
          updateDebugRoster();
        }
        return true;
      }
    } catch {
      this.connected = false;
    }
    return false;
  },

  async fetchSimulationState() {
    if (!this.connected) return null;
    try {
      const res = await fetch(`${this.serverUrl}/api/simulation`, { method: 'GET', mode: 'cors', cache: 'no-cache' });
      if (res.ok) return await res.json();
    } catch {
      this.connected = false;
    }
    return null;
  },

  async setServerTime(hour) {
    if (!this.connected) return;
    try {
      await fetch(`${this.serverUrl}/api/time?hour=${hour}`, { method: 'POST', mode: 'cors' });
    } catch {}
  }
};
window.JavaSimulationBridge = JavaSimulationBridge;

// Check immediately on load and periodically every 5s
JavaSimulationBridge.checkServer();
setInterval(() => { JavaSimulationBridge.checkServer(); }, 5000);

window.skipToTime = function(h) {
  clockMin = h * 60;
  currentScheduleEvent = null;
  if (JavaSimulationBridge.connected) {
    JavaSimulationBridge.setServerTime(h);
  }
  updateSchoolScheduleSystem();
  CampusAudioEngine.playWestminsterChime();
  showToast(`⏩ Time skipped to ${hhmm()}`, 3000);
};

function updateDebugRoster() {
  if (!dbgRosterList) return;
  dbgRosterList.innerHTML = '';

  const headerRow = document.createElement('div');
  headerRow.style.cssText = 'padding:6px 10px;margin-bottom:8px;background:rgba(255,255,255,0.04);border-radius:6px;display:flex;justify-content:space-between;align-items:center;border:1px solid rgba(255,255,255,0.08);';
  headerRow.innerHTML = `
    <span style="font-size:11px;font-weight:600;color:#cbd5e1;">Engine Source:</span>
    ${JavaSimulationBridge.connected 
      ? '<span style="color:#10b981;font-size:11px;font-weight:700;">🟢 Java Server (port 8080 Active)</span>'
      : '<span style="color:#94a3b8;font-size:11px;">⚪ Local JS Engine (Standby for Java)</span>'}
  `;
  dbgRosterList.appendChild(headerRow);

  for (const n of npcs) {
    const row = document.createElement('div');
    row.className = 'dbg-npc-row';
    const trafficCost = n.activeRouteNodes ? TrafficManager.getRouteTrafficCost(n.activeRouteNodes).toFixed(1) : '0.0';
    const routeInfo = n.path && n.path.length > 0 ? `<b>${n.routeId}</b> [${n.pathI}/${n.path.length}] (alt: ${n.candidateRoutesCount || 1})` : 'Arrived / In Place';
    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;">
        <span class="dbg-npc-name">${n.name}</span>
        <span style="color:#f59e0b;font-size:10px;">${n.archetype || 'Student'}</span>
      </div>
      <div class="dbg-npc-state">State: <b>${n.state}</b> · Act: ${n.currentActivity}</div>
      <div class="dbg-npc-dest">Dest: ${LOC[n.currentSpot]?.label || n.currentSpot}${n.targetSpotId ? ` [${n.targetSpotId}]` : ''}</div>
      <div style="font-size:10px;color:#94a3b8;margin-top:2px;">Route: ${routeInfo} · Traffic: ${trafficCost}m</div>
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

// ---------- Dialogue & LLM Conversation Engine ----------
// ---------- Dynamic Dialogue & Real-Time LLM Engine (router.bynara.id / agnes-2.5-flash) ----------
function npcSystemPrompt(npc) {
  return `You are ${npc.name} from the anime/novel "Classroom of the Elite".
You are having a real, natural conversation with Ayanokouji Kiyotaka right now.

YOUR CHARACTER:
- Name: ${npc.name}
- Role: ${npc.role}
- Personality: ${npc.persona}
- Current Time: ${hhmm()} (${currentScheduleEvent?.label || 'School Day'})
- Current Location: ${LOC[npc.currentSpot]?.label || 'Campus'}
- What you are doing: ${npc.activityReason || npc.currentActivity || 'attending school'}

HOW TO RESPOND:
1. Speak EXACTLY as your character would — use their unique voice, speech patterns, and personality.
2. React naturally and specifically to what Ayanokouji just said. Never give a generic answer.
3. If he says goodbye/bye/see you/later, reply with a natural in-character farewell.
4. Keep your reply to 1-4 sentences of natural spoken dialogue.
5. After your dialogue, on a NEW LINE, write a compact JSON block ONLY like this (no other text):
{"s":{"trust":0,"love":0,"respect":0},"c":["reply option 1","reply option 2","reply option 3"]}

Where "s" has small stat shifts (-3 to +3) and "c" has 2-3 short natural reply suggestions Ayanokouji could say next.
DO NOT put any text after the JSON block.`;
}

function generateProceduralNPCDialogue(npc, playerText, opening) {
  const text = (playerText || '').trim().toLowerCase();
  const id = npc.id || '';
  const spot = LOC[npc.currentSpot]?.label || 'Campus';

  if (opening) {
    const greetings = {
      horikita: '...Ayanokouji-kun. Class is about to start. Did you need something, or are you just wandering around?',
      kushida: 'Ayanokouji-kun! Good morning! Isn\'t it exciting that we\'re all in Class D together? Let\'s make lots of friends!',
      sudou: 'Yo, Ayanokouji! Basketball drills were intense this morning. You heading over to class?',
      kouenji: 'Ah, an ordinary boy approaches perfection. What brings you into my presence today?',
      chabashira: 'Ayanokouji. Tardiness will not be tolerated in this institution. Take your seat immediately.',
      hirata: 'Good morning, Ayanokouji-kun! I\'m making sure everyone in Class D is ready for the day.',
      karuizawa: 'Oh, Ayanokouji-kun? Don\'t make it look like we\'re whispering. What\'s up?',
      yukimura: 'Ayanokouji. If you\'re not preparing for today\'s lecture, you\'re falling behind.',
      sakura: 'U-um... Ayanokouji-kun... h-hello... Did you need something from me...?',
      ike: 'Yooo, Ayanokouji! Did you see the 100,000 points?! What are you gonna buy first?!',
      yamauchi: 'Heh! Ayanokouji! You\'re looking at the future mastermind of Class 1-D!'
    };
    return { text: greetings[id] || `Hey, Ayanokouji. Good to see you at the ${spot}.`, statChanges: { trust: 1 }, choices: ['Good morning.', 'What are you doing right now?', 'See you in class.'] };
  }
  if (/(bye|goodbye|cya|see you|later|farewell|leaving|leave|gotta go)/i.test(text)) {
    const farewells = {
      horikita: '...Goodbye, Ayanokouji-kun. Make sure you are not late for homeroom.',
      kushida: 'Aww, leaving already? See you in class! Bye-bye!',
      sudou: 'Catch ya later! See you on the court or in class!',
      kouenji: 'Farewell, ordinary boy. Try not to miss my radiant presence too much.',
      chabashira: 'Proceed to your desk immediately. Class is beginning.',
      hirata: 'See you in class! Have a great day!',
      karuizawa: 'Yeah, whatever. Don\'t be late. See ya.',
      yukimura: 'Good. Less idle chatter means more focus on our studies.',
      sakura: 'B-bye, Ayanokouji-kun... take care!',
      ike: 'Later, dude! Let\'s catch up at lunch!',
      yamauchi: 'Peace out, Ayanokouji! The mastermind will see you in class!'
    };
    return { text: farewells[id] || 'See you later, Ayanokouji.', statChanges: { trust: 1 }, choices: ['See you.', 'Take care.', 'Have a good day.'] };
  }
  if (/^(hi|hello|hey|yo|sup|good morning|morning)/i.test(text)) {
    const hellos = {
      horikita: 'Good morning. Let us make sure today isn\'t wasted on pointless trivialities.',
      kushida: 'Hey! Seeing a friendly face always brightens up my morning!',
      sudou: 'Yo! Ready to tackle the day? Energy is everything!',
      kouenji: 'Greetings. Few are fortunate enough to begin their day beholding such elegance.',
      chabashira: 'Good morning. Do not let your guard down simply because the school seems relaxed.',
      hirata: 'Good morning! Always good to see you, Ayanokouji-kun.',
      karuizawa: 'Hey. Keep it casual, okay?',
      yukimura: 'Morning. I trust you\'ve reviewed today\'s chapters.',
      sakura: 'G-good morning... I hope you have a nice day...',
      ike: 'What\'s up, my man! Living the high school dream!',
      yamauchi: 'Yo! You\'re talking to a man with big plans!'
    };
    return { text: hellos[id] || `Hello, Ayanokouji.`, statChanges: { trust: 1 }, choices: ['How is your day?', 'What do you think of the S-System?', 'See you in class.'] };
  }
  const defaults = {
    horikita: 'I see your point, Ayanokouji-kun. However, actions speak far louder than words in this environment.',
    kushida: 'I totally get what you mean! It\'s really nice being able to talk openly with you like this.',
    sudou: 'Yeah, I hear ya. As long as we keep pushing forward, nothing can stop us!',
    kouenji: 'An amusing perspective from an ordinary observer. Do continue to observe my brilliance.',
    chabashira: 'Bear that in mind. In this school, every word and action has consequences.',
    hirata: 'I agree. Let\'s make sure we keep the harmony in our class.',
    karuizawa: 'Hmm, I suppose. Just don\'t make a big deal out of it.',
    yukimura: 'Logically speaking, you have a point. We must remain analytical.',
    sakura: 'I-I understand... Thank you for explaining that to me, Ayanokouji-kun...',
    ike: 'Totally agree, bro! We gotta stay on top of our game!',
    yamauchi: 'Just as I calculated! You and me, we\'re on the exact same wavelength!'
  };
  return { text: defaults[id] || `I understand, Ayanokouji. Let's see how things develop for Class D.`, statChanges: { trust: 1 }, choices: ['Tell me more.', 'I agree.', 'See you in class.'] };
}

function parseNPCResponse(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // Strategy 1: Pure legacy JSON {"text":...,"statChanges":...,"choices":...}
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed.text === 'string' && parsed.text.length > 0) {
        return { text: parsed.text, statChanges: parsed.statChanges || parsed.s || {}, choices: parsed.choices || parsed.c || [] };
      }
    } catch {}
  }

  // Strategy 2: New format — spoken text then compact JSON on a new line
  const jsonLineMatch = trimmed.match(/^([\s\S]*?)\n(\{[^\n]+\})\s*$/);
  if (jsonLineMatch) {
    const spokenText = jsonLineMatch[1].trim();
    if (spokenText.length > 0) {
      let statChanges = {}, choices = [];
      try { const meta = JSON.parse(jsonLineMatch[2]); statChanges = meta.s || meta.statChanges || {}; choices = meta.c || meta.choices || []; } catch {}
      return { text: spokenText, statChanges, choices };
    }
  }

  // Strategy 3: Any JSON block embedded in a longer response
  const allBlocks = Array.from(trimmed.matchAll(/\{[^{}]*\}/g)).reverse();
  for (const m of allBlocks) {
    try {
      const meta = JSON.parse(m[0]);
      const spokenText = trimmed.replace(m[0], '').trim();
      if (spokenText.length > 0) {
        return { text: spokenText, statChanges: meta.s || meta.statChanges || {}, choices: meta.c || meta.choices || [] };
      }
    } catch {}
  }

  // Strategy 4: Pure plain-text dialogue from the model — use it directly
  if (trimmed.length > 0) {
    return { text: trimmed, statChanges: {}, choices: ['I see.', 'Tell me more.', 'I should get going.'] };
  }

  return null;
}

function addLine(kind, who, text, chips) {
  const el = document.createElement('div');
  el.className = `line ${kind}`;
  el.innerHTML = kind === 'sys' ? `<div>${escapeHtml(text)}</div>` : `<div class="who">${who}</div><div>${escapeHtml(text)}</div>`;
  if (chips) el.insertAdjacentHTML('beforeend', chips);
  dlgLog.appendChild(el);
  dlgLog.scrollTop = dlgLog.scrollHeight;
}

function renderChoices(list) {
  dlgChoices.innerHTML = '';
  (list || []).forEach(txt => {
    const b = document.createElement('button');
    b.className = 'choice';
    b.textContent = txt;
    b.onclick = () => submit(txt);
    dlgChoices.appendChild(b);
  });
}

function openDialogue(npc) {
  if (!npc) return;
  CampusAudioEngine.playDialogueChirp();
  activeNPC = npc;

  // Cache state and pause movement
  npc._preTalkState = npc.state;
  npc._preTalkMode = npc.anim ? npc.anim.mode : 'idle';
  npc._preTalkFacing = npc.facing;
  npc.state = 'TALKING';
  npc.anim.moving = false;
  npc.curSpeed = 0;

  // Face toward player avatar/camera
  const p = npc.rig.root.position;
  const dx = camera.position.x - p.x, dz = camera.position.z - p.z;
  npc.facing = Math.atan2(dx, dz);

  if (npc.bubble) {
    npc.bubble.visible = false;
    npc.bubbleUntil = 0;
  }

  convo = (memory[npc.name] || []).slice();
  const s = soc(npc.name);
  s.talks++;
  saveSocial();

  dlgName.textContent = `${npc.name}  ·  ${LOC[npc.currentSpot]?.label || 'Campus'}  ·  ${npc.currentActivity || 'Active'}`;
  dlgLog.innerHTML = '';
  dlgChoices.innerHTML = '';

  for (const m of convo) {
    if (m.role === 'user' && m._hidden) continue;
    if (m.role === 'user') {
      const txt = m.parts?.[0]?.text ?? (typeof m.content === 'string' ? m.content : '');
      if (txt) addLine('me', 'You', txt);
    } else {
      let txt = m.parts?.[0]?.text ?? (typeof m.content === 'string' ? m.content : '');
      try { const p = JSON.parse(txt); if (p && p.text) txt = p.text; } catch {}
      if (txt) addLine('npc', npc.name, txt);
    }
  }

  dialogue.style.display = 'flex';
  if (promptEl) promptEl.style.display = 'none';
  beginTalkCam(npc);

  if (convo.length === 0) {
    sendToNPC('[Ayanokouji walks up to you. Greet or react in character based on what you are doing.]', true);
  } else {
    addLine('sys', '', `— you approach ${npc.name} —`);
    sendToNPC('[Ayanokouji approaches you again.]', true);
  }
}

async function sendToNPC(playerText, opening = false) {
  if (!opening) addLine('me', 'You', playerText);
  const userMsg = { role: 'user', parts: [{ text: playerText }] };
  if (opening) userMsg._hidden = true;
  convo.push(userMsg);
  renderChoices([]);
  dlgThinking.style.display = 'block';
  dlgInput.disabled = true;
  const npc = activeNPC;

  let parsed = null;

  // Always fetch key fresh so mid-game key button works without page reload
  const activeKey = (localStorage.getItem('naraApiKey') || apiKey || '').trim();

  // 1. Live AI call to router.bynara.id with model agnes-2.5-flash
  if (activeKey.length > 0) {
    try {
      // Build clean message history — strip internal markers, unwrap old JSON assistant turns
      const visibleMsgs = convo.slice(-MAX_MEMORY_TURNS).map(m => {
        const role = (m.role === 'model' || m.role === 'assistant') ? 'assistant' : 'user';
        let content = m.parts?.[0]?.text ?? (typeof m.content === 'string' ? m.content : '');
        if (role === 'assistant') {
          const p = parseNPCResponse(content);
          if (p && p.text) content = p.text;
        }
        return { role, content };
      });

      const res = await fetch(`${API_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeKey}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'system', content: npcSystemPrompt(npc) }, ...visibleMsgs],
          temperature: 0.88,
          max_tokens: 380
        })
      });

      if (res.ok) {
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content;
        if (raw && raw.trim().length > 0) {
          convo.push({ role: 'model', parts: [{ text: raw }] });
          memory[npc.name] = convo;
          save('cote3dConvos', memory);
          parsed = parseNPCResponse(raw);
        }
      } else {
        console.warn(`router.bynara.id HTTP ${res.status}:`, res.statusText);
      }
    } catch (err) {
      console.warn('AI fetch error:', err.message);
    }
  }

  // 2. Offline fallback — only when AI is unavailable or no key set
  if (!parsed || !parsed.text) {
    parsed = generateProceduralNPCDialogue(npc, playerText, opening);
    convo.push({ role: 'model', parts: [{ text: JSON.stringify(parsed) }] });
    memory[npc.name] = convo;
    save('cote3dConvos', memory);
  }

  // Render NPC reply, stat chips, TTS, and player reply suggestions
  const chips = Object.entries(parsed.statChanges || {})
    .filter(([k, v]) => k in stats && v !== 0)
    .map(([k, v]) => `<span class="chip ${v > 0 ? 'up' : 'down'}">${STAT_ICONS[k]} ${v > 0 ? '+' : ''}${v}</span>`)
    .join('');

  addLine('npc', npc.name, parsed.text || '…', chips ? `<div class="chips">${chips}</div>` : '');
  speakAs(npc.name, parsed.text, 2, npc);
  applyStats(parsed.statChanges);
  renderChoices(parsed.choices);

  dlgThinking.style.display = 'none';
  dlgInput.disabled = false;
  dlgInput.focus();
}

function submit(text) {
  const t = (text ?? dlgInput.value).trim();
  if (!t) return;
  dlgInput.value = '';
  sendToNPC(t);
}

function closeDialogue() {
  dialogue.style.display = 'none';
  stopSpeech();
  const npc = activeNPC;
  activeNPC = null;

  if (npc) {
    // Check if schedule event changed while in conversation
    const currentEvt = getCurrentScheduleEvent(clockMin);
    const decision = evaluateNPCPurpose(npc, currentEvt);

    if (decision.loc !== npc.currentSpot && decision.loc !== npc._destLoc) {
      npc._destLoc = decision.loc;
      npc._destSpotId = decision.spotId;
      npc.state = decision.state;
      routeNPCToSpot(npc, decision.loc, decision.spotId);
    } else if (npc.path && npc.path.length > 0 && npc.pathI < npc.path.length) {
      // Resume path route
      npc.state = npc._intendedState || npc._preTalkState || 'GOING_TO_CLASS';
      npc.anim.mode = 'idle';
    } else if (npc._preTalkState === 'IN_CLASS') {
      npc.state = 'IN_CLASS';
      npc.anim.mode = 'sit_desk';
      if (npc.targetSpot && npc.targetSpot.facing !== undefined) npc.facing = npc.targetSpot.facing;
      else if (npc._preTalkFacing !== undefined) npc.facing = npc._preTalkFacing;
    } else if (npc._preTalkState === 'TEACHING_CLASS') {
      npc.state = 'TEACHING_CLASS';
      npc.anim.mode = 'teach_lecture';
      if (npc.targetSpot && npc.targetSpot.facing !== undefined) npc.facing = npc.targetSpot.facing;
      else if (npc._preTalkFacing !== undefined) npc.facing = npc._preTalkFacing;
    } else if (npc._preTalkState === 'STUDYING') {
      npc.state = 'STUDYING';
      npc.anim.mode = 'sit_read';
      if (npc.targetSpot && npc.targetSpot.facing !== undefined) npc.facing = npc.targetSpot.facing;
      else if (npc._preTalkFacing !== undefined) npc.facing = npc._preTalkFacing;
    } else if (npc._preTalkState === 'EATING') {
      npc.state = 'EATING';
      npc.anim.mode = 'sit_eat';
      if (npc.targetSpot && npc.targetSpot.facing !== undefined) npc.facing = npc.targetSpot.facing;
      else if (npc._preTalkFacing !== undefined) npc.facing = npc._preTalkFacing;
    } else if (npc._preTalkState === 'PLAYING_SPORT') {
      npc.state = 'PLAYING_SPORT';
      npc.anim.mode = 'sport_drill';
      if (npc._preTalkFacing !== undefined) npc.facing = npc._preTalkFacing;
    } else {
      npc.state = npc._preTalkState || 'IDLE_AT_DESTINATION';
      npc.anim.mode = npc._preTalkMode || 'idle';
      if (npc.targetSpot && npc.targetSpot.facing !== undefined) npc.facing = npc.targetSpot.facing;
      else if (npc._preTalkFacing !== undefined) npc.facing = npc._preTalkFacing;
    }
  }

  endTalkCam();
}

$('dlg-send').onclick = () => submit();
dlgInput.addEventListener('keypress', e => { if (e.key === 'Enter') submit(); });
$('dlg-close').onclick = closeDialogue;
if ($('dlg-key-btn')) {
  $('dlg-key-btn').onclick = () => {
    const currentKey = apiKey || '';
    const newKey = prompt('Enter your router.bynara.id API Key (Model: agnes-2.5-flash):', currentKey);
    if (newKey !== null) {
      apiKey = newKey.trim();
      localStorage.setItem('naraApiKey', apiKey);
      canTalk = apiKey.length > 0;
      if (keyInput) keyInput.value = apiKey;
      showToast(apiKey ? '✅ API key saved for router.bynara.id (agnes-2.5-flash)' : 'ℹ️ Offline AI mode active');
    }
  };
}
addEventListener('keydown', e => { if (e.code === 'Escape' && dialogue.style.display === 'flex') closeDialogue(); });
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

window.openDialogue = openDialogue;
window.closeDialogue = closeDialogue;
window.getClosestNPC = getClosestNPC;

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
const SCENE_FALLBACK_NARRATIONS = {
  gate: { speaker: 'Narrator', text: 'April at the Advanced Nurturing High School. The government established this school to nurture students who will support the country\'s future. We disembarked from the school bus and passed beneath the towering gates.' },
  hall: { speaker: 'Narrator', text: 'Inside the grand Main Academic Hall, the entrance ceremony was conducted with solemn precision. The Student Council President stood on the stage, delivering a speech that emphasized capability above all else.' },
  homeroom: { speaker: 'Chabashira', text: 'Welcome to Class 1-D. Each of you has been granted 100,000 private points on your S-System terminals. In this school, you can buy anything using these points. But remember: your points reflect your value.' },
  intro: { speaker: 'Hirata', text: 'Hello everyone! I\'m Yousuke Hirata. Let\'s all introduce ourselves so we can get to know each other and make our high school days memorable as a united class!' },
  after: { speaker: 'Narrator', text: 'After school ended, students dispersed across the vast campus. Keyaki Mall and the cafés were bustling with excited conversations, with classmates spending points freely without a care in the world.' },
  weeks: { speaker: 'Narrator', text: 'The first weeks passed in an idyllic blur of luxury. Free meals, high-end electronics, and carefree lectures. Yet, an uneasy silence lingered beneath the surface.' },
  may1: { speaker: 'Chabashira', text: 'It is May 1st. Today is the scheduled point deposit. However, Class 1-D has received exactly 0 points. Did you truly believe a school for the elite would give you free money without consequence?' }
};

async function narrateScene(force) {
  const sc = currentScene(); if (!sc) return;
  if (story.narrated[sc.id] && !force) return;
  story.narrated[sc.id] = true; save('cote3dStory', story);
  storyEl.style.display = 'flex'; storySpeaker.textContent = 'Narrator'; storyText.textContent = '';
  if (camMode === 'free' && document.pointerLockElement) document.exitPointerLock();
  storyThinking.style.display = 'block';

  let p = null;
  if (apiKey && apiKey.trim().length > 0) {
    try {
      storyConvo.push({ role: 'user', parts: [{ text: sc.prompt }] });
      const res = await fetch(`${API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: 'You are the Narrator of Classroom of the Elite Vol 1. Keep it short (60-100 words). Return JSON: {"speaker":"Narrator","text":"..."}' },
            ...toChatMessages(storyConvo.slice(-16))
          ],
          temperature: 0.85
        })
      });

      if (res.ok) {
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content;
        if (raw) {
          storyConvo.push({ role: 'model', parts: [{ text: raw }] });
          save('cote3dStoryConvo', storyConvo);
          p = parseNPCResponse(raw);
        }
      }
    } catch (e) {
      console.warn('Live narration fetch failed, using story script:', e);
    }
  }

  if (!p || !p.text) {
    p = SCENE_FALLBACK_NARRATIONS[sc.id] || { speaker: 'Narrator', text: sc.objective };
  }

  storySpeaker.textContent = p.speaker || 'Narrator';
  storyText.textContent = p.text || '';
  speakAs(VOICE_STYLE[p.speaker] ? p.speaker : 'Narrator', p.text, 2);
  storyThinking.style.display = 'none';
}
function enterScene(i) {
  CampusAudioEngine.playObjectiveJingle();
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
  CampusAudioEngine.resumeOnGesture();
  CampusAudioEngine.playWestminsterChime();
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

initAtmosphereStudio();
updateObjective();
testCampusNavigation();
updateSchoolScheduleSystem();
animate();
