# Project Changes, File Breakdown & Architecture Evolution Log

This document provides a comprehensive, file-by-file analysis of the **Classroom of the Elite (COTE)** project reorganization, merge reconciliation, architectural upgrades, and feature implementations.

---

## 📑 Table of Contents

1. [Merge Reconciliation & Cleanup Summary](#1-merge-reconciliation--cleanup-summary)
2. [Master Project Structure (Current Clean State)](#2-master-project-structure-current-clean-state)
3. [Complete File-by-File Breakdown](#3-complete-file-by-file-breakdown)
   - [A. Root Files & Master Portal](#a-root-files--master-portal)
   - [B. 3D Game Domain (`3d-game/` & Root)](#b-3d-game-domain-3d-game--root)
   - [C. 2D Decision RPG Domain (`2d-rpg/`)](#c-2d-decision-rpg-domain-2d-rpg)
   - [D. Standalone 3D Blueprints Gallery (`blueprints/`)](#d-standalone-3d-blueprints-gallery-blueprints)
   - [E. Lore Data & Legacy Archives (`data/` & `legacy/`)](#e-lore-data--legacy-archives-data--legacy)
4. [What Was Built & Changed From Previous Versions](#4-what-was-built--changed-from-previous-versions)
   - [1. 15-Sector High-Fidelity Campus World](#1-15-sector-high-fidelity-campus-world)
   - [2. Purpose-Driven Daily Routine & Schedule AI](#2-purpose-driven-daily-routine--schedule-ai)
   - [3. Interactive Seating & Spot Reservation System](#3-interactive-seating--spot-reservation-system)
   - [4. Procedural Activity Joint Animations](#4-procedural-activity-joint-animations)
   - [5. Developer Diagnostics HUD (`F3`)](#5-developer-diagnostics-hud-f3)
   - [6. Zero-CORS Self-Contained WebGL Architecture](#6-zero-cors-self-contained-webgl-architecture)
   - [7. Master Launcher & Shared API Key Sync (`index.html`)](#7-master-launcher--shared-api-key-sync-indexhtml)
5. [How to Play & Test](#5-how-to-play--test)

---

## 1. Merge Reconciliation & Cleanup Summary

Following the git merge from remote, several older prototype files (`campus.html`, `engine.js`, `game.js`) reappeared in the root directory and caused confusion with `index.html` launcher links and the local web server.

### Actions Taken:
1. **Archived Merged Prototypes into `legacy/`**:
   - `campus.html` $\rightarrow$ moved to `legacy/campus.html`
   - `engine.js` $\rightarrow$ moved to `legacy/engine.js`
   - `game.js` $\rightarrow$ moved to `legacy/game.js`
2. **Restored `game.html`**: Root `game.html` has been updated with the full 1,361-line **3D Campus Architecture Explorer** with free 360° `OrbitControls`.
3. **Updated Portal Links (`index.html`)**:
   - **Play 3D Campus Game** button links directly to `game3d-campus.html` (the flagship living NPC game with purpose-driven routines, character voices, and F3 diagnostics).
   - **Open Campus Explorer** button links directly to `game.html` (the 3D architectural viewer).
   - **Play 2D Decision RPG** button links directly to `2d-rpg/index.html`.
4. **Reactivated Local HTTP Server**: Started the background Node server on `http://localhost:3000`.

---

## 2. Master Project Structure (Current Clean State)

```
cote/
├── 📄 index.html                # ANHS Master Portal & Unified Launcher
├── 📄 README.md                 # Master Documentation & Setup Guide
├── 📄 CHANGELOG.md              # Detailed File-by-File Technical Evolution Log (This File)
│
├── 📁 3d-game/                  # 3D Campus Experiences
│   ├── game3d-campus.html      # Flagship Playable 3D Campus Game (Self-contained)
│   ├── game3d-campus.js        # Standalone 3D Game Engine Module
│   └── game.html               # 3D Campus Architecture Explorer (OrbitControls)
│
├── 📁 2d-rpg/                   # 2D AI Decision RPG
│   ├── index.html              # 2D Story Game Interface
│   ├── app.js                  # 2D Game State & Checkpoint Time Travel
│   └── style.css               # 2D Glassmorphism UI Styles
│
├── 📁 blueprints/               # Standalone 3D Building & Room Dioramas (Formerly 'WEB GL')
│   ├── academic-building.html  # 4-Story Academic Center
│   ├── classroom.html          # Class 1-D Homeroom
│   ├── studio-401.html         # Ayanokouji's Dormitory Room
│   ├── memorial-library.html   # 28m Circular Glass Pavilion
│   ├── council-room.html       # Student Council Chamber
│   ├── school-cafeteria.html   # Cafeteria with serving counter & vending
│   ├── school-gymnasium.html   # Indoor Court & Grandstands
│   ├── aquatic-center.html     # 50m Pool, Diving Tower & Sports Field
│   ├── dormitory-tower.html    # 15-Story Residential Tower
│   ├── keyaki-mall.html        # 3-Tier Commercial Atrium & Glass Pyramid
│   ├── keyaki-karaoke.html     # Private Karaoke Lounge
│   ├── palette-cafe.html       # Palette Café & Outdoor Patio
│   ├── sivcamera-store.html    # SIV Store & CCTV Security Camera Wall
│   ├── central-park.html       # Multi-Tier Fountain & Sakura Trees
│   └── seaside-boulevard.html  # Coastal Boardwalk & Ocean Shader
│
├── 📁 data/                     # Source Lore & Reference Data
│   └── cote_1_extracted.txt    # Classroom of the Elite Vol. 1 source text
│
├── 📁 legacy/                   # Historical Prototypes (Preserved)
│   ├── campus.html             # Merged campus viewer prototype
│   ├── engine.js               # Merged engine script
│   ├── game.js                 # Merged game script
│   ├── game3d.html             # Initial 3D game prototype
│   └── game3d.js               # Initial 3D game script
│
└── 📁 config/ & settings
    ├── opencode.json           # NaraRouter Model Configuration
    ├── .gitignore              # Git Ignore Rules
    └── .claude/launch.json     # Local Dev Server Config
```

---

## 3. Complete File-by-File Breakdown

### A. Root Files & Master Portal

#### 1. `index.html` (ANHS Portal & Unified Launcher Hub)
* **What it does**: Central entrance for all users, linking to both 3D game modes, the 2D RPG, and the 15 building blueprints.
* **Key Features**:
  * **Global API Key Sync**: An input field storing `naraApiKey` in browser `localStorage`. Entering your key once configures all 2D and 3D AI dialogues.
  * **3 Primary Launch Cards**:
    1. 🎮 **3D Campus RPG** (`game3d-campus.html`): Full living school simulation with schedule AI and character voices.
    2. 🏛️ **Campus Architecture Explorer** (`game.html`): 360° orbital camera view of all 15 sectors.
    3. 📖 **2D AI Decision RPG** (`2d-rpg/index.html`): Narrative branching choice game.
  * **Blueprints Grid**: Direct buttons to all 15 standalone Three.js dioramas.

#### 2. `README.md` (Master Documentation)
* **What it does**: Master user and developer guide. Contains quick start guides for Node, Python, and direct file opening; controls cheat sheet; campus map coordinates; 24-hour daily timetable; and AI configuration.

#### 3. `CHANGELOG.md` (This File)
* **What it does**: In-depth record of all technical systems, file changes, and structural evolution.

---

### B. 3D Game Domain (`3d-game/` & Root)

#### 4. `game3d-campus.html` (Flagship 3D Simulation Game)
* **What it does**: The complete first-person 3D WebGL game where the player controls Ayanokouji Kiyotaka in ANHS.
* **Architecture**: **100% Self-Contained**. All shaders, 15 campus models, NPC rigs, timetable schedule, seating reservation system, and AI dialogue logic are inlined.
* **Key Features**:
  * First-person movement (`WASD`), sprint (`Shift`), mouse look.
  * Zero-random-wandering daily routine AI for all classmates.
  * Seating reservation manager ensuring individual student desk assignments and dining tables.
  * Procedural joint animations (classroom desk writing, teacher lecturing, cafeteria eating, library reading, sports drills).
  * Web Speech API character voice synthesis (toggle with `M`).
  * Dynamic 6-preset weather system (toggle with `V`).
  * Guided Chapter 1 story mode with 7 narrative objectives.
  * Developer diagnostics HUD (toggle with `F3`) with 8 instant time-skip buttons.

#### 5. `game3d-campus.js` (Standalone ES Module Engine)
* **What it does**: Standalone ES module version of the 3D campus game engine for modular imports and framework integration.

#### 6. `game.html` (3D Campus Architecture Explorer)
* **What it does**: 3D Campus Explorer using `OrbitControls` to inspect the entire campus from any angle, height, or distance.

---

### C. 2D Decision RPG Domain (`2d-rpg/`)

#### 7. `2d-rpg/index.html`
* **What it does**: Clean web interface for the narrative decision RPG, featuring live stat bars (Trust, Love, Respect, Wisdom, Courage), dialogue log, suggested AI action chips, and custom response input.

#### 8. `2d-rpg/app.js`
* **What it does**: State manager, prompt engine, and immutable checkpoint time-travel system allowing players to rewind turns and explore alternate choices.

#### 9. `2d-rpg/style.css`
* **What it does**: Dark glassmorphic styling, progress bars, responsive modal dialogs, and button hover animations.

---

### D. Standalone 3D Blueprints Gallery (`blueprints/`)
Formerly `WEB GL/`. Contains 15 standalone Three.js HTML files designed as interactive dioramas:

| File | Sector Modeled | Key Highlights |
|---|---|---|
| `academic-building.html` | Academic Center | 4 stories, curtain-wall glass, canopy, rooftop HVAC |
| `classroom.html` | Class 1-D Homeroom | Chalkboard, teacher podium, 25 student desks |
| `studio-401.html` | Room 401 | Tatami mat, bed, study desk, private balcony |
| `memorial-library.html` | Memorial Library | 28m circular reading pavilion, radial bookshelves, banker lamps |
| `council-room.html` | Student Council | Mahogany conference table, executive chairs, ANHS banner |
| `school-cafeteria.html` | School Cafeteria | Food counter, sneeze guard, dining tables, vending machines |
| `school-gymnasium.html` | Gymnasium | Hardwood court, steel roof trusses, basketball competition hoops |
| `aquatic-center.html` | Aquatic & Athletics | 50m pool with water shader, 10m diving platform, running track, pitch |
| `dormitory-tower.html` | Dormitory Tower | 15-story residential tower, balcony modules, glass railings |
| `keyaki-mall.html` | Keyaki Mall | 3-tier shopping atrium, glass pyramid skylight, chrome railings |
| `keyaki-karaoke.html` | Karaoke Lounge | Private karaoke booths, sofa seating, ambient lighting |
| `palette-cafe.html` | Palette Café | Café counter, espresso machine, dining tables, patio seating |
| `sivcamera-store.html` | SIV Store | Electronics displays, convenience goods, CCTV security wall |
| `central-park.html` | Central Courtyard | Multi-tier granite fountain, cherry blossom trees, lampposts |
| `seaside-boulevard.html` | Seaside Promenade | Red brick boardwalk, cliff sea wall, animated ocean shader |

---

### E. Lore Data & Legacy Archives (`data/` & `legacy/`)

#### 10. `data/cote_1_extracted.txt`
* **What it does**: Source text dump of *Classroom of the Elite* Volume 1, referenced for canon lore, character personalities, and dialogue prompts.

#### 11. `legacy/` (Archived Prototypes)
* `campus.html`, `engine.js`, `game.js`: Merged prototype scripts archived to keep root clean.
* `game3d.html`, `game3d.js`: Original prototype 3D game files preserved for historical reference.

---

## 4. What Was Built & Changed From Previous Versions

### 1. 15-Sector High-Fidelity Campus World
- **Previous**: Minimal placeholder blocks and generic flat ground.
- **Current**: Full procedural 3D campus combining all 15 sectors with procedural textures (grass, pavement tiles, parquet hardwood court, brick sea walls), custom GLSL shaders for swimming pool water and coastal ocean waves, and strict physical collision boxes.

### 2. Purpose-Driven Daily Routine & Schedule AI
- **Previous**: NPCs randomly walked around every few seconds without purpose.
- **Current**: **Zero random wandering rule**. All movement is governed by the central timetable (`SCHOOL_SCHEDULE`):
  - 07:30 Arrival at Front Gate $\rightarrow$ 08:15 Morning Class 1 $\rightarrow$ 10:00 Morning Break $\rightarrow$ 10:15 Morning Class 2 $\rightarrow$ 12:00 Cafeteria Lunch $\rightarrow$ 13:00 Afternoon Class $\rightarrow$ 15:00 After-School Personality Activities (Library, Gym, Café, Mall) $\rightarrow$ 17:30 Evening Leisure $\rightarrow$ 20:00 Dormitory Time $\rightarrow$ 22:30 Curfew.

### 3. Interactive Seating & Spot Reservation System (`ReservationManager`)
- **Previous**: NPCs clustered on top of each other at single room centers.
- **Current**:
  - **Class 1-D**: 25 unique desk coordinates (`CLASS_1D_SEAT_01`..`25`) + teacher podium (`CLASS_1D_TEACHER`). Each student is assigned their own seat.
  - **Cafeteria**: 24 dining seats across 6 tables (`CAFETERIA_T1_S1`..`CAFETERIA_T6_S4`).
  - **Library**: 12 reading desks with banker lamps (`LIBRARY_DESK_01`..`12`).
  - **Gymnasium & Athletic Zones**: Basketball hoops, center court drills, and track lanes.

### 4. Procedural Activity Joint Animations
- **Previous**: Only basic standing and walking animations.
- **Current**: Custom procedural joint poses:
  - `sit_desk`: Lowered hips, 90° bent knees, arms resting forward, right-hand pencil writing oscillation, head facing teacher.
  - `teach_lecture`: Authoritative teacher podium stance, expressive lecturing right arm swings, speaking mouth scaling.
  - `sit_eat`: Seated at dining table, food-lifting hand motion, cyclic chewing mouth scaling.
  - `sit_read`: Seated at library desk, head tilted down 20° towards book, hands holding pages on desk.
  - `sport_drill`: Athletic stance, basketball dribbling arm pump.

### 8. Traffic-Aware Multi-Route Selection (`RouteManager` & `TrafficManager`)
- **Previous**: All NPCs followed a single identical shortest line, leading to tightly packed queues in corridors.
- **Current**: **Dynamic multi-corridor route distribution**:
  - Expanded campus navigation graph to 42 nodes and 72 bidirectional edges with parallel alternative corridors (Central West Corridor, North Academic Promenade, South Academic Walkway, East Promenade, courtyard diagonals).
  - `findCandidateRoutes(from, to)` discovers up to 4 distinct valid path candidates using banned-edge BFS exploration.
  - `TrafficManager` dynamically tracks active student load on each edge and node.
  - Congestion-aware route scoring:
    $$\text{Score} = \text{Distance} + (7.5 \times \text{CorridorTraffic}) + \text{NPCSeedJitter}$$
  - Staggered departures (0.5s to 38.0s) and lateral pathway lane offsets ($\pm 0.6\text{m}$) disperse students across multiple pathways naturally.

### 10. Standalone Java Simulation Engine & Real-Time Connector (`java-server/`)
- Created full, pure **Java** OOP package (`com.cote.simulation`):
  - `PersonalityTraits.java`: 5-trait personality model and archetype derivation.
  - `SchoolSchedule.java`: 10-period daily schedule system.
  - `CampusGraph.java`: 42-node topological navigation network.
  - `TrafficManager.java`: Real-time edge load tracking and congestion costing.
  - `RouteManager.java`: Banned-edge BFS multi-route candidate solver.
  - `DoorwayQueueManager.java`: Doorway passage mutex arbitration.
  - `ReservationManager.java`: 25 classroom desks, 24 cafeteria dining spots, 12 library study desks.
  - `NPC.java` & `SimulationEngine.java`: Master clock and autonomous decision engine.
  - `SimulationServer.java`: Embedded JDK HTTP server on port `8080` with REST API and CORS support.
- `JavaSimulationBridge`: Integrated a live bridge in `game3d-campus.html` that automatically detects when `SimulationServer` is running on port 8080 and synchronizes simulation state seamlessly with fallback to in-browser JS.

### 11. Third-Person Spring-Arm Camera & Player Locomotion (Phase 3)
- **Dynamic Perspective Toggle (`F5`)**: Seamlessly switch between First-Person (`FPS`) and Third-Person Over-The-Shoulder (`TPS`). Mouse wheel dynamically zooms distance between $0.8\text{m}$ and $5.5\text{m}$.
- **Spring-Arm Raycast Wall Collision**: Raycasts from player head level $(p_x, 1.8\text{m}, p_z)$ against all building AABBs. If a wall or doorframe intersects closer than the target camera distance, distance clamps smoothly to eliminate wall-clipping.
- **Player Avatar Locomotion Rigging**: Ayanokouji's 3D rig is fully visible in TPS mode. Interpolates avatar yaw towards movement direction vector with natural stride, pelvic bounce, arm pendulum, and clean stationary idle poses.

### 12. Interactive World Stations & Java Time Synchronization (Phase 3)
- **`WORLD_STATIONS` Registry**: Implemented interactive furniture and facility stations across the campus:
  - **Seat 14 (Ayanokouji Desk)**: Sit down, lock camera to homeroom lecture view, and activate desk writing animation.
  - **Dormitory Bed (Room 401)**: Rest in bed with a 1.5s cinematic fade-to-black transition, invoking `GET/POST /api/time?hour=7.5` on the Java Simulation Server, advancing the day counter, and waking up at $07:30\text{ AM}$ with morning chime SFX.
  - **Memorial Library Study Carrel**: Study academic literature, awards $+3$ Wisdom stat.
  - **Palette Café Patio**: Sit and enjoy refreshment, awards $+2$ Trust stat.
  - **Cafeteria Vending Machine**: Purchase cold green tea, awards $+2$ Courage stat.
  - **Central Park Sakura Bench**: Relax by the multi-tier fountain.
- **Context-Sensitive HUD Prompts**: `updateProximity()` dynamically surfaces station prompts (`Press E to Sit at Seat 14`, `Press E to Rest in Bed`, etc.).

### 13. Procedural 3D Activity Hand Props (Phase 3)
- **Dynamic Prop Meshes**:
  - 📖 **Hardcover Book**: Dual angled covers with paper pages for library study.
  - 🍱 **Bento Lunch Tray**: Segmented dining tray with rice bowl, dish, and chopsticks for cafeteria dining.
  - 🏀 **Basketball**: Bouncing orange sphere with animated sine wave oscillation ($y(t) = |\sin(8t)| \times 0.45\text{m}$) for gymnasium drills.
  - ☕ **Ceramic Mug**: Low-poly coffee mug for Palette Café and lounge socializing.
- **Automatic Lifecycle Management**: Automatically equips matching props when NPCs and player enter station/activity states, and detaches props during navigation locomotion.

---

## 5. How to Play & Test

* **Local Web Server**: Open [http://localhost:3000/index.html](http://localhost:3000/index.html) (or [http://localhost:3000/game3d-campus.html](http://localhost:3000/game3d-campus.html)) in your browser.
* **Direct File**: Double-click `game3d-campus.html` or `index.html` in File Explorer.
* **Run Java Backend Server**: Inside `java-server/`, execute `compile_and_run.bat` (or `compile_and_run.sh`).
* **Camera Perspective**: Press **`F5`** (or scroll mouse wheel) to toggle between First-Person and Third-Person Over-The-Shoulder view.
* **World Stations**: Walk up to Seat 14 in Class 1-D, Dorm Bed in Room 401, or Library Carrels and press **`E`** to sit, rest, or study.
* **Schedule Diagnostics**: Press **`F3`** in the 3D game to view engine status (`🟢 Java Server` vs `⚪ Local JS Engine`), toggle 3D path lines, and use the 8 time-skip buttons to test routines.
