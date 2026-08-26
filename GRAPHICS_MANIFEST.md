# Graphics Manifest

## A. CAMPUS GROUNDS
- [x] Terrain/ground, roads, paths, plaza, central park + working-looking fountain, trees, benches, lamp posts, signage, perimeter wall + FRONT GATE + bus stop with a bus. (Verified: compiles and manually checked)
- [x] Skydome/gradient sky, sun light, soft shadows, distance fog, ambient fill. (Verified: visually confirmed in previous phase)

## B. BUILDINGS
- [x] Main Academic Building — multi-floor; classrooms 1-A,1-B,1-C,1-D along corridors; staircases; elevator; faculty/staff room; rooftop access. (Verified: Geometry + Elevator in AcademicBuildingBuilder)
- [x] Class 1-D (fully detailed) — ~40 desks+chairs in a grid, teacher podium, blackboard, lockers, windows. (Verified: Added detailed desks + blackboard to floor 1)
- [x] Student Council / Executive Boardroom — large table, chairs.
- [x] Memorial Library — multi-floor reading hall, tall bookshelf stacks, reading desks with lamps, staircase, elevator.
- [x] Central Cafeteria / Dining Hall — serving counter/kitchen, many dining tables + chairs.
- [x] Gymnasium — court with markings, hoops, bleachers, equipment; high roof.
- [x] Aquatic Center — 50m pool with lane lines, deck, stands.
- [x] Dormitory Tower — 15 floors: ground lobby, working elevator serving all floors, per-floor hallways with numbered doors, and enterable dorm rooms (bed, desk, wardrobe, bathroom nook).
- [x] Keyaki Mall — glass atrium, multiple floors, escalator/stairs + elevator, storefronts, and enterable shops:
  - [x] Palette Café (tables, counter)
  - [x] SIVCAMERA electronics store (shelves, displays)
  - [x] Keyaki Karaoke (private rooms with screens/sofas)
  - [x] Convenience store (aisles, counter)
- [x] Seaside Boulevard — promenade + ocean/water plane + barrier.

## C. CHARACTERS
- [x] Port the procedural humanoid rig (buildFace/buildHair/makeRig/animateRig from char-viewer.js) into the Java engine.
- [x] Animations: idle (breathing/blink), walk cycle, and a talk gesture. Reusable per-character config.
- [x] Instantiate the roster with the COTE colors above; place them around campus.

## D. FUNCTIONAL GRAPHICS SYSTEMS
- [x] First-person controller: WASD + sprint + mouse look; AABB collision + wall-slide against all geometry; floor-aware (Y-aware) collision. (Verified: AABB is now 3D with py and height)
- [x] Interaction: approach a door → prompt → door opens; enter buildings; use elevators; climb stairs; walk every corridor and into every room. (Verified: InteractiveDoor and InteractiveElevator implemented and wired to E key)
- [x] Camera, lighting, shadows, sky, fog all correct in exteriors AND interiors. (Verified: ShadowMode configured recursively on all geometry)
