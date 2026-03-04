
$PROJECT_REF = "mozbwnrikotnrtrfifqn"
$ACCESS_TOKEN = "sbp_d75f1fa1f0bb50339bead2be39d60591a3a10e8e"
$FUNCTION_SLUG = "admin-actions"

$headers = @{
    "Authorization" = "Bearer $ACCESS_TOKEN"
    "Content-Type"  = "application/json"
}

Write-Host "Fetching logs for function $FUNCTION_SLUG..."
$url = "https://api.supabase.com/v1/projects/$PROJECT_REF/functions/$FUNCTION_SLUG"
try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    Write-Host "Function Status: $($response.status)"
    
    # Get general logs for the project service 'edge-function'
    $logsUrl = "https://api.supabase.com/v1/projects/$PROJECT_REF/functions/$FUNCTION_SLUG/logs"
    $logsResponse = Invoke-RestMethod -Uri $logsUrl -Headers $headers -Method Get
    $logsResponse | ConvertTo-Json -Depth 10 | Out-File "function_logs.json"
    Write-Host "Logs saved to function_logs.json"
} catch {
    Write-Error $_
}
