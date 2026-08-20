# Classroom of the Elite (COTE) — 3D Campus World & Simulation Engine

A full 3D interactive simulation of Tokyo Metropolitan Advanced Nurturing High School from *Classroom of the Elite*, featuring multi-route NPC pathfinding, daily schedule simulation, 3rd-person spring-arm camera, interactive world stations, procedural 3D hand props, procedural Web Audio acoustics, 24-hour astronomical celestial sky, dynamic weather, and generative AI character dialogues.

---

## 🏛️ Project Architecture

```
cote/
├── index.html                  # ANHS Master Portal & Unified Launcher Hub
├── game3d-campus.html / .js    # Flagship 3D Simulation Client (WebGL / Three.js)
├── 3d-game/                    # Standalone Web build
├── java-server/                # Authoritative Java Simulation Backend (JDK 17+)
│   ├── src/main/java/...       # RouteManager, TrafficManager, ReservationManager, Server
│   └── src/test/java/...       # JUnit 5 Multi-Route & Schedule Test Suites
├── game-client/                # Native Java Desktop 3D Client (jMonkeyEngine 3)
├── 2d-rpg/                     # 2D AI Decision & Checkpoint Narrative RPG
├── blueprints/                 # 15 Standalone 3D Building Diorama Blueprints
└── improvement/                # Architecture specifications & Phase 1–4 roadmaps
```

---

## 🌟 Key Features

### 🎥 Third-Person Spring-Arm Camera & Player Locomotion (Phase 3)
- **Seamless Perspective Toggle (`F5` & Mouse Wheel)**: Switch instantly between First-Person (`FPS`) and Third-Person Over-The-Shoulder (`TPS`). Mouse scroll dynamically zooms distance between $0.8\text{m}$ and $5.5\text{m}$.
- **Spring-Arm Wall Collision Avoidance**: Raycasts from player head level against all building colliders to smoothly clamp camera distance and eliminate wall-clipping artifacts in classrooms and hallways.
- **Player Avatar Locomotion Rigging**: Ayanokouji's 3D rig is fully visible in TPS mode with smooth directional turning, speed-scaled stride kinematics, pelvic bounce, and clean stationary idle poses.

