
$SUPABASE_URL = "https://mozbwnrikotnrtrfifqn.supabase.co"
$SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vemJ3bnJpa290bnJ0cmZpZnFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc4NDc3NywiZXhwIjoyMDg2MzYwNzc3fQ.EE98F3PFgzrC37ocFJZunXTmIvcqdodLlFHZ75jekU0"

$headers = @{
    "apikey" = $SERVICE_ROLE_KEY
    "Authorization" = "Bearer $SERVICE_ROLE_KEY"
    "Content-Type" = "application/json"
}

Write-Host "Checking tables..."
$tables = @("profiles", "subscriptions", "transactions", "accounts")
foreach ($table in $tables) {
    $url = "$SUPABASE_URL/rest/v1/$table?select=count"
    $resp = Invoke-WebRequest -Uri $url -Headers $headers -Method Get -Headers @{ "Prefer" = "count=exact" }
    Write-Host "$table count: $($resp.Headers['Content-Range'])"
}
