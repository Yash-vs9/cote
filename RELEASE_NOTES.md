# Release Notes — v1.1.0

## Highlights
- **Three save slots** with a slot picker, most-recent Continue, and one-time migration of
  the legacy single-slot save into slot 1. New games use an empty slot or recycle the oldest.
- **Branching story choices** now persist with the save, so a resumed RESPONSE page matches
  the option the player actually picked.
- **Safer saves**: the story is marked active before its first autosave, bench/rest state is
  reset between sessions, and despawns/pauses are replayed on resume.
- **Playable story campaign**: all 12 chapters of *Classroom of the Elite* Volume 1,
  data-driven script, autosave at every milestone, midterm exam mini-game, cinematic
  letterboxed dialogue with speaker nameplates and page counters.
- **Full game loop**: title screen (Continue / Free Roam / Play Story / Settings /
  Credits / Quit), ESC pause menu with manual Save Game, quit-to-title that never loses
  progress.
- **Robust saves**: single versioned slot with atomic writes, corruption fallback to
  legacy import, one-time migration of prototype story saves.
- **Settings that persist**: audio categories (master/music/effects/ambience), mouse
  sensitivity, reduced motion, FPS counter — applied live where possible.
- **Audio**: procedural sound effects (UI clicks, confirm/back, page turns, school chime,
  knocking) synthesized on first launch; volume categories wired end-to-end.
- **Pointer-lock feel**: cursor captured during play, visible only in menus; quad
  crosshair hides on screens and highlights amber near interactables.
- **Release engineering**: reproducible packaging script producing a standalone zip with
  launchers for Windows/Linux/macOS; version stamp `v1.1.0`; dev/release build split.

## Stability & correctness
- Player fall-out-of-world/NaN recovery teleports to campus spawn instead of soft-locking.
- Structured logging (`logs/game.log`) with dev-only DEBUG level; no stack traces shown
  to players.
- Time-cheat debug keys removed from release builds; engine stats hidden by default.
- Fixed stale `cote-server` artifact breaking compilation; LWJGL natives now included in
  packages (release-critical fix found by QA).

## Known limitations
- Graphics quality toggles (shadows/SSAO) apply on next launch.
- Free-roam AI chat requires a Gemini API key; without it NPCs reply with a notice.
- Day counter is not persisted (clock time is).
