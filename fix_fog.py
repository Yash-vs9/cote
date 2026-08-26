with open("game-client/src/main/java/com/cote/client/Main.java", "r") as f:
    code = f.read()

code = code.replace("fog.setFogDensity(1.5f);", "fog.setFogDensity(0.015f);")
code = code.replace("fog.setFogDistance(80);", "fog.setFogDistance(400);")

with open("game-client/src/main/java/com/cote/client/Main.java", "w") as f:
    f.write(code)
