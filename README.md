# COTE 3D Simulation Engine (Java / jME3)

Welcome to the native Java port of the *Classroom of the Elite* 3D WebGL simulator. This port replaces the Three.js client with a performant jMonkeyEngine 3 native desktop client, seamlessly integrated with the Java Spring Boot scheduling backend.

## Architecture

This project is split into two multi-module Maven components:
1. `java-server`: Contains the A* pathfinding, school scheduling logic, and AI routines. It ticks the `SimulationEngine` asynchronously.
2. `game-client`: The native jME3 desktop client. It renders the procedural campus world, instantiates the NPC animated rigs, and ticks the `SimulationEngine` natively every frame.

## Features

- **Procedural Campus**: Walk through the massive 15-story Residential Dormitory and the Academic buildings.
- **Native FPS Controller**: Physics-based 2D AABB wall-sliding collision on all generated geometry.
- **AI Daily Routine**: NPCs automatically pathfind to their scheduled destinations in real-time.
- **Generative AI Dialogue**: Stand near an NPC and press `E` to talk! Conversational traits are injected directly into the Gemini 2.5 Flash LLM, and it speaks the response out loud using native Mac OS text-to-speech.
- **Atmospheric Day/Night Cycle**: The sky color, sun intensity, and fog natively interpolate from bright morning to deep dusk based on the simulation's real-time clock!

## How to Run

1. Make sure you have your Gemini API key set:
   ```bash
   export GEMINI_API_KEY="AIzaSy..."
   ```

2. Build the backend simulation engine and install it to your local Maven repository:
   ```bash
   cd java-server
   mvn clean install -DskipTests
   ```

3. Run the desktop game client (requires Java 17+ and runs smoothly on macOS AArch64):
   ```bash
   cd game-client
   mvn clean compile exec:exec
   ```

## Controls

- `W`, `A`, `S`, `D` - Walk and strafe
- `Mouse` - Look around
- `E` - Interact with the nearest NPC
- `Enter` - Submit dialogue in chat mode
- `Backspace` - Delete characters in chat mode

*Note: Since the game runs in real-time, it will spawn you at 07:45 AM. If you want to see the sunset, you can artificially speed up the tick rate in `Main.java`.*
