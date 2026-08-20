@echo off
echo ===================================================
echo Compiling COTE Java Simulation Engine (Maven)...
echo ===================================================

where mvn >nul 2>nul
if %errorlevel% equ 0 (
    echo Using Maven for build...
    call mvn clean compile
    if %errorlevel% neq 0 (
        echo [ERROR] Maven compilation failed.
        pause
        exit /b %errorlevel%
    )
    echo [SUCCESS] Maven compilation successful!
    echo Starting Simulation Server on http://localhost:8080 ...
    call mvn exec:java
) else (
    echo Maven not found. Falling back to javac ^(legacy^)...
    if not exist "bin" mkdir bin
    javac -d bin src\main\java\com\cote\simulation\*.java
    if %errorlevel% neq 0 (
        echo [ERROR] Compilation failed. Please make sure JDK is installed and javac is in your PATH.
        pause
        exit /b %errorlevel%
    )
    echo [SUCCESS] Compilation successful!
    echo Starting Simulation Server on http://localhost:8080 ...
    java -cp bin com.cote.simulation.SimulationServer 8080
    pause
)
