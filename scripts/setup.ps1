# Windows PowerShell helper: install, build and print the config snippets.
# Run from the project folder:   .\scripts\setup.ps1
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
node -v
npm install
npm run build
node dist\index.js print-config
