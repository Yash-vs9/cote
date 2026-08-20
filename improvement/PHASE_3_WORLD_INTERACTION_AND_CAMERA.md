# Phase 3: World Interactivity, 3rd-Person Camera & Character Rigging

This document outlines the complete technical specification, architectural design, and step-by-step task breakdown for **Phase 3: World Interactivity, 3rd-Person Camera & Character Rigging**.

---

## 1. Subsystem 1: Third-Person Over-The-Shoulder Camera & Avatar Animation

### A. What Should Be Changed
- Implement a dynamic **Camera Perspective System** with hotkey toggle (`V` or `F5` / `T`).
- Support two seamless camera modes:
  1. **First-Person View (`FPS`)**: Camera positioned at eye level (`EYE = 1.7m`).
  2. **Third-Person View (`TPS`)**: Over-the-shoulder orbital camera ($3.2\text{m}$ distance, $+0.55\text{m}$ lateral offset, $+1.8\text{m}$ height).
- Make `playerAvatar` fully visible during exploration in Third-Person mode with live procedural animations (locomotion cycle, idle breathing, head look-at).
- Implement a **Spring-Arm Camera Collision Solver** to prevent the camera from clipping through interior classroom or hallway walls.

### B. Why It Is Changing
- Currently, the game is strictly first-person. The detailed procedural anime player avatar is hidden during movement and only shown statically when dialogue opens.
- Players cannot see their own character walking through the ANHS campus, reducing the visual impact of the anime aesthetic.
- Standard 3D RPGs require flexible perspective toggles so players can switch between close inspection and environmental awareness.

### C. What It Will Do
1. **Camera Position & Spring-Arm Mathematics**:
   - In Third-Person mode, the desired camera position is calculated as:
     $$\mathbf{P}_{\text{target}} = \mathbf{P}_{\text{player}} + \begin{pmatrix} 0 \\ 1.8 \\ 0 \end{pmatrix} - \mathbf{D}_{\text{fwd}} \cdot d_{\text{cam}} + \mathbf{D}_{\text{right}} \cdot d_{\text{offset}}$$
     $$\text{where } \mathbf{D}_{\text{fwd}} = (-\sin(\text{yaw})\cos(\text{pitch}), \, \sin(\text{pitch}), \, -\cos(\text{yaw})\cos(\text{pitch})), \quad d_{\text{cam}} = 3.2\text{m}$$
   - **Wall Collision Raycast**: Raycasts from player head level $(0, 1.8, 0)$ toward $\mathbf{P}_{\text{target}}$. If any building collider intersects the ray at distance $d_{\text{hit}} < d_{\text{cam}}$, the camera distance snaps smoothly to $(d_{\text{hit}} - 0.2\text{m})$ to eliminate wall clipping.

2. **Avatar Locomotion Rigging**:
   - When moving in TPS mode:
     - Avatar rotates toward movement direction vector $\mathbf{v}_{\text{move}}$ with smooth angular interpolation ($\omega = 12\text{ rad/s}$).
     - Limb kinematics scale with sprint key:
       - **Walk ($5.5\text{ m/s}$)**: Leg stride $0.95$, arm swing $0.40$, bounce $0.024\text{m}$.
       - **Sprint ($10.0\text{ m/s}$)**: Leg stride $1.25$, arm swing $0.58$, forward torso lean $0.14\text{ rad}$.
   - When stationary:
     - Limb motion locks strictly to idle ($v = 0$), preventing any foot-sliding artifacts.

---

## 2. Subsystem 2: Interactive World Stations & Facility Spots

