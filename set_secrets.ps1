$token = "sbp_d75f1fa1f0bb50339bead2be39d60591a3a10e8e"
$projectRef = "mozbwnrikotnrtrfifqn"

$secrets = '[{"name":"ADMIN_EMAIL","value":"exodofinancaspessoas@gmail.com"},{"name":"SERVICE_ROLE_KEY","value":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vemJ3bnJpa290bnJ0cmZpZnFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc4NDc3NywiZXhwIjoyMDg2MzYwNzc3fQ.EE98F3PFgzrC37ocFJZunXTmIvcqdodLlFHZ75jekU0"}]'

$headers = @{
    Authorization  = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    $result = Invoke-RestMethod `
        -Method POST `
        -Uri "https://api.supabase.com/v1/projects/$projectRef/secrets" `
        -Headers $headers `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($secrets)) `
        -ContentType "application/json; charset=utf-8"
    Write-Host "Secrets configured successfully!" -ForegroundColor Green
} catch {
    $err = $_.Exception.Response
    $reader = New-Object System.IO.StreamReader($err.GetResponseStream())
    Write-Host "Error: $($reader.ReadToEnd())" -ForegroundColor Red
}
