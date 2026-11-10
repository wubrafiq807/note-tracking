$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$releaseDirectory = Join-Path $projectRoot 'release'
New-Item -ItemType Directory -Force -Path $releaseDirectory | Out-Null
$archivePath = Join-Path $releaseDirectory 'secure-notes.tar.gz'
$releaseFiles = @(
    'backend/package.json', 'backend/package-lock.json', 'backend/tsconfig.json',
    'backend/src', 'backend/scripts', 'backend/test',
    'frontend/package.json', 'frontend/package-lock.json', 'frontend/tsconfig.json',
    'frontend/vite.config.ts', 'frontend/index.html', 'frontend/src',
    'frontend/.env.production', 'deploy/backend.env.example',
    'deploy/secure-notes.service', 'deploy/nginx-ip.conf'
)
& tar -czf $archivePath -C $projectRoot @releaseFiles
if ($LASTEXITCODE -ne 0) { throw 'Release archive creation failed' }
Write-Output "Created $archivePath (local .env files and installed dependencies excluded)."
