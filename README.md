# Classroom of the Elite — 3D Campus Simulation & AI Decision RPG

An interactive 3D WebGL simulation and AI-powered role-playing experience set in **Tokyo Metropolitan Advanced Nurturing High School (ANHS)** from the light novel and anime series *Classroom of the Elite* (*Youkoso Jitsuryoku Shijou Shugi no Kyoushitsu e*).

---

## 🌟 Highlights

- **Purpose-Driven NPC Daily Routine System**: Complete zero-random-wandering architecture. All students move and act based on their central schedule, classroom seat assignments, dining tables, library desks, and individual personality traits.
- **Interactive Seating & Reservation Manager**: 25 unique desks in Class 1-D, 24 dining seats across 6 cafeteria tables, 12 library study desks, and athletic practice stations. No two NPCs ever overlap or fight over seats.
- **Procedural Activity Animations**: Custom keyframed poses for sitting at desks, writing notes, teacher lecturing, cafeteria eating, library book reading, and athletic sports drills.
- **Full 15-Sector 3D Campus**: High-fidelity Three.js models for all key locations (Class 1-D, Academic Building, Library, Student Council Room, Cafeteria, Gymnasium, Olympic Pool & Track, Dormitory Tower, Room 401, SIV Camera Store, Palette Café, Keyaki Mall & Karaoke, Front Gate, and Seaside Promenade).
- **Articulated 3D Characters**: Custom procedural rigs for Horikita Suzune, Kushida Kikyou, Sudou Ken, Kouenji Rokusuke, Chabashira Sae, Hirata Yousuke, Karuizawa Kei, Yukimura Teruhiko, Sakura Airi, Ike Kanji, and Yamauchi Haruki.
- **Dynamic AI Dialogue & Social Memory**: Real-time roleplay powered by LLM (`router.bynara.id`) with affinity tracking, dynamic moods, persistent memory, and escort AI.
- **Character Voice Engine (TTS)**: Web Speech Synthesis neural voice system with unique voice pitch and rates per character.
- **Dynamic 6-Preset Weather System**: Seamless transitions between Clear, Cloudy, Overcast, Rain, Thunderstorm (with lightning flashes), and Sunset.
- **Developer Debug HUD (`F3`)**: Real-time diagnostic roster displaying NPC states, current activities, reserved spot IDs, and quick time-skip buttons.

---

## 📂 Project Structure

```
cote/
├── 📄 index.html                # ANHS Master Portal & Unified Launcher
├── 📄 README.md                 # Master Documentation (This File)
├── 📄 CHANGELOG.md              # Detailed File-by-File Technical Evolution Log
│
├── 📁 3d-game/                  # 3D Campus Experiences
│   ├── game3d-campus.html      # Flagship Playable 3D Campus Game (Self-contained)
│   └── game3d-campus.js        # Standalone 3D Game Engine Module
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
├── 📁 legacy/                   # Historical Prototypes & Supporting Scripts (Archived)
│   ├── campus.html             # Merged campus viewer prototype
│   ├── engine.js               # Merged engine script
│   ├── game.html               # 3D Campus Orbit Explorer
│   ├── game.js                 # Merged game script
│   ├── game3d.html             # Initial 3D game prototype
│   └── game3d.js               # Initial 3D game script
│
└── 📁 config/ & settings
    ├── opencode.json           # NaraRouter Model Configuration
    ├── .gitignore              # Git Ignore Rules
    └── .claude/launch.json     # Local Dev Server Configuration
```

---

## 🚀 Quick Start

### 1. Launching Locally

