# Builds the production release package: dist/ANHS-Java-Edition-v<version>/
# Output contains only runtime artifacts (jars, launchers, docs) - no sources.
param(
    [string]$Version = "1.1.0"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "=== Building release v$Version ===" -ForegroundColor Cyan
mvn -q clean package -DskipTests
if ($LASTEXITCODE -ne 0) { Write-Error "Maven build failed"; exit 1 }

mvn -q dependency:copy-dependencies "-DoutputDirectory=target/release/lib" -DincludeScope=runtime
if ($LASTEXITCODE -ne 0) { Write-Error "Dependency copy failed"; exit 1 }

$name = "ANHS-Java-Edition-v$Version"
$dist = "dist\$name"
Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force "$dist\lib" | Out-Null

Copy-Item "target\game-client-$Version-SNAPSHOT.jar" "$dist\lib\anhs-game.jar"
Copy-Item "target\release\lib\*" "$dist\lib\" -Force

@'
@echo off
title Advanced Nurturing High School - Java Edition
cd /d "%~dp0"
where java >nul 2>nul
if errorlevel 1 (
    echo Java 17+ is required. Install from https://adoptium.net
    pause
    exit /b 1
)
java -XX:+UseG1GC -Xms256m -Xmx2g -cp "lib\*" com.cote.client.Main
'@ | Set-Content "$dist\Play-Windows.bat" -Encoding ASCII

@'
#!/usr/bin/env bash
cd "$(dirname "$0")"
command -v java >/dev/null 2>&1 || { echo "Java 17+ is required."; exit 1; }
java -XX:+UseG1GC -Xms256m -Xmx2g -cp "lib/*" com.cote.client.Main
'@ | Set-Content "$dist\play-linux-mac.sh" -Encoding ASCII

@"
Version:      $Version
Build:        release
Platforms:    Windows / Linux / macOS (Java 17 or newer)

HOW TO PLAY
  Windows : double-click Play-Windows.bat
  Linux   : ./play-linux-mac.sh
  macOS   : bash play-linux-mac.sh

FILES THE GAME WRITES NEXT TO ITSELF
  save1.dat..save3.dat   your game save slots (auto + manual)
  settings.properties    your settings
  logs\game.log          diagnostics (warnings/errors only)
  sfx_cache\*.wav        generated sound effects (safe to delete; they regenerate)
"@ | Set-Content "$dist\README.txt" -Encoding ASCII

Compress-Archive -Path $dist -DestinationPath "dist\$name.zip" -Force
Write-Host "=== Packaged: dist\$name.zip ===" -ForegroundColor Green
Get-ChildItem "$dist" | Select-Object Name
