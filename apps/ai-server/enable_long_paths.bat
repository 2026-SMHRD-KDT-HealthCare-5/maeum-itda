@echo off
REM Right-click this file and choose "Run as administrator".
REM Enables Windows long path support (260-char limit) needed for packages like torch.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Administrator rights required. Close this window, then right-click this file and choose "Run as administrator".
    pause
    exit /b 1
)

reg add "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f

if %errorLevel% equ 0 (
    echo Done: Long path support is now enabled ^(LongPathsEnabled=1^).
    echo Now open a new terminal, activate the venv, and run "pip install -r requirements.txt" again.
) else (
    echo Failed to set the registry value.
)

pause
