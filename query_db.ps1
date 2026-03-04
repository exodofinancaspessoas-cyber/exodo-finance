
$SUPABASE_URL = "https://mozbwnrikotnrtrfifqn.supabase.co"
$SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vemJ3bnJpa290bnJ0cmZpZnFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc4NDc3NywiZXhwIjoyMDg2MzYwNzc3fQ.EE98F3PFgzrC37ocFJZunXTmIvcqdodLlFHZ75jekU0"

$headers = @{
    "apikey" = $SERVICE_ROLE_KEY
    "Authorization" = "Bearer $SERVICE_ROLE_KEY"
    "Content-Type" = "application/json"
}

Write-Host "Querying admin_users_overview..."
$url = "$SUPABASE_URL/rest/v1/admin_users_overview?select=*"
try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    Write-Host "Found $($response.Count) users in view."
    $response | ConvertTo-Json | Out-File "db_results.json"
} catch {
    Write-Error $_
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $body = $reader.ReadToEnd()
        Write-Host "Error Body: $body"
    }
}
