@echo off
setlocal
cd /d "%~dp0"
set "ASKLEARN_PUBLISH_CHECK="
set "ASKLEARN_PUBLISH_STEP=checking repository settings"
if /i "%~1"=="--check" set "ASKLEARN_PUBLISH_CHECK=1"
if not "%~1"=="" if not defined ASKLEARN_PUBLISH_CHECK (
  echo Usage: "Publish ASKLearn.cmd" [--check]
  exit /b 2
)

if defined ASKLEARN_PUBLISH_CHECK (
  echo Checking ASKLearn publishing settings.
) else (
  echo Publishing ASKLearn source to midddddiana24/ASKLEARN.
)
echo Secrets, databases, uploads, and installed dependencies are excluded by .gitignore.

git --version >nul 2>&1
if errorlevel 1 goto no_git
if not exist ".git" (
  if defined ASKLEARN_PUBLISH_CHECK (
    echo Repository has not been initialized. No files were changed.
    exit /b 1
  )
  git init -b main
  if errorlevel 1 goto failed
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  if defined ASKLEARN_PUBLISH_CHECK (
    echo Origin is not configured. No files were changed.
    exit /b 1
  )
  git remote add origin https://github.com/midddddiana24/ASKLEARN.git
  if errorlevel 1 goto failed
)

rem Read Git's LF-terminated output without FINDSTR's exact-line matching.
set "ASKLEARN_PUBLISH_ORIGIN="
for /f "delims=" %%R in ('git remote get-url origin 2^>nul') do set "ASKLEARN_PUBLISH_ORIGIN=%%R"
if /i not "%ASKLEARN_PUBLISH_ORIGIN%"=="https://github.com/midddddiana24/ASKLEARN.git" (
  echo Origin points to a different repository. No files were published.
  goto failed
)

set "ASKLEARN_PUBLISH_BRANCH="
for /f "delims=" %%B in ('git branch --show-current 2^>nul') do set "ASKLEARN_PUBLISH_BRANCH=%%B"
if not "%ASKLEARN_PUBLISH_BRANCH%"=="main" (
  echo Switch to the intended main branch before publishing. No branch was changed.
  goto failed
)

if defined ASKLEARN_PUBLISH_CHECK (
  echo Repository URL and main branch checks passed. No files were changed or uploaded.
  exit /b 0
)

set "ASKLEARN_PUBLISH_STEP=fetching GitHub history"
echo Step 1 of 5: Fetching GitHub history.
git fetch origin
if errorlevel 1 goto failed

set "ASKLEARN_PUBLISH_STEP=staging source files"
echo Step 2 of 5: Staging source files.
git add -- .github .gitignore .dockerignore Dockerfile render.yaml ASKLearn_Build_Guide.md ASKLearn_MASTER_PROMPT.md README.md "Start ASKLearn.cmd" "Publish ASKLearn.cmd" backend docs frontend
if errorlevel 1 goto failed

set "ASKLEARN_PUBLISH_STEP=checking staged files"
echo Step 3 of 5: Checking staged files.
git diff --cached --check
if errorlevel 1 goto failed

set "ASKLEARN_PUBLISH_STEP=creating the source commit"
echo Step 4 of 5: Creating the source commit.
git diff --cached --quiet
if errorlevel 2 goto failed
if errorlevel 1 (
  git commit -m "Build ASKLearn student learning workspace"
  if errorlevel 1 goto failed
)

set "ASKLEARN_PUBLISH_STEP=uploading to GitHub"
echo Step 5 of 5: Uploading to GitHub.
git push -u origin main
if errorlevel 1 goto failed

echo.
echo Published successfully: https://github.com/midddddiana24/ASKLEARN
git log -1 --oneline
pause
exit /b 0
:no_git
echo Install Git for Windows first, then run this script again.
if defined ASKLEARN_PUBLISH_CHECK exit /b 1
pause
exit /b 1
:failed
echo.
echo Publishing stopped while %ASKLEARN_PUBLISH_STEP%. Read the Git error above.
echo If authentication is required, sign in with Git Credential Manager.
echo If the remote has new commits, integrate that history before retrying.
echo This script never force-pushes or rewrites remote history.
if defined ASKLEARN_PUBLISH_CHECK exit /b 1
pause
exit /b 1
