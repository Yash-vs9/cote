@echo off
echo ===================================================
echo Compiling COTE Java Simulation Engine...
echo ===================================================

if not exist "bin" mkdir bin

javac -d bin src/com/cote/simulation/*.java

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Compilation failed. Please make sure JDK is installed and javac is in your PATH.
    pause
    exit /b %ERRORLEVEL%
)

echo [SUCCESS] Compilation successful!
echo Starting Simulation Server on http://localhost:8080 ...
java -cp bin com.cote.simulation.SimulationServer 8080
pause
