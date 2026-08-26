import re

# 1. AcademicBuildingBuilder.java
with open("game-client/src/main/java/com/cote/client/AcademicBuildingBuilder.java", "r") as f:
    acad = f.read()
# Replace South wall with makeWallWithDoor
acad = acad.replace(
    "makeBox(60, bldH, 1, concrete, 0, bldH/2, bZ + 13, g, true); // South wall",
    "makeWallWithDoor(60, bldH, 1, concrete, 0, bldH/2, bZ + 13, g, 0, 4.0f, 2.2f, false); // South wall with door gap"
)
# Change the door geometry to collide = false
acad = acad.replace(
    "Geometry dGeom = makeBox(0.1f, 2.2f, 2.0f, wood, 0, 1.1f, 1.0f, doorPivot, true);",
    "Geometry dGeom = makeBox(0.1f, 2.2f, 2.0f, wood, 0, 1.1f, 1.0f, doorPivot, false);"
)
# Add interactive main door to AcademicBuilding
if "InteractiveDoor acadDoor" not in acad:
    acad = acad.replace(
        "// Ground floor lobby entrance (remove wall piece)",
        """// Ground floor lobby entrance door
        Node acadDoorPivot = new Node("AcadDoor");
        acadDoorPivot.setLocalTranslation(-2.0f, 0, bZ + 13);
        g.attachChild(acadDoorPivot);
        Geometry adGeom = makeBox(4.0f, 2.2f, 0.2f, glass, 2.0f, 1.1f, 0, acadDoorPivot, false);
        adGeom.setName("Door_Acad");
        Main.doors.add(new InteractiveDoor(adGeom.getName(), acadDoorPivot, adGeom));
        // Ground floor lobby entrance (remove wall piece)"""
    )
with open("game-client/src/main/java/com/cote/client/AcademicBuildingBuilder.java", "w") as f:
    f.write(acad)

# 2. DormitoryBuilder.java
with open("game-client/src/main/java/com/cote/client/DormitoryBuilder.java", "r") as f:
    dorm = f.read()
# The ground floor South wall has y = FH/2
dorm = dorm.replace(
    "makeBox(28, FH, 0.4f, matConcrete, 0, y + FH/2, 14, g, true);",
    """if (f == 0) {
                    makeWallWithDoor(28, FH, 0.4f, matConcrete, 0, y + FH/2, 14, g, 0, 4.0f, 2.2f, false);
                } else {
                    makeBox(28, FH, 0.4f, matConcrete, 0, y + FH/2, 14, g, true);
                }"""
)
# Change dorm doors to false
dorm = dorm.replace(
    "Geometry dGeom = makeBox(1.0f, 2.2f, 0.1f, matWood, 0.5f, 1.1f, 0, doorPivot, true);",
    "Geometry dGeom = makeBox(1.0f, 2.2f, 0.1f, matWood, 0.5f, 1.1f, 0, doorPivot, false);"
)
# Add interactive main door to Dormitory
if "InteractiveDoor dormMainDoor" not in dorm:
    dorm = dorm.replace(
        "// Ground floor entrance",
        """// Ground floor entrance door
        Node dormDoorPivot = new Node("DormMainDoor");
        dormDoorPivot.setLocalTranslation(-2.0f, 0, 14);
        g.attachChild(dormDoorPivot);
        Geometry ddGeom = makeBox(4.0f, 2.2f, 0.2f, matDarkGlass, 2.0f, 1.1f, 0, dormDoorPivot, false);
        ddGeom.setName("Door_DormMain");
        Main.doors.add(new InteractiveDoor(ddGeom.getName(), dormDoorPivot, ddGeom));
        // Ground floor entrance"""
    )
with open("game-client/src/main/java/com/cote/client/DormitoryBuilder.java", "w") as f:
    f.write(dorm)

# 3. CampusBuilder.java
with open("game-client/src/main/java/com/cote/client/CampusBuilder.java", "r") as f:
    campus = f.read()
# Fix all `Geometry dGeom = makeBox(..., true);` to `false` for doors!
campus = re.sub(
    r'(Geometry dGeom = makeBox\([^,]+, [^,]+, [^,]+, [^,]+, [^,]+, [^,]+, [^,]+, doorPivot), true\);',
    r'\1, false);',
    campus
)
# Cafeteria East Wall
campus = campus.replace(
    "makeBox(0.4f, 6.0f, 40, matGlass, cX + 18, 3.0f, cZ, g, true); // East",
    "makeWallWithDoor(0.4f, 6.0f, 40, matGlass, cX + 18, 3.0f, cZ, g, cZ - 3, 6.0f, 3.0f, true); // East with door"
)
# Aquatic Center West wall
campus = campus.replace(
    "makeBox(0.4f, 8.0f, 40, matGlass, cX - 16, 4.0f, cZ, g, true); // West",
    "makeWallWithDoor(0.4f, 8.0f, 40, matGlass, cX - 16, 4.0f, cZ, g, cZ - 12, 6.0f, 3.0f, true); // West with door"
)
# Council Room has a door but wall is already broken down manually? No, council room door is inside the Main Academic building, so it's a room divider!
# Actually Council Room walls:
# makeBox(0.2f, 3.2f, 2.8f, matWall, cX - 6.0f, 4.25f * 3 + 1.6f, cZ - 2.6f, g, true);
# makeBox(0.2f, 3.2f, 2.8f, matWall, cX - 6.0f, 4.25f * 3 + 1.6f, cZ + 2.6f, g, true);
# The gap is from z-1.2 to z+1.2. Which is 2.4 wide. So that's already got a gap!

with open("game-client/src/main/java/com/cote/client/CampusBuilder.java", "w") as f:
    f.write(campus)

