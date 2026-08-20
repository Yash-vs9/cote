# Phase 1: Complete Java Backend Migration & Maven Build System

This document outlines the complete technical specification, architectural design, and step-by-step task breakdown for **Phase 1: Shifting the Entire Backend to Java**.

---

## 1. Subsystem 1: Unified Java HTTP Web & Static Asset Server

### A. What Should Be Changed
- Upgrade `SimulationServer.java` in [java-server/](file:///h:/HARSH_PROJECTS/PERSONAL%20PROJECT/cote/java-server/) to become the **Primary Web & Simulation Server** for the entire project.
- Implement a comprehensive static file handler within `com.sun.net.httpserver.HttpServer` capable of serving all frontend assets directly from the repository root:
  - `index.html` (Master Portal)
  - `game3d-campus.html` and `game3d-campus.js` (3D Campus Simulation)
  - `2d-rpg/` directory (`index.html`, `app.js`, `style.css`)
  - `blueprints/` directory (All 15 diorama `.html` files)
  - Text, font, JSON, shader, and media files with correct MIME types and UTF-8 encoding.
- Enable full CORS support (`Access-Control-Allow-Origin: *`, `OPTIONS` preflight handling) across all API and static contexts on port `8080` (with configurable fallback port `3000`).

### B. Why It Is Changing
- Currently, the project relies on a dual-stack setup: Node.js (`server.js`) on port `3000` to serve web files, and an optional Java server on port `8080` for simulation.
- Running two separate runtimes (Node.js + Java) causes port conflicts, desynchronized states, and duplicate maintenance.
- Shifting completely to Java establishes **one single runtime**, simplifies local deployment to a single command (`java -jar cote-server.jar` or `mvn exec:java`), and prepares the architecture for authoritative server-side simulation.

### C. What It Will Do
1. **MIME Type Mapping & File Resolution**:
   - The Java static handler maps file extensions accurately:
     - `.html` $\rightarrow$ `text/html; charset=UTF-8`
     - `.js` / `.mjs` $\rightarrow$ `application/javascript; charset=UTF-8`
     - `.css` $\rightarrow$ `text/css; charset=UTF-8`
     - `.json` $\rightarrow$ `application/json; charset=UTF-8`
     - `.png` $\rightarrow$ `image/png`, `.jpg` / `.jpeg` $\rightarrow$ `image/jpeg`, `.svg` $\rightarrow$ `image/svg+xml`
     - `.woff2` $\rightarrow$ `font/woff2`, `.ttf` $\rightarrow$ `font/ttf`
   - Handles root path routing (e.g. `/` resolves to `index.html`) and prevents directory traversal vulnerabilities using sanitized path normalization (`Path.normalize()`).

2. **REST API Context Endpoints**:
   - `GET /api/health` — Returns server status, version, and active engine mode.
   - `GET /api/simulation` — Returns live 24h clock (`clockMin`, formatted `HH:mm`), day count, current schedule event, and list of all active NPCs with states, target spot IDs, and activity reasons.
   - `GET /api/route?from=...&to=...&npcId=...` — Solves multi-candidate paths using banned-edge BFS and returns ranked routes with congestion traffic scores.
   - `POST /api/time?hour=...` — Sets simulation clock to specific hour and triggers immediate schedule transition.

---

## 2. Subsystem 2: Maven Build System (`pom.xml`) & Project Structure

### A. What Should Be Changed
- Standardize [java-server/](file:///h:/HARSH_PROJECTS/PERSONAL%20PROJECT/cote/java-server/) into a standard Maven project structure:
  ```
  java-server/
  ├── pom.xml
  ├── compile_and_run.bat
  ├── compile_and_run.sh
  └── src/
      ├── main/
      │   └── java/com/cote/simulation/
      │       ├── CampusGraph.java
      │       ├── DoorwayQueueManager.java
      │       ├── NPC.java
      │       ├── PersonalityTraits.java
      │       ├── ReservationManager.java
      │       ├── RouteManager.java
      │       ├── ScheduleEvent.java
      │       ├── SchoolSchedule.java
      │       ├── SimulationEngine.java
      │       ├── SimulationServer.java
      │       ├── StaticFileHandler.java       <-- NEW
      │       └── TrafficManager.java
      └── test/
          └── java/com/cote/simulation/        <-- NEW
              ├── CampusGraphTest.java
              ├── RouteManagerTest.java
              ├── TrafficManagerTest.java
              ├── ReservationManagerTest.java
              └── SchoolScheduleTest.java
  ```
- Configure `pom.xml` with Java 17+ compiler plugins, `maven-jar-plugin` (with `Main-Class: com.cote.simulation.SimulationServer`), `maven-shade-plugin` for standalone fat JAR creation, and JUnit Jupiter 5 dependencies.

### B. Why It Is Changing
- Previously, the Java server only had basic shell/batch scripts invoking raw `javac`.
- A Maven project provides standardized dependency management, automated testing via `mvn test`, IDE compatibility across IntelliJ, VS Code, and Eclipse, and one-command executable JAR builds (`mvn package`).

### C. What It Will Do
- Allows building and launching the entire server via standard commands:
  ```bash
  # Run all unit tests:
  mvn clean test

  # Compile and run server:
  mvn compile exec:java

  # Package standalone executable JAR:
  mvn clean package
  java -jar target/cote-server-2.0.0.jar
  ```

---

## 3. Subsystem 3: Automated JUnit 5 Test Suite

### A. What Should Be Changed
- Implement unit and integration test suites in `src/test/java/com/cote/simulation/` covering all graph algorithms, traffic scoring, and schedule transitions.

### B. Why It Is Changing
- Without automated tests, modifying graph coordinates, adding corridor edges, or adjusting congestion multipliers could silently break pathfinding or lead to NPC clumping.
- Establishing test coverage guarantees **100% path reachability** across all campus sectors.

### C. What It Will Do
1. **`CampusGraphTest`**:
   - Validates that all 42 waypoints in `NODES` are connected.
   - Runs an All-Pairs Shortest Path (Floyd-Warshall / repeated BFS) to assert that every single node can reach every other node with zero unreachable islands.

2. **`RouteManagerTest`**:
   - Asserts that major campus journeys (e.g. `gateN` $\rightarrow$ `classDoor`, `classDoor` $\rightarrow$ `cafDoor`, `cafDoor` $\rightarrow$ `libDoor`) discover $\ge 2$ distinct candidate paths.
   - Tests banned-edge route diversity and prevents route oscillation.

3. **`TrafficManagerTest`**:
   - Asserts that adding traffic to an edge increments cost by $+7.5\text{m}$ per student.
   - Verifies that `removeRouteTraffic()` cleanly decrements edge loads back to $0$.

4. **`ReservationManagerTest`**:
   - Simulates 30 students requesting classroom desks and cafeteria dining chairs.
   - Asserts that no two students receive duplicate `spotId` allocations.

5. **`SchoolScheduleTest`**:
   - Asserts that all 24 hours ($0 \dots 1439\text{ min}$) map to valid schedule events.
   - Validates midnight wrap-around logic (`22:30 - 07:30` Night Curfew).

---

## 🛠️ Step-by-Step Implementation Task Checklist

- [ ] **Task 1.1: Standardize Maven Directory Layout**
  - Reorganize `java-server/src/` into `src/main/java/com/cote/simulation/` and `src/test/java/com/cote/simulation/`.
- [ ] **Task 1.2: Create `pom.xml` Configuration**
  - Configure Java 17 compiler, `junit-jupiter` 5.10.0, and `exec-maven-plugin`.
- [ ] **Task 1.3: Build `StaticFileHandler.java`**
  - Implement full MIME type mapping, file streaming, cache headers, and CORS preflight.
  - Mount root directory as static document base in `SimulationServer.java`.
- [ ] **Task 1.4: Update `SimulationServer.java` Endpoints**
  - Bind both static file handler (`/`) and API handlers (`/api/*`) on port `8080`.
- [ ] **Task 1.5: Implement Complete JUnit 5 Test Suite**
  - Write `CampusGraphTest.java`, `RouteManagerTest.java`, `TrafficManagerTest.java`, `ReservationManagerTest.java`, and `SchoolScheduleTest.java`.
  - Execute `mvn clean test` and verify 100% pass rate.
- [ ] **Task 1.6: Update Launch Scripts & Documentation**
  - Update `compile_and_run.bat` and `compile_and_run.sh` to use Maven when available.
  - Verify that opening `http://localhost:8080/index.html` loads the Master Portal and all games without Node.js.

---

## 4. Subsystem 4: Java 2D Swing Visualizer (Graphics in Java)

### A. What Should Be Changed
- Implement a Java Swing `JFrame` window that renders a top-down 2D map of the campus graph, drawing all nodes, edges, and real-time NPC positions.
- Integrate the visualizer into `SimulationServer.java` so that starting the server opens a live visual monitor of the simulation.

### B. Why It Is Changing
- Having a native Java GUI allows immediate visual debugging of the simulation engine without needing to launch the WebGL client.
- Provides a standalone desktop graphics experience for users who prefer running the game purely in Java.

### C. What It Will Do
- Opens a window (`800x600` or larger) using `java.awt.Graphics2D`.
- Translates world coordinates (x, z) to screen coordinates.
- Draws nodes as small circles, edges as lines, and NPCs as colored dots that move in real-time.
- Displays the current game time and day on the screen.
