# Panelverse — first-time GitHub publish (Windows PowerShell)
# Run from the extracted panelverse-manhwa folder. Requires Git and GitHub authentication.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$remote = 'https://github.com/rithymeth/panelverse-manhwa.git'

function Check-GitExit([string]$task) {
  if ($LASTEXITCODE -ne 0) { throw "$task failed (exit code $LASTEXITCODE). Check the error above." }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'Git is not installed. Install Git from https://git-scm.com/downloads and rerun this script.'
}
if (-not (Test-Path .git)) { git init; Check-GitExit 'git init' }
git branch -M main
Check-GitExit 'Set branch main'

# Stage the actual application, not just README.md.
git add -A
Check-GitExit 'git add'
git diff --cached --quiet
if ($LASTEXITCODE -eq 1) {
  git commit -m 'Build Panelverse manhwa publishing and reading website'
  Check-GitExit 'git commit'
} elseif ($LASTEXITCODE -ne 0) {
  throw 'Could not inspect staged files.'
} else {
  Write-Host 'No uncommitted changes; reusing the existing commit.'
}

$origin = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
  git remote add origin $remote
  Check-GitExit 'Add origin'
} elseif ($origin.Trim() -ne $remote) {
  throw "Existing origin points to '$origin'. Expected '$remote'. Refusing to overwrite it."
}

git push -u origin main
Check-GitExit 'git push'
Write-Host "Published successfully: https://github.com/rithymeth/panelverse-manhwa" -ForegroundColor Green