#### Option A: Node.js / Built-in Server
```bash
# In the project root
node -e "const http=require('http'),fs=require('fs'),path=require('path');http.createServer((q,r)=>{let f=q.url==='/'?'/index.html':q.url.split('?')[0],p=path.join(process.cwd(),decodeURIComponent(f));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);r.end('Not found');return;}let x=path.extname(p).toLowerCase(),t={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'}[x]||'text/plain';r.writeHead(200,{'Content-Type':t});r.end(d);});}).listen(3000,()=>console.log('http://localhost:3000'));"
```
Open **[http://localhost:3000/index.html](http://localhost:3000/index.html)** in your browser.

#### Option B: Python
```bash
python -m http.server 3000
```

#### Option C: Direct File Opening
Double-click `index.html` or `game3d-campus.html` directly in Windows Explorer. `game3d-campus.html` is 100% self-contained and runs immediately without external module CORS restrictions.

---

## 🎮 Game Controls (3D Campus)

| Action | Control |
|---|---|
| **Move** | `W`, `A`, `S`, `D` or Arrow Keys |
| **Sprint** | `Shift` (Hold while moving) |
| **Look Around** | Click and Drag Mouse / Pointer Lock |
| **Interact / Talk** | `E` (When near a classmate or teacher) |
| **Toggle Schedule Debug HUD** | `F3` (View NPC states & quick time-skip) |
| **Cycle Weather** | `V` (Clear → Cloudy → Overcast → Rain → Storm → Sunset) |
| **Toggle Voice (TTS)** | `M` (Enable / Disable Speech Synthesis) |
| **Exit Dialogue / Menu** | `Escape` |

---

## ⏰ Daily School Schedule

| Time | Period | NPC Behaviors |
|---|---|---|
| **07:30 – 08:15** | `ARRIVING_AT_SCHOOL` | Students arrive at Front Gate and walk intentionally to Class 1-D |
| **08:15 – 10:00** | `CLASS` (Morning 1) | Students sit at assigned desks writing notes; Chabashira lectures at podium |
| **10:00 – 10:15** | `BREAK` | 15-minute break; stretching and talking near desks |
| **10:15 – 12:00** | `CLASS` (Morning 2) | Second academic lecture and classroom exercises |
| **12:00 – 13:00** | `LUNCH` | Class leaves room → walks to Cafeteria → sits at 6 tables → eats & chats |
| **13:00 – 15:00** | `AFTERNOON_CLASS` | Students return to Class 1-D for afternoon studies |
| **15:00 – 17:30** | `PERSONAL_ACTIVITY` | **Academics** → Library; **Athletes** → Gym/Field; **Socialites** → Café/Mall; **Leisure** → Courtyard/Dorm |
| **17:30 – 20:00** | `EVENING_LEISURE` | Free time across Keyaki Mall, convenience store, promenade |
| **20:00 – 22:30** | `DORM_TIME` | Dormitory tower & Room 401 study and relaxation |
| **22:30 – 07:30** | `NIGHT_REST` | Night curfew in dormitory rooms |

---

## 🏛️ Campus Sectors (Spatial Map)

| Coordinates (X, Z) | Location | Description |
|---|---|---|
| `(0, 8)` | **Central Courtyard** | Multi-tier fountain, cherry blossom trees, Victorian lampposts |
| `(0, -56)` | **Academic Building** | 4-story glass curtain-wall structure with grand canopy |
| `(-62, -20)` | **Class 1-D** | Homeroom classroom with chalkboard, podium, and 25 student desks |
| `(-62, 22)` | **Memorial Library** | 28m circular reading pavilion with curved glass and radial bookshelves |
| `(26, -56)` | **Student Council Room** | Mahogany conference table, executive seating, ANHS crest banner |
| `(62, -20)` | **School Cafeteria** | Serving line, dining tables, beverage dispensers, vending machines |
| `(62, 22)` | **Gymnasium** | Hardwood basketball court, grandstands, and steel roof trusses |
| `(-62, 60)` & `(-62, 92)` | **Athletics & Aquatic** | Soccer pitch, running track, 50m pool with animated water shader, 10m diving tower |
| `(-34, 58)` | **Dormitory Tower** | 15-story residential tower with glass balconies and lobby |
| `(-50, 58)` | **Room 401** | Ayanokouji's studio bedroom with tatami and balcony |
| `(34, 54)` | **SIV Convenience Store** | Electronics, convenience goods, CCTV security camera wall |
| `(54, 54)` | **Palette Café** | Café counter, espresso machine, indoor and outdoor patio seating |
| `(44, 78)` | **Keyaki Mall & Karaoke**| 3-tier shopping mall with glass pyramid skylight & karaoke lounge |
| `(0, 95)` | **Front Gate** | ANHS stone totem, school entrance pillars, school bus stop |
| `(0, -145)` | **Seaside Promenade** | Red brick coastal boardwalk, cliff sea wall, and animated ocean waves |

---

## 📖 Detailed Change Log

For a comprehensive file-by-file breakdown of all technical changes, architecture diagrams, and system comparisons, refer to **[CHANGELOG.md](file:///h:/HARSH_PROJECTS/PERSONAL%20PROJECT/cote/CHANGELOG.md)**.
