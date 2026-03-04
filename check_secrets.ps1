
$PROJECT_REF = "mozbwnrikotnrtrfifqn"
$ACCESS_TOKEN = "sbp_d75f1fa1f0bb50339bead2be39d60591a3a10e8e"

$headers = @{
    "Authorization" = "Bearer $ACCESS_TOKEN"
    "Content-Type"  = "application/json"
}

Write-Host "Checking secrets..."
$url = "https://api.supabase.com/v1/projects/$PROJECT_REF/secrets"
try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    $response | ConvertTo-Json | Out-File "secrets.json"
    Write-Host "Secrets checked."
} catch {
    Write-Error $_
}
