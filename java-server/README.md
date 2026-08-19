# COTE Java Simulation & Multi-Route Navigation Engine

A pure, object-oriented **Java implementation** of the Classroom of the Elite (COTE) campus AI, purpose-driven schedule engine, doorway flow arbitration, and traffic-aware multi-route selection system.

## 📁 Package Architecture (`com.cote.simulation`)

* **`PersonalityTraits.java`**: 5-trait model (`intelligence`, `discipline`, `athleticism`, `social`, `curiosity`) with procedural student archetype derivation (`Academic`, `Sports Athlete`, `Social Butterfly`, `Class Leader`, `Slacker / Casual`).
* **`SchoolSchedule.java`**: Configurable daily schedule timetable with 10 periods across 24 hours.
* **`CampusGraph.java`**: 42 navigation nodes and 72 bidirectional edges with parallel corridors.
* **`TrafficManager.java`**: Real-time edge/node traffic tracking and congestion costing.
* **`RouteManager.java`**: Banned-edge BFS candidate discovery (up to 4 paths) with traffic-weighted route selection.
* **`DoorwayQueueManager.java`**: Single-file doorway lock arbitration.
* **`ReservationManager.java`**: Unique seat reservation for 25 classroom desks, 24 dining seats, and 12 library desks.
* **`NPC.java` & `SimulationEngine.java`**: Autonomous state machine and master clock tick manager.
* **`SimulationServer.java`**: Zero-dependency built-in HTTP server (`port 8080`) providing live REST API endpoints with CORS support.

## 🚀 How to Run

### Windows:
Double-click `compile_and_run.bat` or in cmd:
```cmd
javac -d bin src/com/cote/simulation/*.java
java -cp bin com.cote.simulation.SimulationServer 8080
```

### Linux / Mac:
```bash
chmod +x compile_and_run.sh
./compile_and_run.sh
```

## 🌐 REST API Endpoints

* `GET http://localhost:8080/api/health` — Server health check.
* `GET http://localhost:8080/api/simulation` — Live simulation state with all NPC positions, states, active routes, and current schedule.
* `GET http://localhost:8080/api/route?from=gateN&to=classDoor&npcId=horikita` — Solves multi-route candidates and selects best traffic-aware route.
* `POST http://localhost:8080/api/time?hour=12.5` — Skips simulation time to specified hour.
