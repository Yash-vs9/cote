# Classroom of the Elite — 3D Campus Simulation & AI Decision RPG

An interactive 3D WebGL simulation, intelligent NPC multi-agent system, and AI-powered role-playing experience set in **Tokyo Metropolitan Advanced Nurturing High School (ANHS)** from the light novel and anime series *Classroom of the Elite* (*Youkoso Jitsuryoku Shijou Shugi no Kyoushitsu e*).

---

## 🌟 Core Highlights & Systems

### 1. Purpose-Driven NPC Schedule & Daily Routine System
- **Zero-Random-Wandering Architecture**: NPCs move and act strictly based on the school timetable (`SCHOOL_SCHEDULE`), facility capacities, and their 5 personality traits (`intelligence`, `discipline`, `athleticism`, `social`, `curiosity`).
- **Complete 24-Hour Timetable**:
  - `07:30 - 08:15`: Morning Arrival & Campus Leisure.
  - `08:15 - 10:00`: Class 1-D Homeroom & Academic Lecture 1.
  - `10:00 - 10:15`: 15-Minute Recess & Social Chat.
  - `10:15 - 12:00`: Academic Lecture 2.
  - `12:00 - 13:00`: Cafeteria Lunch & Dining.
  - `13:00 - 15:00`: Afternoon S-System Seminar.
  - `15:00 - 17:30`: Personality-Driven After-School Activities (Library Study, Gym & Field Drills, Palette Café, Keyaki Mall).
  - `17:30 - 20:00`: Evening Free Leisure.
  - `20:00 - 22:30`: Dormitory Private Study.
  - `22:30 - 07:30`: Campus Curfew & Night Rest.

### 2. Traffic-Aware Multi-Route Selection Engine (`RouteManager` & `TrafficManager`)
- **Parallel Corridor Navigation Network**: 42 waypoints and 72 bidirectional edges with alternative hallways (Central West Corridor, North Academic Promenade, South Academic Walkway, East Promenade, and Courtyard diagonals).
- **Candidate Route Discovery**: `findCandidateRoutes(from, to)` uses banned-edge BFS exploration to discover up to 4 distinct valid path candidates.
- **Congestion Cost Scoring**:
  $$\text{Score} = \text{Distance} + (7.5 \times \text{CorridorTraffic}) + \text{NPCSeedJitter}$$
  Students automatically disperse onto parallel paths instead of forming one single packed line.
- **Staggered Departures**: Departures are staggered ($0.5\text{s}$ to $38.0\text{s}$) based on student discipline and role (e.g. Chabashira $0.5\text{s}$, Horikita $1.8\text{s}$, Yukimura $3.2\text{s}$ ... Sudou $24\text{s}$, Kouenji $38\text{s}$).
- **Seamless Corner Turning & Wall Sliding**: Intermediate waypoints advance immediately upon reaching corner radius without deceleration halting; speed modulates by $\cos(\theta)$ around sharp turns; multi-vector sliding resolves wall corners cleanly.
- **Stationary Idle Safeguard**: Limb animation is strictly locked when stationary to prevent any "walking in place".

### 3. Interactive Seating & Spot Reservation (`ReservationManager` & `DoorwayQueueManager`)
- **Class 1-D**: 25 unique desk coordinates (`CLASS_1D_SEAT_01`..`25`) + teacher podium (`CLASS_1D_TEACHER`).
- **Cafeteria**: 24 dining seats across 6 tables (`CAFETERIA_T1_S1`..`CAFETERIA_T6_S4`).
- **Memorial Library**: 12 reading desks with banker lamps (`LIBRARY_DESK_01`..`12`).
- **Doorway Flow Arbitration**: Mutex arbitration guarantees smooth single-file passage through classroom and facility doors without clumping.

### 4. Standalone Java Simulation Engine (`java-server/`) & Live Hybrid Bridge
- **Pure Java Engine**: Standard JDK-compliant OOP package (`com.cote.simulation`) implementing all schedule, route selection, and behavior logic with zero external dependencies.
- **Embedded Java REST API**: `SimulationServer.java` serves `/api/health`, `/api/simulation`, `/api/route`, and `/api/time` with CORS support on port `8080`.
- **`JavaSimulationBridge`**: The 3D frontend automatically detects and syncs with the Java server when active, with instant fallback to local JavaScript when offline.

### 5. High-Fidelity 15-Sector 3D Campus World
- High-fidelity Three.js models for all 15 sectors (Class 1-D, Academic Building, Library, Student Council Room, Cafeteria, Gymnasium, Olympic Pool & Track, Dormitory Tower, Room 401, SIV Camera Store, Palette Café, Keyaki Mall & Karaoke, Front Gate, and Seaside Promenade).
- Custom GLSL shaders for swimming pool surface caustic reflections and coastal ocean wave physics.

