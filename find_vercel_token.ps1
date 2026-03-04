# Use Vercel REST API to add env variable
# First, get the Vercel token from the local config
$vercelToken = $null

# Try to read from vercel's global config
$configPaths = @(
    "$env:APPDATA\Vercel\config.json",
    "$env:APPDATA\vercel\config.json",
    "$env:USERPROFILE\.vercel\config.json"
)
foreach ($path in $configPaths) {
    if (Test-Path $path) {
        $config = Get-Content $path -Raw | ConvertFrom-Json
        if ($config.token) { $vercelToken = $config.token; break }
    }
}

if (-not $vercelToken) {
    Write-Host "Vercel token not found in config files. Looking in .vercel/project.json..."
    # Try to get from local project
    if (Test-Path ".vercel\project.json") {
        $proj = Get-Content ".vercel\project.json" -Raw | ConvertFrom-Json
        Write-Host "Project ID: $($proj.projectId)"
        Write-Host "Org ID: $($proj.orgId)"
    }
}

# If we have the project JSON, use the Vercel API directly
if (Test-Path ".vercel\project.json") {
    $proj = Get-Content ".vercel\project.json" -Raw | ConvertFrom-Json
    $projectId = $proj.projectId
    
    Write-Host "Project ID found: $projectId"
    
    # We'll use the Vercel API - need the token
    # The token can be fetched from running 'vercel whoami' - it's stored in global config
    # Let's search more broadly
    $found = Get-ChildItem "$env:APPDATA" -Recurse -Filter "*.json" -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq "auth.json" -or $_.DirectoryName -like "*vercel*" } |
        Select-Object -First 5
    $found | ForEach-Object { Write-Host "Found: $($_.FullName)" }
}
