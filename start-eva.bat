@echo off
setlocal
cd /d "%~dp0backend"

echo Building Eva Mobile API...
call mvn -q -DskipTests package
if errorlevel 1 (
    echo.
    echo Build failed. Check the Maven output above.
    pause
    exit /b 1
)

echo.
echo Starting Eva Mobile on http://localhost:8080
start "Eva Mobile API" cmd /k java -jar target\eva-mobile-api-1.0.0.jar
timeout /t 8 >nul
start "" http://localhost:8080
endlocal
