# Advanced Nurturing High School — Java Edition

A 3D desktop game inspired by *Classroom of the Elite*, built with jMonkeyEngine 3.
Explore a fully simulated campus, talk with AI-driven classmates in free roam, or play
the complete **Volume 1 story campaign** — 12 chapters from the bus stop to the karaoke
victory party, including a midterm exam you actually take.

---

## Quick Start (players)

**Requirements:** Java 17 or newer ([adoptium.net](https://adoptium.net)), any modern GPU.

1. Download `ANHS-Java-Edition-v1.0.0.zip` and unzip anywhere.
2. Run:
   - **Windows:** double-click `Play-Windows.bat`
   - **Linux/macOS:** `bash play-linux-mac.sh`

### Controls

| Input | Action |
|---|---|
| Mouse | Look around (pointer is captured during play) |
| `W A S D` | Move · `Shift` sprint |
| `E` | Interact / advance story dialogue |
| `1–4` | Answer dialogue choices & exam questions |
| `ESC` | Pause menu (Resume / Save / Settings / Quit) |

### Game modes (title screen)

- **Continue** — resumes your last save (story position *and* where you were standing).
- **Free Roam** — sandbox campus; chat with classmates via Google Gemini AI (optional API key via `GEMINI_API_KEY` env var), command NPCs, ride elevators, day/night cycle.
- **Play Story** — the Volume 1 campaign. Autosaves at every milestone.

Settings persist (`settings.properties`): audio volumes, mouse sensitivity, reduced motion,
FPS counter. Saves are atomic — a crash can never corrupt your progress.

---

## For developers

See **[docs/DEVELOPER.md](docs/DEVELOPER.md)** for architecture, build commands,
testing, debug builds and the release process.

- Build & test: `mvn clean test`
- Run from source: `cd game-client && mvn compile exec:exec`
- Development build (debug overlays + time cheats): `java -Dcote.dev=true -cp ...`
- Release package: `powershell -File scripts/package-release.ps1`

## Project layout

```
game-client/   Desktop game (jMonkeyEngine 3.6.1, Java 17)
  src/main/java/com/cote/client/      game code (world, NPCs, UI, story, systems)
  src/main/resources/story/           data-driven story script (volume1.story)
  scripts/                            release packaging
java-server/   Embedded simulation library (schedules, pathfinding, reservations)
data/          Reference material for the story adaptation
```
