@echo off
REM OctaDezx Modernization - Installation Script (Windows)
REM This script installs the required dependencies for the new features

echo ========================================
echo  OctaDezx Modernization Installation
echo ========================================
echo.

cd /d D:\Octadezx\OctaDezx\OctaDezx

echo Installing recharts for advanced analytics...
call npm install recharts

echo.
echo ========================================
echo  Installation Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Run 'npm run dev' to test locally
echo 2. Check the landing page at http://localhost:5173
echo 3. Test analytics dashboard after login
echo.
echo Read OCTADEZX_MODERNIZATION_GUIDE.md for full documentation
echo.
pause