### 6. Dynamic AI Dialogue & Real-Time Character Voice (TTS)
- Roleplay conversation powered by LLM (`router.bynara.id`) with affinity tracking, dynamic moods, persistent memory, and companion escort AI.
- Web Speech Synthesis neural voice system with customized pitch and rate per character.

### 7. Developer Diagnostics HUD (`F3`) & Test Suite
- Press **`F3`** in-game to view live NPC states, archetypes, active multi-route IDs, corridor traffic costs, toggle 3D path lines, and skip to any schedule period.
- Automated Test Suite: Run `testCampusNavigation()` in DevTools (`F12`) to validate 100% path reachability and multi-route candidate diversity across all 6 core campus journeys.

---

## 📁 Project Directory Structure

```
cote/
├── 📄 index.html                # ANHS Master Portal & Unified Launcher
├── 📄 README.md                 # Master Documentation (This File)
├── 📄 CHANGELOG.md              # Detailed File-by-File Technical Evolution Log
├── 📄 server.js                 # Dual-Port Node Server (Web: 3000, API: 8080)
│
├── 📁 3d-game/                  # 3D Campus Domain
│   ├── game3d-campus.html      # Flagship Playable 3D Campus Game (Self-contained)
│   └── game3d-campus.js        # Standalone 3D Game Engine Module
│
├── 📁 java-server/              # Standalone Java Simulation Engine (Pure Java)
│   ├── compile_and_run.bat     # Windows 1-Click Build & Run Script
│   ├── compile_and_run.sh      # Linux / Mac Build & Run Script
│   ├── README.md               # Java Engine & API Documentation
│   └── src/com/cote/simulation/
│       ├── PersonalityTraits.java
│       ├── ScheduleEvent.java
│       ├── SchoolSchedule.java
│       ├── CampusGraph.java
│       ├── TrafficManager.java
│       ├── RouteManager.java
│       ├── DoorwayQueueManager.java
│       ├── ReservationManager.java
│       ├── NPC.java
│       ├── SimulationEngine.java
│       └── SimulationServer.java
│
├── 📁 2d-rpg/                   # 2D AI Decision RPG
│   ├── index.html              # 2D Story Game Interface
│   ├── app.js                  # 2D Decision Game Engine & Checkpoints
│   └── style.css               # 2D Glassmorphism UI Styles
│
├── 📁 blueprints/               # Standalone 3D Building & Room Dioramas
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
└── 📁 legacy/                   # Historical Prototypes & Supporting Scripts (Archived)
    ├── campus.html             # Merged campus viewer prototype
    ├── engine.js               # Merged engine script
    ├── game.html               # 3D Campus Orbit Explorer
    ├── game.js                 # Merged game script
    ├── game3d.html             # Initial 3D game prototype
    └── game3d.js               # Initial 3D game script
```

---

## 🚀 How to Run

### 1. Unified Web & Simulation Server (Recommended)
Run with Node.js in the project root:
```bash
node server.js
```
* **Master Portal**: [http://localhost:3000/index.html](http://localhost:3000/index.html)
* **3D Campus Game**: [http://localhost:3000/game3d-campus.html](http://localhost:3000/game3d-campus.html)
* **2D Decision RPG**: [http://localhost:3000/2d-rpg/index.html](http://localhost:3000/2d-rpg/index.html)
* **Simulation REST API**: [http://localhost:8080/api/simulation](http://localhost:8080/api/simulation)

### 2. Standalone Java Simulation Server (Optional)
Inside `java-server/`:
* **Windows**: Run `compile_and_run.bat`
* **Linux/Mac**: Run `./compile_and_run.sh`
* The 3D game will automatically connect to `http://localhost:8080` via `JavaSimulationBridge`.

### 3. Direct File Opening (Offline)
Double-click `game3d-campus.html` or `index.html` in File Explorer. The 3D game is 100% self-contained and runs with zero CORS restrictions.

---

## 🎮 Game Controls (3D Campus)

| Action | Control |
|---|---|
| **Move** | `W`, `A`, `S`, `D` or Arrow Keys |
| **Sprint** | `Shift` (Hold while moving) |
| **Look Around** | Mouse (click to lock cursor) |
| **Interact / Talk** | `E` (when near an NPC or interactive spot) |
| **Cycle Weather** | `V` (or click top-right weather badge) |
| **Diagnostics HUD** | `F3` (Schedule timetable, NPC roster, route tracker, time skips) |
| **Toggle 3D Path Lines** | Button in `F3` HUD (`window.toggleDebugPaths()`) |
| **Exit Pointer Lock / Menu** | `Escape` |
| **Release Escort Follower** | `X` (when an NPC is escorting you) |