### A. What Should Be Changed
- Expand `updateProximity()` in [game3d-campus.js](file:///h:/HARSH_PROJECTS/PERSONAL%20PROJECT/cote/game3d-campus.js) to detect interactive world objects and furniture stations in addition to NPCs.
- Add interaction handlers (`E` key / click) for:
  1. **Ayanokouji's Classroom Desk (Class 1-D Seat 14)**.
  2. **Ayanokouji's Dormitory Bed (Room 401)**.
  3. **Memorial Library Reading Carrels**.
  4. **Palette Café Patio & Cafeteria Vending Machines**.
  5. **Central Park Fountain Bench**.
- Connect the Dormitory Bed sleep action directly to the **Java Simulation Backend** (`POST /api/time?hour=7.5`) to fast-forward the authoritative server clock to morning.

### B. Why It Is Changing
- Currently, only NPCs trigger the interaction prompt. The 15 campus buildings are populated with desks, beds, chairs, and vending machines, but the player cannot use any of them.
- Being able to sit at your designated desk during homeroom or sleep in your dormitory room completes the school-life roleplay fantasy.

### C. What It Will Do
1. **Interactive Station Registry (`WORLD_STATIONS`)**:
   ```javascript
   export const WORLD_STATIONS = {
     AYANOKOUJI_DESK: {
       id: 'AYANOKOUJI_DESK',
       loc: 'class1d',
       pos: [-60.0 + (14 % 5) * 1.6 - 3.2, 0, -20.0 + Math.floor(14 / 5) * 1.2 - 2.4],
       radius: 1.8,
       prompt: 'Sit at Seat 14 (Ayanokouji)',
       action: 'SIT_DESK'
     },
     DORM_BED_401: {
       id: 'DORM_BED_401',
       loc: 'dorm',
       pos: [-50.0, 0, 58.0],
       radius: 2.2,
       prompt: 'Rest in Bed (Fast-forward to 07:30)',
       action: 'SLEEP_REST'
     },
     LIBRARY_STUDY_DESK: {
       id: 'LIBRARY_STUDY_DESK',
       loc: 'library',
       pos: [-58.0, 0, 22.0],
       radius: 2.0,
       prompt: 'Study Academic Materials (+Wisdom)',
       action: 'STUDY_LIBRARY'
     },
     PALETTE_CAFE_TABLE: {
       id: 'PALETTE_CAFE_TABLE',
       loc: 'cafe',
       pos: [54.0, 0, 48.0],
       radius: 2.0,
       prompt: 'Enjoy Café Refreshment',
       action: 'CAFE_REFRESH'
     }
   };
   ```

2. **Action Execution Mechanics**:
   - **`SIT_DESK`**: Aligns player avatar to Seat 14, locks camera to desk view, triggers `sit_desk` animation pose, and shows homeroom status readout. Pressing `WASD` or `Escape` stands up.
   - **`SLEEP_REST`**: Fades screen to black with a smooth overlay transition, sends `POST /api/time?hour=7.5` to the Java backend, advances simulation day, restores stats, and plays morning birds chime.
   - **`STUDY_LIBRARY`**: Triggers reading animation, awards $+3$ Wisdom stat, and updates student notebook lore.

---

## 3. Subsystem 3: Activity Hand Props & Item Rigging

### A. What Should Be Changed
- Create a modular **Hand Prop Attachment System** (`attachProp(rig, propType)`) inside the character rigging pipeline.
- Dynamically attach procedural 3D items to NPC and Player hand bone pivots based on current state:
  - `STUDYING` / `sit_read` $\rightarrow$ Open Hardcover Book.
  - `EATING` / `sit_eat` $\rightarrow$ Dining Tray with Bento & Chopsticks.
  - `PLAYING_SPORT` / `sport_drill` $\rightarrow$ Basketball with synchronized floor dribble bounce.
  - `CAFE_REFRESH` $\rightarrow$ Ceramic Coffee Mug / Soda Can.

### B. Why It Is Changing
- When NPCs sit at library desks or cafeteria tables in the current build, their arms assume sitting angles but their hands remain empty, looking unnatural.
- Procedural low-poly props bring vibrant life and visual storytelling to every sector of the school.

### C. What It Will Do
1. **Procedural Prop Geometries**:
   - **Book**: Dual angled box covers (`0.18m x 0.12m x 0.01m`) with layered paper page blocks (`0xfaf8f5`).
   - **Basketball**: Textured orange sphere (`r = 0.12m`) with dark ribbing lines. Synchronized vertical sine wave offset $y(t) = | \sin(8t) | \times 0.65\text{m}$ to simulate live dribbling in the gymnasium.
   - **Coffee Cup**: Small cylinder (`rt = 0.035m, rb = 0.025m, h = 0.08m`) with a curved torus handle and dark coffee liquid surface.

2. **Lifecycle Management**:
   - When an NPC begins traveling (`path.length > 0`), props are automatically removed (`detachProps(rig)`).
   - Upon arriving and transitioning to their scheduled activity, the matching prop is instanced and parented to the wrist joint.

---

## 🛠️ Step-by-Step Implementation Task Checklist

- [ ] **Task 3.1: Implement Third-Person Camera & Toggle Key (`V` / `F5`)**
  - Add camera mode state (`fps` vs `tps`) and transition smoothing.
  - Implement spring-arm distance calculation and raycast wall collision clamping.
- [ ] **Task 3.2: Implement Full Player Avatar Locomotion Rigging**
  - Bind player avatar mesh visibility to Third-Person mode.
  - Connect WASD velocity vector to avatar yaw rotation and leg swing kinematics.
- [ ] **Task 3.3: Build `WORLD_STATIONS` Registry & Proximity Detection**
  - Define world coordinates for Seat 14, Dorm Bed 401, Library Carrel, and Café Patio.
  - Update `updateProximity()` to prioritize nearby station prompts if within radius.
- [ ] **Task 3.4: Implement World Station Action Handlers with Java Backend Sync**
  - Implement `SIT_DESK` (desk seating pose & camera lock).
  - Implement `SLEEP_REST` (fade-to-black transition, call `POST /api/time?hour=7.5` to Java server, day advancement).
  - Implement `STUDY_LIBRARY` and `CAFE_REFRESH`.
- [ ] **Task 3.5: Build Procedural Hand Prop System**
  - Create reusable mesh builders for books, lunch trays, basketballs, and coffee cups.
  - Implement `attachProp` and `detachProps` inside `updateNPCBehavior()`.
- [ ] **Task 3.6: Verification & Diagnostic Testing**
  - Toggle between FPS and TPS while running through classrooms and corridors; verify no wall clipping.
  - Interact with Dorm Bed 401 and verify Java server clock resets to `07:30` and day counter advances.
  - Walk into Library at `15:30` and verify Horikita is holding an open book at her reading desk.
