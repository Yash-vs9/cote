# Phase 4: Social AI & Java-Driven Dynamic Banter

This document outlines the complete technical specification, architectural design, and step-by-step task breakdown for **Phase 4: Social AI, Java-Driven Dynamic Banter & Authoritative Engine Sync**.

---

## 1. Subsystem 1: Java-Driven Social Banter & Pairing Engine

### A. What Should Be Changed
- Implement a dedicated **Social Banter & Pairing Manager** (`BanterManager.java`) inside the Java backend (`java-server/`).
- During non-class periods (Recess `10:00 - 10:15`, Lunch `12:00 - 13:00`, and After-School Leisure `15:00 - 20:00`):
  - The Java backend groups co-located NPCs into conversational clusters.
  - Generates authoritative banter events with speaker IDs, dialogue text, and timing offsets.
  - Exposes banter frames over `GET /api/simulation` (or dedicated endpoint `GET /api/banter`).
- The 3D client receives these frames and renders dynamic **3D Billboard Speech Bubbles** above character heads with smooth auto-fade timers ($3.5\text{s}$).

### B. Why It Is Changing
- When students gather during breaks and lunchtime, they currently stand completely silently in place unless the player manually presses `E`.
- Driving social interactions from the Java backend ensures that banter state is synchronized, deterministic, and easily testable via automated unit tests.

### C. What It Will Do
1. **Lore-Accurate Social Cluster Pairing Matrix**:
   - **Hirata & Karuizawa**: Class diplomacy and social circle chatter near Class 1-D windows or Keyaki Mall.
   - **Ike & Yamauchi**: Loud comedic banter about girls, S-System points, and arcade games in the courtyard.
   - **Kushida & Classmates**: Enthusiastic greetings across cafeteria tables.
   - **Horikita**: Cold, concise deflections when classmates attempt small talk during study hours.
   - **Sudou & Athletic Cohort**: Discussions about basketball practice and tournament training at the Gymnasium.

2. **3D Billboard Canvas Speech Bubbles**:
   - Creates a dynamically sized `CanvasTexture` inside a `THREE.Sprite`:
     - Rounded dark translucent container (`rgba(10, 14, 24, 0.88)`).
     - Accent border matching character's theme color (e.g. `#38bdf8` for Horikita, `#f472b6` for Kushida).
     - Crisp, high-DPI typography with tail pointer pointing downward to the speaker's head.
   - Positioned at $(x, y = 2.45\text{m}, z)$ above the character rig.
   - Automatically faces the active camera view vector with distance-based scale compensation so text remains legible at medium range.

---

## 2. Subsystem 2: Authoritative Two-Way Java Simulation Engine Sync

### A. What Should Be Changed
- Upgrade `JavaSimulationBridge` in [game3d-campus.js](file:///h:/HARSH_PROJECTS/PERSONAL%20PROJECT/cote/game3d-campus.js) to establish **True Two-Way Synchronization** with `java-server/`.
- The WebGL client periodically fetches full simulation state frames from `GET /api/simulation`.
- The Java server acts as the **authoritative simulation master**:
  - Managing master clock, timetable transitions, route solving, traffic congestion costs, seat reservations, and social banter.
- The JavaScript Three.js client acts as the **high-performance rendering client**:
  - Handling smooth kinematic interpolation, physics sliding, character bone rigging, speech bubble rendering, and audio playback.
- If the Java server is closed or offline, the client seamlessly falls back to local JavaScript simulation logic with zero interruption to the user.

### B. Why It Is Changing
- Currently, `JavaSimulationBridge` only checks `/api/health` and forwards time skips via `setServerTime()`. It never actually ingests the simulation data from `/api/simulation`.
- This creates duplicate, desynchronized states where JavaScript and Java simulate two different realities simultaneously.
- Unifying them makes the Java server the single source of truth for the entire COTE simulation ecosystem.

### C. What It Will Do
1. **Frame Ingestion Protocol**:
   - The client polls `/api/simulation` at $10\text{ Hz}$.
   - Ingests authoritative JSON payload:
     ```json
     {
       "time": "12:15",
       "clockMin": 735.0,
       "day": 1,
       "event": { "id": "LUNCH", "activity": "LUNCH", "label": "School Cafeteria Dining" },
       "npcs": [
         {
           "id": "horikita",
           "state": "GOING_TO_LUNCH",
           "currentActivity": "LUNCH_DINING",
           "seat": "CAFETERIA_T1_S1",
           "targetSpotId": "CAFETERIA_T1_S1",
           "activeBanter": { "text": "...I prefer eating quietly.", "duration": 3.5 }
         }
       ]
     }
     ```
2. **Kinematic Interpolation**:
   - Client matches NPC records by `id`.
   - If an NPC's destination or state updated from the Java engine, the client triggers smooth path traversal to the assigned coordinates without teleports or stuttering.

---

## 🛠️ Step-by-Step Implementation Task Checklist

- [ ] **Task 4.1: Implement `BanterManager.java` in `java-server/`**
  - Define dialogue repository categorized by schedule period and student pairing.
  - Implement cluster detection algorithm grouping co-located NPCs.
  - Include active banter payloads in `GET /api/simulation` JSON output.
- [ ] **Task 4.2: Build 3D Billboard Canvas Speech Bubbles in Client**
  - Create canvas texture generator with character color accents and bubble tail.
  - Add auto-lookAt camera orientation and 3.5s auto-fade timer.
- [ ] **Task 4.3: Implement Authoritative Ingestion in `JavaSimulationBridge`**
  - Ingest live simulation frames and update NPC states, destination spots, and active banter.
  - Preserve smooth Three.js positional lerp and bone animations.
- [ ] **Task 4.4: Write JUnit 5 Tests for `BanterManagerTest`**
  - Assert that banter events only trigger during allowed non-class periods.
  - Verify that isolated NPCs do not trigger pairing dialogues.
- [ ] **Task 4.5: Verification & End-to-End Testing**
  - Launch Java server on port `8080` and open 3D game.
  - Observe `F3` HUD confirming active Java engine sync.
  - Fast-forward to Recess (`10:05`) and Lunch (`12:15`) and observe dynamic speech bubbles popping up above chatting students in Class 1-D and Cafeteria.
