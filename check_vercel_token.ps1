$headers = @{
    Authorization  = "Bearer sbp_d75f1fa1f0bb50339bead2be39d60591a3a10e8e"
    "Content-Type" = "application/json"
}

# Get Vercel token from local config
$vercelConfig = Get-Content "$env:APPDATA\Vercel\auth.json" -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json
if (-not $vercelConfig) {
    $vercelConfig = Get-Content "$env:USERPROFILE\.vercel\auth.json" -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json
}

Write-Host "Vercel config found: $($null -ne $vercelConfig)"
if ($vercelConfig) {
    Write-Host "Token: $($vercelConfig.token.Substring(0,10))..."
}
