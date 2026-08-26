import re

# Fix CharacterRig
with open("game-client/src/main/java/com/cote/client/CharacterRig.java", "r") as f:
    rig = f.read()
rig = rig.replace("public Node footL, footR;", "public Geometry footL, footR;")
with open("game-client/src/main/java/com/cote/client/CharacterRig.java", "w") as f:
    f.write(rig)

# Fix Main - restoring initKeys and initCrossHairs
with open("game-client/src/main/java/com/cote/client/Main.java", "r") as f:
    m = f.read()

# Fix CampusBuilder initialization in Main
m = m.replace("CampusBuilder builder = new CampusBuilder(rootNode, assetManager);", "CampusBuilder builder = new CampusBuilder(assetManager);")
m = m.replace("initKeys();", "")
m = m.replace("initCrossHairs();", "")

with open("game-client/src/main/java/com/cote/client/Main.java", "w") as f:
    f.write(m)
