import re

with open("game-client/src/main/java/com/cote/client/Main.java", "r") as f:
    main_code = f.read()

# Remove the duplicate initKeys() and old actionListener block
main_code = re.sub(r'private void initKeys\(\).*?(?=private void initCrossHairs\(\))', '', main_code, flags=re.DOTALL)

with open("game-client/src/main/java/com/cote/client/Main.java", "w") as f:
    f.write(main_code)
