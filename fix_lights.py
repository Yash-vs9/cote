import re

with open("game-client/src/main/java/com/cote/client/Main.java", "r") as f:
    code = f.read()

# Fix the shadow of sun/ambient
code = code.replace("DirectionalLight sun = new DirectionalLight();", "sun = new DirectionalLight();")
code = code.replace("AmbientLight ambient = new AmbientLight();", "ambient = new AmbientLight();")

with open("game-client/src/main/java/com/cote/client/Main.java", "w") as f:
    f.write(code)
