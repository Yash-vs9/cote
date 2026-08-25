# QA Report — v1.0.0 release candidate

Environment: Windows 10/11, Java 17 (Temurin), jMonkeyEngine 3.6.1, 1280x720.

## Automated tests — PASS (14/14)

| Suite | Cases | Result |
|---|---|---|
| StoryLoaderTest | chapter count/order, GOTO/CMD target validity, choice/response bounds, quiz step presence | PASS |
| GameSaveTest | round-trip all fields, corruption → legacy fallback, missing files, future version refusal | PASS |
| SettingsTest | defaults, full round-trip persistence, corrupt file → defaults | PASS |
| QuizGameTest | scoring, timeout-as-wrong, question integrity | PASS |

## Boot & smoke — PASS
- Source run (`mvn compile exec:exec`): boots to title screen, world + audio init clean,
  no exceptions in `logs/game.log` across repeated launches.
- **Packaged build**: launched `Play-Windows.bat` from an unrelated working directory;
  boots standalone with generated SFX and title screen.

## Manual pass

| Area | Checks performed | Result |
|---|---|---|
| Title screen | mouse hover/click on every button; keys 1/2/S; Continue disabled without save; R-reset removed in favor of settings-free flow | PASS |
| Free roam | spawn near dorms, movement/sprint/collision, NPC talk (Gemini + fallback notice), elevator, knock-doors | PASS |
| Story mode Ch1–Ch12 scripted flow | loader validation harness over all 226 steps (GOTO targets, CMD places, speakers, response bounds) | PASS |
| Pause menu | ESC open/close during roam & story pages; Resume; Save Game writes slot + toast + chime; Quit-to-title returns and preserves save | PASS |
| Save/Load | manual save → quit → Continue restores position, clock, story step; corrupted slot recovers via legacy import (unit-verified) | PASS |
| Settings | slider drag + live audio volume change audible; values survive restart; reduced-motion flag stored | PASS |
| Edge cases | ESC spam during transitions gated by input order; pause during story page blocked by design; alt-tab during boot tolerated | PASS |
| Packaging | zip contains only runtime jars incl. LWJGL natives + launchers; no sources/debug artifacts | PASS |

## Issues found & fixed during QA
1. **Missing LWJGL natives in package** (`UnsatisfiedLinkError: lwjgl.dll`) — packaging
   script filtered wrong dependency scope; switched to `runtime`. Regression risk now
   covered by the dist smoke test step.
2. **FileLocator path semantics** — asset keys must be relative to registered root;
   AudioManager patched and verified via isolated probe.
3. **Launcher CWD** — `.bat` now `cd /d %~dp0` so double-clicking from Explorer works.
4. **Lenient properties parser accepted garbage saves** — saves without a version marker
   are treated as corrupt and fall back to legacy import (regression-tested).
5. **Pause/menu input leakage** — centralized gating order in `Main.onAction`.

## Performance observations (informal)
- Steady 60 FPS (VSync) on test hardware during roam and story scenes; frame times
  stable while NPCs route multi-floor.
- Memory stable across a 30-minute soak (no growing collections identified; audio nodes
  are fixed-size buffers loaded once).

## Final status: RELEASE CANDIDATE APPROVED
