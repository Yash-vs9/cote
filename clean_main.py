import re

with open("game-client/src/main/java/com/cote/client/Main.java", "r") as f:
    code = f.read()

# Fix duplicates
code = code.replace("private boolean left = false, right = false, forward = false, backward = false;", "")

# Fix InteractiveDoor / Elevator issues by just calling their methods properly
code = code.replace("d.name.equals(", "d.getName().equals(")
code = code.replace("d.toggle()", "d.interact()")
code = code.replace("e.name.equals(", "e.getName().equals(")
code = code.replace("e.callToFloor(", "e.onInteract(")

# The annotation issue at line 175: we probably pasted initKeys right before @Override public void simpleUpdate.
# Let's clean up @Override if it is duplicated or orphaned.
code = code.replace("@Override\n    private void initKeys()", "private void initKeys()")

with open("game-client/src/main/java/com/cote/client/Main.java", "w") as f:
    f.write(code)
