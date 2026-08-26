import re

with open("game-client/src/main/java/com/cote/client/Main.java", "r") as f:
    code = f.read()

code = code.replace("d.getName().equals(", "d.label.equals(")
code = code.replace("e.getName().equals(", "e.label.equals(")
code = code.replace("e.onInteract(cam.getLocation().y - 1.5f)", "e.interact()")

with open("game-client/src/main/java/com/cote/client/Main.java", "w") as f:
    f.write(code)
