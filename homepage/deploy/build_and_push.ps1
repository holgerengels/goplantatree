$ErrorActionPreference = "Stop"

$IMAGE_NAME = "ghcr.io/holgerengels/goplantatree"
$TAG = "latest"

# Change directory to the root directory (one level up from deploy folder)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $ScriptDir "..")

Write-Host "Building docker image..." -ForegroundColor Cyan
docker build -f deploy/app.docker -t "${IMAGE_NAME}:${TAG}" .

Write-Host "Pushing to registry..." -ForegroundColor Cyan
docker push "${IMAGE_NAME}:${TAG}"

Write-Host "Done." -ForegroundColor Green
