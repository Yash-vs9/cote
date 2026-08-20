# Phase 2: Atmosphere, Web Audio SFX & Astronomical Lighting

This document outlines the complete technical specification, architectural design, and step-by-step task breakdown for **Phase 2: Audiovisual Polish & Java-Synced Diurnal Lighting**.

---

## 1. Subsystem 1: Procedural Web Audio Sound Engine (SFX & Ambiance)

### A. What Should Be Changed
- Create a dedicated, self-contained `CampusAudioEngine` inside [game3d-campus.js](file:///h:/HARSH_PROJECTS/PERSONAL%20PROJECT/cote/game3d-campus.js) using the native HTML5 **Web Audio API** (`AudioContext`, `OscillatorNode`, `GainNode`, `BiquadFilterNode`, `PannerNode` / distance attenuation).
- Add audio cues for:
  1. **Westminster School Period Chimes** (automatically triggered on Java simulation timetable transitions).
  2. **Player Footsteps** with surface-type audio modulation (wood, tile, grass, gravel).
  3. **Spatial Environmental Ambiance** (fountain splash, ocean surf, dining room murmur).
  4. **Weather Audio** (rain patter, storm thunder rumbles).
- Add an audio toggle button and volume slider in the HUD.

### B. Why It Is Changing
- Currently, the 3D campus is completely silent except for character Web Speech TTS voices.
- Environmental audio is vital for immersion during school period changes, hallway walking, and weather shifts.
- Using native Web Audio synthesis ensures **100% offline, zero-asset, zero-lag sound reproduction** that loads instantly over the Java web server.

### C. What It Will Do
1. **Westminster School Bell**:
   - Synthesizes the iconic 4-note Japanese school chime sequence:
     $$\text{Notes: } E_4 (329.63\text{ Hz}) \rightarrow G_4 (392.00\text{ Hz}) \rightarrow F_4 (349.23\text{ Hz}) \rightarrow B_3 (246.94\text{ Hz})$$
   - Dual sine wave oscillators with chorus detune ($+2\text{ Hz}$) and exponential decay gain envelope ($\tau = 1.8\text{s}$) produce metallic brass bell resonance.
   - Automatically triggers whenever `currentScheduleEvent` updates from the Java simulation backend or when `window.skipToTime()` is called.

2. **Surface-Aware Footstep Synthesizer**:
   - Fires rhythmic footstep pulses whenever player velocity $> 0.1\text{ m/s}$.
   - Detects the ground material at player $(x, z)$:
     - **Classroom / Gym (Wood)**: Bandpass noise burst ($1200\text{ Hz}$) with high-Q wooden knock ($180\text{ Hz}$).
     - **Hallways & Mall (Tile/Stone)**: Crisp high-frequency snap ($2800\text{ Hz}$) with quick damping ($45\text{ms}$).
     - **Courtyard / Central Park (Grass/Dirt)**: Low-pass filtered rustle ($600\text{ Hz}$).
     - **Seaside Promenade (Boardwalk / Gravel)**: Dual-grain crunch.
   - Step interval shifts between **sprint** ($280\text{ms}$) and **walk** ($440\text{ms}$).

3. **Spatial Environmental Audio**:
   - **Central Park Fountain**: Pink noise passed through a resonant bandpass filter ($450\text{ Hz} - 1800\text{ Hz}$) with distance gain attenuation based on distance to $(0, 8)$.
   - **Seaside Boulevard Ocean**: Low-frequency pink noise oscillating with sinusoidal swell period ($T = 5.5\text{s}$) simulating incoming and receding ocean waves.
   - **Rain & Thunder**: White noise generator linked to `wCur.rain` intensity; low-frequency pitch-shifted resonant bursts when `flash > 0.8` (lightning).

---

## 2. Subsystem 2: 24-Hour Orbital Sun & Java-Synced Diurnal Lighting

### A. What Should Be Changed
- Overhaul `updateWeather(dt, elapsed)` in [game3d-campus.js](file:///h:/HARSH_PROJECTS/PERSONAL%20PROJECT/cote/game3d-campus.js) to couple celestial lighting with the authoritative Java server simulation clock `clockMin` ($0 \dots 1440$).
- Orbit the main directional light `sun` along a diurnal celestial arc.
- Interpolate skybox zenith/nadir shader colors and fog densities across 4 distinct astronomical time bands.
- Add an automated emissive lighting manager that turns ON streetlamps, courtyard lanterns, and building interior window glows at dusk (`17:30 - 06:00`).

### B. Why It Is Changing
- Currently, the sun position is static at `(3, 6, 4)` and disconnected from the in-game clock.
- Nighttime in the current build is unnaturally bright, making dormitory curfew hours visually indistinguishable from morning homeroom.

### C. What It Will Do
1. **Orbital Sun & Moon Trajectory**:
   - Calculates the solar elevation angle $\theta_{\text{sun}}$ directly from Java in-game time:
     $$\text{Solar Progress } t = \frac{\text{clockMin}}{1440} \times 2\pi - \frac{\pi}{2}$$
     $$\text{Sun Position } = \left( 120 \cos(t), \, 120 \sin(t), \, 40 \cos(t) \right)$$
   - At night ($\sin(t) < 0$), the sun dips below the horizon, and the directional light switches to pale blue moonlight ($0.25$ intensity).

2. **4 Diurnal Sky & Lighting Bands**:
   - **Dawn (`05:30 - 08:00`)**: Amber/rose zenith (`#1e1b4b` $\rightarrow$ `#f59e0b`), soft golden sunlight intensity ($1.4$).
   - **Daylight (`08:00 - 16:30`)**: Crisp azure sky (`#0284c7` $\rightarrow$ `#bae6fd`), pure white sunlight intensity ($2.4$).
   - **Sunset (`16:30 - 18:45`)**: Crimson/orange horizon (`#7c2d12` $\rightarrow$ `#ea580c`), warm side-angle illumination ($1.8$).
   - **Night (`18:45 - 05:30`)**: Deep midnight obsidian (`#030712` $\rightarrow$ `#0f172a`), silver-blue moonlight ($0.35$).

3. **Campus Night Lamp & Window Emissive Manager**:
   - When $\text{clockMin} \ge 1050$ ($17:30$) or $\text{clockMin} < 360$ ($06:00$), smoothly ramps the emissive intensity of lamp bulbs to $2.5$ (`#fef08a` warm tungsten glow) and turns ON point lights along main promenades.

---

## 3. Subsystem 3: Codebase Cleanliness & Asset Standardization

### A. What Should Be Changed
- Reconcile and clean duplicate / outdated files in `3d-game/`.
- Ensure [game3d-campus.html](file:///h:/HARSH_PROJECTS/PERSONAL%20PROJECT/cote/game3d-campus.html) in root and `3d-game/game3d-campus.html` reference the single-source-of-truth modular script [game3d-campus.js](file:///h:/HARSH_PROJECTS/PERSONAL%20PROJECT/cote/game3d-campus.js).
- Fix corrupted UTF-8 special characters in legacy HTML files.

### B. Why It Is Changing
- Eliminates divergence between root and subfolder assets, ensuring the Java server hosts clean, identical files across all launch paths.

### C. What It Will Do
- Unifies launcher targets so both `http://localhost:8080/game3d-campus.html` and `http://localhost:8080/index.html` load the identical, pristine engine without duplication.

---

## 🛠️ Step-by-Step Implementation Task Checklist

- [ ] **Task 2.1: Build `CampusAudioEngine` Synthesizer**
  - Implement Web Audio context initialization on first user gesture.
  - Create synthesized oscillators for Westminster chime, footsteps, and spatial loops.
- [ ] **Task 2.2: Integrate Timetable Chime & Footstep Events**
  - Hook chime trigger into Java timetable transition events.
  - Hook footstep trigger into `tryMove()` with surface type detection.
- [ ] **Task 2.3: Construct 24h Celestial Sun Orbit & Dynamic Shaders**
  - Update `sun.position` and `sun.intensity` based on orbital trigonometry in `animate()`.
  - Interpolate skybox uniforms (`topC`, `botC`) and `scene.fog` across diurnal bands.
- [ ] **Task 2.4: Implement Night Emissive Streetlamp & Window System**
  - Register lamppost meshes during campus generation.
  - Implement night illumination trigger at `17:30`.
- [ ] **Task 2.5: Reconcile `3d-game/` Directory Files**
  - Update `3d-game/game3d-campus.html` to reference modular `game3d-campus.js` and fix UTF-8 character encoding.
- [ ] **Task 2.6: Verification & Diagnostic Testing**
  - Use `F3` HUD to skip through all time slots (`07:45`, `12:15`, `18:30`, `21:00`) and verify:
    1. Chime plays accurately at each period start.
    2. Sun moves smoothly across the sky.
    3. Streetlamps ignite at night.
    4. Audio volume controls work cleanly without console errors.
