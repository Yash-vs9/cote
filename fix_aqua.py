with open("game-client/src/main/java/com/cote/client/CampusBuilder.java", "r") as f:
    campus = f.read()

campus = campus.replace(
    "makeBox(0.2f, 6.0f, 24, matWater, cX + 20, 3.4f, cZ, g, true);",
    "makeWallWithDoor(0.2f, 6.0f, 24, matWater, cX + 20, 3.4f, cZ, g, cZ, 4.0f, 3.0f, true);"
)

with open("game-client/src/main/java/com/cote/client/CampusBuilder.java", "w") as f:
    f.write(campus)
