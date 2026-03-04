$token = "sbp_d75f1fa1f0bb50339bead2be39d60591a3a10e8e"
$projectRef = "mozbwnrikotnrtrfifqn"
$code = Get-Content "supabase\functions\admin-actions\index.ts" -Raw -Encoding UTF8

$payload = [PSCustomObject]@{
    slug       = "admin-actions"
    name       = "admin-actions"
    verify_jwt = $true
    body       = $code
} | ConvertTo-Json -Depth 5 -Compress

$headers = @{
    Authorization  = "Bearer $token"
    "Content-Type" = "application/json"
}

# Try POST (create) first, then PATCH (update) if it already exists
try {
    $result = Invoke-RestMethod -Method POST `
        -Uri "https://api.supabase.com/v1/projects/$projectRef/functions" `
        -Headers $headers `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) `
        -ContentType "application/json; charset=utf-8"
    Write-Host "✅ Function created successfully!" -ForegroundColor Green
    $result | ConvertTo-Json
} catch {
    Write-Host "POST failed, trying PATCH (update existing)..." -ForegroundColor Yellow
    try {
        $result = Invoke-RestMethod -Method PATCH `
            -Uri "https://api.supabase.com/v1/projects/$projectRef/functions/admin-actions" `
            -Headers $headers `
            -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) `
            -ContentType "application/json; charset=utf-8"
        Write-Host "✅ Function updated successfully!" -ForegroundColor Green
        $result | ConvertTo-Json
    } catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
        $_.Exception.Response | ConvertTo-Json
    }
}

# Set secrets via API
Write-Host "`nSetting secrets..." -ForegroundColor Cyan
$secrets = @(
    @{ name = "ADMIN_EMAIL"; value = "exodofinancaspessoas@gmail.com" },
    @{ name = "SUPABASE_SERVICE_ROLE_KEY"; value = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vemJ3bnJpa290bnJ0cmZpZnFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc4NDc3NywiZXhwIjoyMDg2MzYwNzc3fQ.EE98F3PFgzrC37ocFJZunXTmIvcqdodLlFHZ75jekU0" }
) | ConvertTo-Json -Compress

try {
    Invoke-RestMethod -Method POST `
        -Uri "https://api.supabase.com/v1/projects/$projectRef/secrets" `
        -Headers $headers `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($secrets)) `
        -ContentType "application/json; charset=utf-8" | Out-Null
    Write-Host "✅ Secrets configured!" -ForegroundColor Green
} catch {
    Write-Host "❌ Secrets error: $_" -ForegroundColor Red
}
