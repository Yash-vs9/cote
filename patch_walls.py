import re

def process_file(filepath):
    with open(filepath, "r") as f:
        content = f.read()

    # We need to add makeWallWithDoor method
    make_wall_method = """
    private void makeWallWithDoor(float w, float h, float d, com.jme3.math.ColorRGBA color, float x, float y, float z, com.jme3.scene.Node parent, float doorX, float doorW, float doorH, boolean isZAligned) {
        float h2 = h / 2f;
        float doorY = doorH / 2f;
        // The door frame color
        com.jme3.math.ColorRGBA frameCol = color.mult(0.8f);
        
        if (isZAligned) {
            // Wall runs along Z (width is small, depth is large)
            // doorX represents the Z coordinate of the door center
            float wallZStart = z - d/2f;
            float wallZEnd = z + d/2f;
            
            float leftLen = (doorX - doorW/2f) - wallZStart;
            if (leftLen > 0) {
                makeBox(w, h, leftLen, color, x, y, wallZStart + leftLen/2f, parent, true);
            }
            
            float rightLen = wallZEnd - (doorX + doorW/2f);
            if (rightLen > 0) {
                makeBox(w, h, rightLen, color, x, y, wallZEnd - rightLen/2f, parent, true);
            }
            
            // Header
            float headH = h - doorH;
            if (headH > 0) {
                makeBox(w, headH, doorW, color, x, doorH + headH/2f, doorX, parent, true);
            }
            
            // Frame
            makeBox(w+0.1f, doorH, 0.1f, frameCol, x, doorY, doorX - doorW/2f, parent, true);
            makeBox(w+0.1f, doorH, 0.1f, frameCol, x, doorY, doorX + doorW/2f, parent, true);
            makeBox(w+0.1f, 0.1f, doorW, frameCol, x, doorH, doorX, parent, true);
        } else {
            // Wall runs along X
            float wallXStart = x - w/2f;
            float wallXEnd = x + w/2f;
            
            float leftLen = (doorX - doorW/2f) - wallXStart;
            if (leftLen > 0) {
                makeBox(leftLen, h, d, color, wallXStart + leftLen/2f, y, z, parent, true);
            }
            
            float rightLen = wallXEnd - (doorX + doorW/2f);
            if (rightLen > 0) {
                makeBox(rightLen, h, d, color, wallXEnd - rightLen/2f, y, z, parent, true);
            }
            
            float headH = h - doorH;
            if (headH > 0) {
                makeBox(doorW, headH, d, color, doorX, doorH + headH/2f, z, parent, true);
            }
            
            // Frame
            makeBox(0.1f, doorH, d+0.1f, frameCol, doorX - doorW/2f, doorY, z, parent, true);
            makeBox(0.1f, doorH, d+0.1f, frameCol, doorX + doorW/2f, doorY, z, parent, true);
            makeBox(doorW, 0.1f, d+0.1f, frameCol, doorX, doorH, z, parent, true);
        }
    }
"""
    if "makeWallWithDoor" not in content:
        content = content.replace("private Geometry makeBox(", make_wall_method + "\n    private Geometry makeBox(")

    with open(filepath, "w") as f:
        f.write(content)

process_file("game-client/src/main/java/com/cote/client/CampusBuilder.java")
process_file("game-client/src/main/java/com/cote/client/AcademicBuildingBuilder.java")
process_file("game-client/src/main/java/com/cote/client/DormitoryBuilder.java")
