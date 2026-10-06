#!/usr/bin/env bash
# Builds the production release package: dist/ANHS-Java-Edition-v1.1.0/
set -e
cd "$(dirname "$0")/.."
VERSION="1.1.0"

echo "=== Building release v$VERSION ==="
mvn -q clean package -DskipTests
mvn -q dependency:copy-dependencies -DoutputDirectory=target/release/lib -DincludeScope=runtime

NAME="ANHS-Java-Edition-v$VERSION"
DIST="dist/$NAME"
rm -rf dist
mkdir -p "$DIST/lib"

cp "target/game-client-$VERSION-SNAPSHOT.jar" "$DIST/lib/anhs-game.jar"
cp target/release/lib/* "$DIST/lib/"

cat > "$DIST/play-linux-mac.sh" <<'EOF'
#!/usr/bin/env bash
cd "$(dirname "$0")"
command -v java >/dev/null 2>&1 || { echo "Java 17+ is required."; exit 1; }
java -XX:+UseG1GC -Xms256m -Xmx2g -cp "lib/*" com.cote.client.Main
EOF
chmod +x "$DIST/play-linux-mac.sh"

printf 'Version: 1.1.0 (release)\nPlatforms: Windows / Linux / macOS (Java 17+)\n\nRun: bash play-linux-mac.sh   (Windows: Play-Windows.bat)\n' > "$DIST/README.txt"

(cd dist && zip -qr "$NAME.zip" "$NAME")
echo "=== Packaged: $DIST ==="
