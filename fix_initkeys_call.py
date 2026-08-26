with open("game-client/src/main/java/com/cote/client/Main.java", "r") as f:
    main_code = f.read()

main_code = main_code.replace("initKeys();", "")

with open("game-client/src/main/java/com/cote/client/Main.java", "w") as f:
    f.write(main_code)
