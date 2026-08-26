import re

with open("game-client/src/main/java/com/cote/client/CampusBuilder.java", "r") as f:
    code = f.read()

new_res = """
    private void buildResidentialSector() {
        DormitoryBuilder b = new DormitoryBuilder(assetManager, rootNode);
        b.build();
    }
"""

code = re.sub(r'private void buildResidentialSector\(\) \{.*?addCollider\(-34 \+ 10, 10f, 58 - 14, 8, 20f, 1\);\n    \}', new_res.strip(), code, flags=re.DOTALL)

with open("game-client/src/main/java/com/cote/client/CampusBuilder.java", "w") as f:
    f.write(code)
