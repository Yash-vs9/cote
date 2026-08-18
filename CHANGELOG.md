# Project Changes & Architecture Evolution Log

This document provides a comprehensive, file-by-file analysis of the **Classroom of the Elite (COTE)** project reorganization, architectural upgrades, and feature implementations.

---

## 📑 Table of Contents

1. [Architectural Overview & Structural Evolution](#1-architectural-overview--structural-evolution)
2. [Comprehensive File-by-File Breakdown](#2-comprehensive-file-by-file-breakdown)
3. [Deep Dive: What Changed From Previous Versions](#3-deep-dive-what-changed-from-previous-versions)
   - [A. High-Fidelity 15-Sector Campus Architecture](#a-high-fidelity-15-sector-campus-architecture)
   - [B. Purpose-Driven NPC Routine & Behavior System](#b-purpose-driven-npc-routine--behavior-system)
   - [C. Seating & Destination Reservation Engine](#c-seating--destination-reservation-engine)
   - [D. Procedural Activity Animations](#d-procedural-activity-animations)
   - [E. Developer Diagnostics HUD (F3)](#e-developer-diagnostics-hud-f3)
   - [F. CORS & Self-Contained WebGL Fix](#f-cors--self-contained-webgl-fix)
   - [G. Unified Portal & Launcher (`index.html`)](#g-unified-portal--launcher-indexhtml)
4. [Verification & Playability Summary](#4-verification--playability-summary)

---

## 1. Architectural Overview & Structural Evolution

### Before Reorganization (Flat Root)
Originally, the project files were scattered across the root directory with prototype files, asset viewers, and conflicting game files mixed together:
- `game3d.html` & `game3d.js` (Prototype 3D game)
- `game.html` (Campus viewer)
- `game3d-campus.html` & `game3d-campus.js` (Evolving 3D campus game)
- `index.html`, `app.js`, `style.css` (2D RPG game)
- `WEB GL/` (15 standalone Three.js HTML files)
- `cote_1_extracted.txt` (Novel text data in root)

### After Reorganization (Modular Domain Structure)
The repository is now strictly categorized into dedicated subdirectories while maintaining root launch points for convenience:

```
cote/
├── 📄 index.html                # ANHS Master Portal & Game Launcher
├── 📄 README.md                 # Master Documentation, Setup, Controls & Lore
├── 📄 CHANGELOG.md              # Detailed File-by-File Change Log (This File)
│
├── 📁 3d-game/                  # 3D Campus Experiences
│   ├── game3d-campus.html      # Flagship Playable 3D Campus Game (Self-contained)
│   ├── game3d-campus.js        # 3D Campus Game Engine Module
│   └── game.html               # 3D Campus Architecture Explorer (OrbitControls)
│
├── 📁 2d-rpg/                   # 2D AI Decision RPG
│   ├── index.html              # 2D Story Game Interface
│   ├── app.js                  # 2D Decision Game Engine & Checkpoints
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
├── 📁 data/                     # Source Data & Lore References
│   └── cote_1_extracted.txt    # Classroom of the Elite Vol. 1 source text
│
├── 📁 legacy/                   # Historical Prototypes (Preserved)
│   ├── game3d.html             # Initial 3D game prototype
│   └── game3d.js               # Initial 3D game script
│
└── 📁 config/ & settings
    ├── opencode.json           # NaraRouter Model Configuration
    ├── .gitignore              # Git Ignore Rules
    └── .claude/launch.json     # Local Dev Server Configuration
```

---

## 2. Comprehensive File-by-File Breakdown

### Root Files

#### 1. `index.html` (ANHS Portal & Unified Launcher)
* **Purpose**: Serves as the central landing page and unified launcher for the entire project.
* **New Features**:
  * **Global API Key Manager**: Allows users to enter their `router.bynara.id` key once, storing it in browser `localStorage` (`naraApiKey`) so both the 3D Campus Game and 2D RPG can use it automatically.
  * **Experience Cards**:
    1. 🎮 **3D Campus RPG**: Quick launch to `game3d-campus.html`.
    2. 🏛️ **Campus Architecture Explorer**: Quick launch to `3d-game/game.html`.
    3. 📖 **2D AI Decision RPG**: Quick launch to `2d-rpg/index.html`.
  * **Blueprints Gallery**: An interactive grid linking directly to all 15 standalone WebGL Three.js sector models in `blueprints/`.
  * **Aesthetic**: Dark glassmorphic anime styling with cyan/gold accents, subtle animated background grid, and responsive layout.

#### 2. `README.md` (Master Documentation)
* **Purpose**: Primary documentation for developers, players, and reviewers.
* **Contents**:
  * Complete overview of game systems and features.
  * Quick-start server instructions (Python, Node, Direct file execution).
  * Game controls cheat sheet (`WASD`, `Shift`, `E`, `V`, `M`, `F3`, `Esc`).
  * 24-hour daily school timetable breakdown.
  * Campus sector coordinate reference table.
  * AI model configuration for `router.bynara.id`.

#### 3. `CHANGELOG.md` (This File)
* **Purpose**: Deep technical record of all architectural updates, file changes, and feature enhancements.

---

### `3d-game/` & Root 3D Files

#### 4. `game3d-campus.html` (Flagship 3D Campus Simulation Game)
* **Purpose**: The primary playable first-person 3D WebGL game.
* **Architecture**: **100% Self-Contained HTML**. Contains the full Three.js engine, procedural texture generators, 15 campus architectural models, NPC rigs, state machine, schedule manager, and AI dialogue engine inlined.
* **Why Inlined?**: Eliminates browser CORS security blocking when opening files directly via the `file:///` protocol in Windows Explorer.
* **Key Features**:
  * First-person locomotion + sprint + mouse look.
  * 15 high-fidelity campus sectors with animated pool water & ocean waves shaders.
  * Articulated 3D characters for Horikita, Kushida, Sudou, Kouenji, Chabashira, Hirata, Karuizawa, Yukimura, Sakura, Ike, Yamauchi.
  * Zero-random-wandering purpose-driven routine system.
  * Seating reservation manager (25 classroom desks, 24 dining seats, 12 library desks, athletic stations).
  * Procedural activity animations (sitting/writing at desk, teacher lecturing, cafeteria eating, library book reading, basketball drills).
  * Web Speech API character voice synthesis (TTS) with distinct pitch/speed per character (toggle with `M`).
  * Dynamic 6-preset weather engine (toggle with `V`).
  * Guided Chapter 1 story mode with 7 narrative objectives.
  * Developer diagnostics HUD (toggle with `F3`) with 8 instant time-skip buttons.

#### 5. `game3d-campus.js` (Standalone ES Module Engine)
* **Purpose**: Standalone ES module version of the 3D campus game engine for modular import and future framework integration.

#### 6. `game.html` (3D Campus Architecture Explorer)
* **Purpose**: Interactive 3D campus overview using `OrbitControls`.
* **Features**: Allows free 360° orbital rotation, panning, and zooming to inspect all 15 sectors simultaneously from overhead or street level.

---

### `2d-rpg/` (2D AI Decision RPG)

#### 7. `2d-rpg/index.html`
* **Purpose**: Clean web interface for the narrative decision RPG.
* **Features**: Displays Trust, Love, Respect, Wisdom, and Courage stat bars, scrolling narrative message log, suggested AI action buttons, and custom text input.

#### 8. `2d-rpg/app.js`
* **Purpose**: 2D RPG game state manager, NaraRouter prompt engine, and checkpoint time-travel system.
* **Features**: Records every dialogue turn as an immutable checkpoint, allowing players to rewind time to any previous turn and explore alternate choices.

#### 9. `2d-rpg/style.css`
* **Purpose**: Modern dark glassmorphic styling, progress bars, responsive modal dialogs, and button animations for the 2D RPG.

---

### `blueprints/` (Standalone 3D Sector Models)
Formerly the `WEB GL/` folder. Contains 15 standalone Three.js HTML files designed as interactive dioramas:

| File | Sector Modeled | Key Highlights |
|---|---|---|
| `academic-building.html` | Academic Center | 4 stories, curtain-wall glass, canopy, rooftop HVAC |
| `classroom.html` | Class 1-D Homeroom | Chalkboard, teacher podium, 25 student desks with steel frames |
| `studio-401.html` | Room 401 | Ayanokouji's tatami mat, bed, study desk, private balcony |
| `memorial-library.html` | Memorial Library | 28m circular reading pavilion, curved glass, radial bookshelves, banker lamps |
| `council-room.html` | Student Council | Mahogany executive table, leather chairs, ANHS banner, trophy cases |
| `school-cafeteria.html` | School Cafeteria | Food counter, sneeze guard, dining tables, vending machines |
| `school-gymnasium.html` | Gymnasium | Hardwood court, steel roof trusses, basketball competition hoops, grandstands |
| `aquatic-center.html` | Aquatic & Athletics | 50m pool with water shader, 10m diving platform, running track, soccer pitch |
| `dormitory-tower.html` | Dormitory Tower | 15-story residential tower, balcony modules, glass railings, lobby entrance |
| `keyaki-mall.html` | Keyaki Mall | 3-tier shopping atrium, glass pyramid skylight, chrome railings |
| `keyaki-karaoke.html` | Karaoke Lounge | Private karaoke booths, sofa seating, ambient lighting |
| `palette-cafe.html` | Palette Café | Café counter, espresso machine, dining tables, outdoor patio seating |
| `sivcamera-store.html` | SIV Store | Electronics displays, convenience racks, CCTV security camera wall |
| `central-park.html` | Central Courtyard | Multi-tier granite fountain, cherry blossom trees, Victorian lampposts |
| `seaside-boulevard.html` | Seaside Promenade | Red brick boardwalk, cliff sea wall, iron railings, animated ocean shader |

---

### `data/` & `legacy/`

#### 10. `data/cote_1_extracted.txt`
* **Purpose**: Extracted source text of *Classroom of the Elite* Volume 1. Used as reference for lore, character voice prompts, scene descriptions, and dialogue generation.

#### 11. `legacy/game3d.html` & `legacy/game3d.js`
* **Purpose**: Preserved original prototype 3D game files for historical reference.

---

## 3. Deep Dive: What Changed From Previous Versions

### A. High-Fidelity 15-Sector Campus Architecture
* **Previous**: Simplified placeholder boxes and generic flat ground.
* **Current**: All 15 detailed procedural models from `game.html` and `blueprints/` were directly integrated into the playable 3D game:
  * Procedural textures for grass, paving tiles, parquet hardwood court, brick sea walls, and neon signs.
  * Custom GLSL vertex and fragment shaders for the **animated swimming pool water** and **ocean coastal waves**.
  * Precise physical bounding box colliders preventing players and NPCs from clipping through walls.

---

### B. Purpose-Driven NPC Routine & Behavior System
* **Previous**: NPCs randomly chose locations every few seconds and walked aimlessly.
* **Current**: **Zero random wandering rule**. NPCs only move when an event in their schedule or life state demands it:
  * Central configurable `SCHOOL_SCHEDULE` timetable.
  * Classmates arrive at school at 07:30 $\rightarrow$ enter Class 1-D $\rightarrow$ attend morning lectures $\rightarrow$ take a 15-minute break $\rightarrow$ go to lunch in the cafeteria at 12:00 $\rightarrow$ return for afternoon class $\rightarrow$ branch into after-school activities at 15:00 based on their personality traits $\rightarrow$ return to dorms in the evening.

---

### C. Seating & Destination Reservation Engine (`ReservationManager`)
* **Previous**: NPCs clustered on top of each other in the center of rooms.
* **Current**: Spatial reservation system with unique IDs:
  * **Class 1-D**: 25 unique student desk coordinates (`CLASS_1D_SEAT_01`..`25`) + teacher podium (`CLASS_1D_TEACHER`). Each student reserves their own seat (Horikita at Seat 13, Ayanokouji at Seat 14, Kouenji at Seat 25).
  * **Cafeteria**: 24 seated dining chairs across 6 tables (`CAFETERIA_T1_S1`..`CAFETERIA_T6_S4`).
  * **Library**: 12 study desks with banker lamps (`LIBRARY_DESK_01`..`12`).
  * **Gymnasium & Athletic Zones**: North/South basketball hoops, court mid, grandstands, running lanes, pool deck.

---

### D. Procedural Activity Animations (`NPCAnimationController`)
* **Previous**: Only basic standing and walking animations.
* **Current**: Dedicated procedural joint poses:
  * `sit_desk`: Lowered hips, 90° bent knees, arms resting forward on desk, right-hand pencil writing oscillation, head facing teacher.
  * `teach_lecture`: Authoritative standing posture, left hand resting on podium, expressive lecturing right arm swings, speaking mouth scaling.
  * `sit_eat`: Seated at dining table, food-lifting hand motion, chewing mouth animation, head turning to table companions.
  * `sit_read`: Seated at library desk, head tilted downward 20° towards book, hands holding pages on desk.
  * `sport_drill`: Athletic stance, basketball dribbling arm pump.

---

### E. Developer Diagnostics HUD (`F3`)
* Press **`F3`** (or click F3 Schedule in the UI) to open an on-screen real-time diagnostic panel:
  * Live roster showing each NPC's state, current activity reason, and reserved destination ID.
  * 8 instant time-skip buttons (`07:45 Arrival`, `08:30 Class 1`, `10:05 Break`, `12:15 Lunch`, `13:30 Class 2`, `15:30 Activities`, `18:30 Evening`, `21:00 Dorms`) allowing instant testing of all routine transitions.

---

### F. CORS & Self-Contained WebGL Fix
* **Problem**: In modern browsers, opening local HTML files via `file:///` blocks external `<script type="module" src="...">` tags due to CORS security restrictions, preventing start buttons from working.
* **Solution**: Fully inlined all JavaScript code into `game3d-campus.html` and exposed start handlers globally (`window.beginGame('free')`, `window.beginGame('story')`, `window.beginGame('explore')`). The game now runs immediately whether double-clicked locally or served via HTTP.

---

### G. Unified Portal & Launcher (`index.html`)
* Replaced the old 2D-only root `index.html` with a comprehensive **ANHS Master Launcher & Portal**.
* Automatically shares the entered API key across all game modes via browser `localStorage`.
* Provides direct one-click access to the 3D Campus Game, 3D Architecture Explorer, 2D RPG, and all 15 building blueprints.

---

## 4. Verification & Playability Summary

All URLs, assets, and routes have been verified and return HTTP 200 OK:

| Route / File | Type | Verification Status |
|---|---|---|
| `/index.html` | Master Portal & Launcher | **200 OK** |
| `/game3d-campus.html` | Flagship 3D Campus Game | **200 OK** (Also verified on `file:///`) |
| `/3d-game/game3d-campus.html` | 3D Game Mirror | **200 OK** |
| `/3d-game/game.html` | 3D Campus Architecture Explorer | **200 OK** |
| `/2d-rpg/index.html` | 2D AI Decision RPG | **200 OK** |
| `/blueprints/*.html` (15 files) | Standalone 3D Building Dioramas | **200 OK** |

---
*Classroom of the Elite 3D Campus World & AI Decision RPG Engine*
