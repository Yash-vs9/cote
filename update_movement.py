import re

with open("game-client/src/main/java/com/cote/client/Main.java", "r") as f:
    main_code = f.read()

replacement = """
                Vector3f pos = cam.getLocation();
                float radius = 0.4f;
                float playerHeight = 1.8f;
                float eyeHeight = 1.4f; // relative to feet
                float footY = pos.y - eyeHeight;
                
                // Determine the floor height we are standing on (or stepping onto)
                float stepHeight = 0.6f; // Max step height
                float newFootY = -1000f;
                
                for (CampusBuilder.AABB aabb : CampusBuilder.colliders) {
                    if (pos.x + radius > aabb.minX && pos.x - radius < aabb.maxX &&
                        pos.z + radius > aabb.minZ && pos.z - radius < aabb.maxZ) {
                        if (aabb.maxY <= footY + stepHeight && aabb.maxY > newFootY) {
                            newFootY = aabb.maxY;
                        }
                    }
                }
                
                // Apply gravity / step up
                if (newFootY != -1000f) {
                    footY = footY + (newFootY - footY) * 15f * tpf; // smooth snap to floor
                } else {
                    footY -= 5f * tpf; // simple gravity if falling
                    // Don't fall below ground
                    if (footY < 0.05f) footY = 0.05f;
                }
                
                pos.y = footY + eyeHeight;
                
                // X-axis collision (wall slide)
                float nextX = pos.x + walkDirection.x;
                boolean collidesX = false;
                for (CampusBuilder.AABB aabb : CampusBuilder.colliders) {
                    if (aabb.intersects(nextX, footY + 0.1f, pos.z, radius, playerHeight - 0.1f)) { collidesX = true; break; }
                }
                if (!collidesX) pos.x = nextX;
                
                // Z-axis collision (wall slide)
                float nextZ = pos.z + walkDirection.z;
                boolean collidesZ = false;
                for (CampusBuilder.AABB aabb : CampusBuilder.colliders) {
                    if (aabb.intersects(pos.x, footY + 0.1f, nextZ, radius, playerHeight - 0.1f)) { collidesZ = true; break; }
                }
                if (!collidesZ) pos.z = nextZ;
"""

old_regex = r"Vector3f pos = cam\.getLocation\(\);.*?cam\.setLocation\(pos\);"
main_code = re.sub(old_regex, replacement + "\n                cam.setLocation(pos);", main_code, flags=re.DOTALL)

with open("game-client/src/main/java/com/cote/client/Main.java", "w") as f:
    f.write(main_code)
