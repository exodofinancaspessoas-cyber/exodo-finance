
$PROJECT_REF = "mozbwnrikotnrtrfifqn"
$ACCESS_TOKEN = "sbp_d75f1fa1f0bb50339bead2be39d60591a3a10e8e"

$sql = Get-Content -Path ".\db_fix.sql" -Raw

$headers = @{
    "Authorization" = "Bearer $ACCESS_TOKEN"
    "Content-Type"  = "application/json"
}

# The sql endpoint for Management API is actually not public in the V1 docs 
# but there is a way using pg_net or just through the dashboard.
# I will try to use the 'query' endpoint which is used by the dashboard.
$url = "https://api.supabase.com/v1/projects/$PROJECT_REF/query"
$body = @{
    query = $sql
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    Write-Host "Success: $($response | ConvertTo-Json)"
} catch {
    $err = $_.Exception.Response
    if ($err) {
        $reader = New-Object System.IO.StreamReader($err.GetResponseStream())
        Write-Host "Error: $($reader.ReadToEnd())" -ForegroundColor Red
    } else {
        Write-Error $_
    }
}
