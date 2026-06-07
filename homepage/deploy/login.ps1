$ErrorActionPreference = "Stop"

Write-Host "Please generate a Personal Access Token (PAT) with 'write:packages' scope." -ForegroundColor Yellow
Write-Host "https://github.com/settings/tokens/new?scopes=write:packages,read:packages,delete:packages" -ForegroundColor Yellow
Write-Host ""

$CR_PAT = Read-Host -MaskInput "Enter your PAT"

$GB_USER = Read-Host "Enter your GitHub Username (default: holgerengels)"
if ([string]::IsNullOrWhiteSpace($GB_USER)) {
    $GB_USER = "holgerengels"
}

$CR_PAT | docker login ghcr.io -u $GB_USER --password-stdin
