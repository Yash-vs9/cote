# PHASE 5 — Outdoor Sports Complex (ANHS style)

## Chosen quadrant + bounding box
- Empty **NE quadrant**, east of the Gymnasium, south of nothing else in X>=76.
- World bbox: **X 76..124, Z -12..64** (center ~ (100, 26)). Clearances checked:
  - Gymnasium footprint X 50..74 / Z 16..44 (no overlap, 2m gap).
  - Keyaki Mall X 18..70 / Z 64..92 (disjoint in X).
  - Perimeter wall inner face x=129.5 (shed max x = 124.25).
  - Paved side path plane X 39..53 / Z 18..114 -> bridged with a new path strip.
- Sub-layout: tennis block (fenced) Z -12..6, X 79..117; track oval center
  (100, 38) semi-axes 16x24 (ring mid 14.5/22.5); pitch 20x32 inside; shed at
  (121, 0) 6x4, door facing west; benches x=80.5/119.5 at z=32,44; floodlight
  poles at (82,15) (118,15) (82,61) (118,61), visual only.

## CampusGraph additions (server)
Nodes 41 -> 45 (lowercase camel, mirrors existing style):
- `sportsJct`   (52, 34) — junction inserted on the east side path
- `sportsGate`  (76, 34) — west entry of the zone
- `sportsField` (100, 38) — track / soccer pitch
- `tennisCourt` (98, 8) — between tennis fence and track

Edges 46 -> 51 (connects to 3 existing nodes):
- ePath1 – sportsJct
- ePath2 – sportsJct
- sportsJct – sportsGate
- sportsGate – sportsField
- sportsGate – tennisCourt

Route-collision audit: no new collider intersects any new/existing edge
segment (benches at z 31.7..32.3 / 43.7..44.3 vs edge z≈34.7 at x=80; poles
cleared by >=10m). CampusGraphTest asserts connectivity only — unchanged.

## Geometry inventory (client, SportsComplexBuilder)
Shared mesh instances reused per shape-size (static Box/Cylinder fields,
color-keyed material cache): ~15 unique meshes for all props.
- Flat planes / decals (receive-only): 66
  (3 path strips, 4 court surfaces, 24 track-ring segments, 1 pitch grass,
  25 court+pitch line marks, 4 nets, 4 fence mesh panels, shed floor)
- Solid boxes: 31
  (4 fence rails, 6 shed wall pieces, shed roof, shelf, ball crate,
  12 bench parts, 4 light heads, 2 goal crossbars)
- Cylinders: 20 (8 net posts, 4 goal posts, 4 fence corner posts, 4 flood poles)
- **Total: 117 Geometries — under the 120 budget.**

## Colliders (CampusBuilder.colliders, +22 AABBs)
- Tennis fence: 4 thin AABBs (one per side, 3m high) + 4 corner posts
- Shed: 5 (west wall x2 door segments, east, south, north)
- Ball crate: 1; bench seats: 4; floodlight poles: 4
No colliders on: nets, goal posts, ring, lines, paths (walkable/decor).

## Landmarks entries
- key `track`, name "Running Track", navNode `sportsField`, (100, 38)
- key `tenniscourts`, name "Tennis Courts", navNode `tennisCourt`, (98, 8)
HudUI prompt lists intentionally untouched.

## Perf budget statement
Target <120 new Geometries met (117). Shadow policy: CastAndReceive ONLY on
large structures (shed walls/roof, fence corner posts, flood poles); small
props (lines, nets, ring segments, fence mesh, benches, heads) ShadowMode.Off;
ground planes ShadowMode.Receive. Meshes shared via static fields; materials
cached per color ( Lighting.j3md, UseMaterialColors ). No new dependencies.
