
$PROJECT_REF = "mozbwnrikotnrtrfifqn"
$ACCESS_TOKEN = "sbp_d75f1fa1f0bb50339bead2be39d60591a3a10e8e"

$headers = @{
    "Authorization" = "Bearer $ACCESS_TOKEN"
    "Content-Type"  = "application/json"
}

Write-Host "Counting total users in Auth..."
$url = "https://api.supabase.com/v1/projects/$PROJECT_REF/users"
try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    Write-Host "Total users in Auth: $($response.Count)"
    $response | Select-Object id, email | ConvertTo-Json | Out-File "auth_users.json"
} catch {
    Write-Error $_
}
