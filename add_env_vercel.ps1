$auth = Get-Content "$env:APPDATA\com.vercel.cli\Data\auth.json" -Raw | ConvertFrom-Json
$vercelToken = $auth.token
$projectId = "prj_C7PBy1iqqtBPecutz3HobZztgn6s"
$teamId = "team_HIX66PEj3bLQOYXUccNn1jCz"

$headers = @{
    Authorization  = "Bearer $vercelToken"
    "Content-Type" = "application/json"
}

# Try with different API format
$body = '[{"key":"VITE_ADMIN_EMAIL","value":"exodofinancaspessoas@gmail.com","type":"plain","target":["production","preview","development"]}]'

try {
    $result = Invoke-RestMethod `
        -Method POST `
        -Uri "https://api.vercel.com/v10/projects/$projectId/env?teamId=$teamId&upsert=true" `
        -Headers $headers `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) `
        -ContentType "application/json; charset=utf-8"
    Write-Host "Added successfully!" -ForegroundColor Green
    $result | ConvertTo-Json -Depth 3
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
    try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Error body: $($reader.ReadToEnd())" -ForegroundColor Red
    } catch {
        Write-Host "Raw error: $_" -ForegroundColor Red
    }
}