### 🏛️ Interactive World Stations & Java Time Sync (Phase 3)
- **Seat 14 (Ayanokouji's Desk)**: Sit down during homeroom lectures and trigger note-taking animations.
- **Dormitory Bed (Room 401)**: Rest in bed with a 1.2s fade-to-black transition, waking up at $07:30\text{ AM}$ with morning chimes and synchronizing with the Java simulation server (`POST /api/time?hour=7.5`).
- **Memorial Library Study Carrels**: Sit and read academic literature with an open book prop, awarding $+3$ Wisdom stat.
- **Palette Café Patio**: Sit and enjoy refreshment with a coffee mug, awarding $+2$ Trust stat.
- **Cafeteria Vending Machine**: Purchase cold green tea, awarding $+2$ Courage stat.
- **Central Park Bench**: Sit and relax by the sakura fountain.

### 📦 Procedural 3D Activity Hand Props (Phase 3)
- 📖 **Hardcover Open Book**: Equipped during library study sessions.
- 🍱 **Bento Lunch Tray & Chopsticks**: Equipped during cafeteria dining.
- 🏀 **Basketball**: Equipped during athletic drills with real-time floor bounce oscillation ($y(t) = |\sin(8t)| \times 0.45\text{m}$).
- ☕ **Ceramic Coffee Mug**: Equipped at Palette Café and leisure spots.
- Props automatically detach when characters begin walking along navigation paths.

### 🎧 Procedural Web Audio Engine (`CampusAudioEngine`)
- **Zero-CORS Pure Audio Synthesis**: Generates all audio procedurally via Web Audio API without requiring external audio assets.
- **Physical Tubular Bell Westminster Chimes**: Synthesizes 4-note period bells ($E_4 \rightarrow G_4 \rightarrow F_4 \rightarrow B_3$) with high-frequency clapper strike transients and non-integer harmonic partial decays.
- **6-Material Stereo Footsteps**: Dynamic footsteps tailored for Wood (Classrooms/Gym), Tile (Main Hall/Cafeteria/Mall), Grass (Park), Gravel (Seaside), and Concrete (Gates), complete with alternating stereo panning ($\pm 0.22$) and dynamic pitch jitter.
- **Rain Puddle Splashes**: Dynamically mixes high-frequency droplet splashes when moving during rain.
- **Spatial Biomes**: Central Courtyard fountain, Seaside Boulevard ocean wave surf, and Japanese summer evening cicadas/crickets ($18:30 - 05:30$).

### 🌌 24-Hour Astronomical Skybox & Diurnal Lighting
- **1,000-Star Twinkling Procedural Starfield**: Custom vertex shader with continuous trigonometric scintillation and magnitude twinkle that fades at dawn and blazes at night.
- **3D Celestial Bodies (Sun & Moon)**: Accurate orbital trajectories with color-shifting solar coronas and silver-blue lunar glows.
- **Living Night Campus**: Automated streetlamp illumination, local PointLights, multi-room randomized warm window illumination in the residential dormitory, and pulsing neon signage (Keyaki Mall, SIV Camera, Palette Café).

### 🤖 Generative AI Conversations & Schedule AI
- **Gemini AI Character Dialogue**: Press `E` near any classmate (Horikita, Kushida, Sudō, Kōenji, Hirata, Karuizawa, Sakura, etc.) to converse with context-aware personality prompts.
- **Speech Synthesis (TTS)**: Character-specific vocal styles with voice synthesis.
- **Zero-Random-Wandering Timetable**: All NPCs follow purpose-driven daily routines from 07:30 arrival to evening leisure and night dorm rest.

---

## 🎮 Controls

| Key / Action | Description |
| :--- | :--- |
| **`W`, `A`, `S`, `D`** | Move character / Stand up from seated station |
| **`Shift`** | Sprint (faster movement & rapid footstep cadence) |
| **`Mouse`** | Look around (Click canvas to lock pointer) |
| **`Scroll Wheel`** | Smoothly zoom camera distance ($0.8\text{m} \leftrightarrow 5.5\text{m}$) |
| **`F5`** | Toggle Camera Perspective (First-Person `FPS` ↔ Third-Person `TPS`) |
| **`E` / Left Click** | Interact: Talk to NPC / Sit at Desk / Sleep in Bed / Study / Purchase Drink |
| **`Escape`** | Stand up from seated station / Close active dialogue |
| **`V`** | Cycle Weather Presets (☀️ Clear, ⛅ Cloudy, ☁️ Overcast, 🌧️ Rain, ⛈️ Storm, 🌇 Sunset) |
| **`P`** | Toggle Simulation Pause / Resume |
| **`F4` / Click `🎛️ Studio`** | Toggle Atmosphere & Audio Studio Drawer |
| **`F3`** | Toggle NPC Navigation & Schedule Debug Diagnostics HUD |
| **`K` / `N`** | Toggle Audio SFX / Mute |
| **`M`** | Toggle TTS Voice Narration |
| **`C`** | Toggle 3D Collision Bounds Visualizer |

---

## 🚀 How to Run

### Option 1: 3D Web Client (Instant Browser Run)
Open `index.html` or `game3d-campus.html` in any modern web browser:
```bash
# Using Node or Python static server
npx serve .
# or
python -m http.server 3000
# Navigate to http://localhost:3000
```

### Option 2: Java Simulation Backend Server
```bash
cd java-server
mvn clean package
mvn exec:java
# Running on http://localhost:8080 (serves REST API + static files)
```

### Option 3: Native Desktop Game Client (jMonkeyEngine 3)
```bash
# Set your Gemini API Key for desktop generative dialogues
export GEMINI_API_KEY="AIzaSy..."

# Run the native desktop game client
cd game-client
mvn clean compile exec:exec
```
