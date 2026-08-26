with open("game-client/src/main/java/com/cote/client/CampusBuilder.java", "r") as f:
    campus = f.read()

replacement = """        for (int t = 0; t < TIERS; t++) {
            for (int b = 0; b < bays; b++) {
                float bx = cX - BLD_L / 2f + bayW * (b + 0.5f);
                float y = 3.2f + 6.0f * t;
                if (t == 0 && (b == 3 || b == 4)) {
                    makeBox(bayW - 0.15f, 5.5f, 0.05f, matGlass, bx, y, cZ + BLD_D / 2f, g, true);
                } else {
                    makeBox(bayW - 0.15f, 5.5f, 0.05f, matGlass, bx, y, cZ - BLD_D / 2f, g, true);
                    makeBox(bayW - 0.15f, 5.5f, 0.05f, matGlass, bx, y, cZ + BLD_D / 2f, g, true);
                }
            }
        }"""

campus = campus.replace(
    """        for (int t = 0; t < TIERS; t++) {
            for (int b = 0; b < bays; b++) {
                float bx = cX - BLD_L / 2f + bayW * (b + 0.5f);
                float y = 3.2f + 6.0f * t;
                makeBox(bayW - 0.15f, 5.5f, 0.05f, matGlass, bx, y, cZ - BLD_D / 2f, g, true);
                makeBox(bayW - 0.15f, 5.5f, 0.05f, matGlass, bx, y, cZ + BLD_D / 2f, g, true);
            }
        }""",
    replacement
)

with open("game-client/src/main/java/com/cote/client/CampusBuilder.java", "w") as f:
    f.write(campus)
