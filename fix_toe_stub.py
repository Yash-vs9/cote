with open("game-client/src/main/java/com/cote/client/Main.java", "r") as f:
    main_code = f.read()

main_code = main_code.replace("footY + 0.1f", "footY + stepHeight")
main_code = main_code.replace("playerHeight - 0.1f", "playerHeight - stepHeight")

with open("game-client/src/main/java/com/cote/client/Main.java", "w") as f:
    f.write(main_code)
