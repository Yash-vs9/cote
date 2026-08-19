#!/bin/bash
echo "==================================================="
echo "Compiling COTE Java Simulation Engine..."
echo "==================================================="

mkdir -p bin
javac -d bin src/com/cote/simulation/*.java

if [ $? -ne 0 ]; then
    echo "[ERROR] Compilation failed."
    exit 1
fi

echo "[SUCCESS] Compilation successful!"
echo "Starting Simulation Server on http://localhost:8080 ..."
java -cp bin com.cote.simulation.SimulationServer 8080
