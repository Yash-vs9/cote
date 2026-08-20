#!/bin/bash
echo "==================================================="
echo "Compiling COTE Java Simulation Engine (Maven)..."
echo "==================================================="

# Check if Maven is installed
if command -v mvn &> /dev/null; then
    echo "Using Maven for build..."
    mvn clean compile
    if [ $? -ne 0 ]; then
        echo "[ERROR] Maven compilation failed."
        exit 1
    fi
    echo "[SUCCESS] Maven compilation successful!"
    echo "Starting Simulation Server on http://localhost:8080 ..."
    mvn exec:java
else
    echo "Maven not found. Falling back to javac (legacy)..."
    mkdir -p bin
    javac -d bin src/main/java/com/cote/simulation/*.java

    if [ $? -ne 0 ]; then
        echo "[ERROR] Compilation failed."
        exit 1
    fi

    echo "[SUCCESS] Compilation successful!"
    echo "Starting Simulation Server on http://localhost:8080 ..."
    java -cp bin com.cote.simulation.SimulationServer 8080
fi
