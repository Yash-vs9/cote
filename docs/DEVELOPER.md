# Developer Guide — ANHS Java Edition

## 1. Requirements

- JDK 17+
- Maven 3.8+ (`mvn -v`)
- A GPU with OpenGL 3.2+ (LWJGL 3 / OpenGL via jME 3.6.1)

## 2. Build & run

```bash
cd game-client
mvn clean test          # compile + unit tests
mvn compile exec:exec   # run the game from source
```

The game depends on the local `com.cote:cote-server:2.0.0` artifact.
After changing `java-server/`, reinstall it:

```bash
cd java-server && mvn -q clean install -DskipTests
```

## 3. Architecture

Two Maven modules:

- **java-server** (`com.cote.simulation`): headless world brain. Owns the clock,
  daily schedule state machine, Dijkstra routing over `CampusGraph`, seat/spot
  reservations and NPC data. Pure Java, unit-testable, no rendering.
- **game-client** (`com.cote.client`): jMonkeyEngine `SimpleApplication`.

### Client packages

| Package | Responsibility |
|---|---|
| `com.cote.client` | `Main` (app shell, input routing, save hooks), world builders, `NpcController`, `Landmarks`, menus |
| `.ui` | Shared widgets: `UiKit` (panels/wrap), `Widgets` (buttons/sliders/toggles) |
| `.story` | Data-driven story: `StoryLoader` → `Chapter`/`Step` → `StoryManager`, VN rendering in `StoryUI`, quiz in `QuizGame`, temp actors in `StoryExtra` |
| `.systems` | Product services: `Log`, `Settings`, `GameSave`, `AudioManager`, `Version` |

### Key contracts

- **Input routing order** in `Main.onAction`: ESC-pause → dev time cheats → title menu
  → pause menu gate → elevator/dialogue gates → story UI gate → gameplay keys.
  Every modal screen zeroes movement flags so state never leaks between screens.
- **Frame independence**: everything advances by `tpf`/delta seconds; the server clock
  converts seconds to in-game minutes (`20 real min = 24 h`).
- **Persistence**: three versioned slots `save1..3.dat` (atomic temp+move, format v2:
  player transform, clock, **day counter + private points**). `Continue` picks the most
  recent slot; pre-1.1 `save.dat` is copied into slot 1 once at boot. Legacy
  `story_save.properties` is imported once then deleted. Settings live in
  `settings.properties`. Story milestones trigger autosave through a hook
  (`StoryManager.setAutosaveHook`) so the story module stays decoupled from I/O.

### Story scripting

Content lives in `src/main/resources/story/volume1.story` — a line-based DSL parsed by
`StoryLoader` (directives: `CHAPTER/NARR/ME/NPC/OBJ/GOTO/GOTOAT/WAIT/TIME/TELEPORT/
CHOICE/RESPONSE/SPAWN/DESPAWN/CMD/PAUSE/RESUME/SET/LABEL/JUMP/IF...JUMP/GOTO_CH/
QUIZ/TITLE/END`, `|` separates args, `\|` escapes). Branching: `LABEL name` marks a
chapter-scoped target, `JUMP name` redirects unconditionally, `IF flag JUMP name`
redirects only when the flag is set, `GOTO_CH n` jumps to another chapter, and a
`RESPONSE` with a trailing 4th arg sets a flag when that branch plays — so choices
carry forward. `mvn test` validates every cross-reference (jump targets, GOTO/CMD
places, chapter numbers) against the script.

## 4. Debug vs release

Development mode is activated with `-Dcote.dev=true` and enables:
engine stats overlay, `[`/`]`/F1–F4 time-cheat keys, DEBUG log lines.

Release builds keep only warnings+ in `logs/game.log` and hide cheats.

## 5. Release process

```powershell
powershell -ExecutionPolicy Bypass -File scripts/package-release.ps1
# → dist/ANHS-Java-Edition-v1.1.0.zip
```

The script builds, copies runtime jars (including LWJGL natives), writes launchers for
Windows/Linux/macOS and zips the result. Always smoke-test the package by launching the
bat from an unrelated working directory before publishing.

Bump the version in `scripts/package-release.*` and `systems/Version.java` together.

## 6. Testing

Unit tests cover the pure-Java critical systems: save format round-trip + corruption
fallbacks + legacy migration, settings persistence, story script validation, quiz logic.

Manual QA checklist lives in `QA_REPORT.md`.
