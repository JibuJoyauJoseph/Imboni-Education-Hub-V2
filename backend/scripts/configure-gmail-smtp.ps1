$ErrorActionPreference = 'Stop'

$envPath = Join-Path $PSScriptRoot '..\.env'
if (-not (Test-Path -LiteralPath $envPath)) {
  throw 'backend/.env was not found. Create it from .env.example and configure DB/JWT settings first.'
}

$secureAppPassword = Read-Host 'Enter the 16-character Google App Password (input is hidden)' -AsSecureString
$credential = New-Object System.Management.Automation.PSCredential('gmail', $secureAppPassword)
$appPassword = $credential.GetNetworkCredential().Password -replace '\s', ''
if ($appPassword.Length -lt 16) {
  $secureAppPassword.Dispose()
  throw 'The App Password looks too short. Generate a Google App Password and run this script again.'
}

$settings = [ordered]@{
  EMAIL_HOST = 'smtp.gmail.com'
  EMAIL_PORT = '587'
  EMAIL_SECURE = 'false'
  EMAIL_REQUIRE_TLS = 'true'
  EMAIL_USER = 'imbonieducation@gmail.com'
  EMAIL_PASS = $appPassword
  EMAIL_FROM = 'imbonieducation@gmail.com'
  EMAIL_FROM_NAME = 'IMBONI Education Hub'
  EMAIL_ALLOW_UNAUTHENTICATED = 'false'
  EMAIL_MAX_ATTEMPTS = '3'
  EMAIL_CONCURRENCY = '5'
  EMAIL_CRON_TIMEZONE = 'UTC'
}

$lines = [System.Collections.Generic.List[string]]::new()
foreach ($line in [System.IO.File]::ReadAllLines($envPath)) {
  $lines.Add($line)
}

foreach ($key in $settings.Keys) {
  $pattern = '^\s*' + [regex]::Escape($key) + '\s*='
  $replacement = "$key=$($settings[$key])"
  $found = $false
  for ($index = $lines.Count - 1; $index -ge 0; $index -= 1) {
    if ($lines[$index] -match $pattern) {
      if (-not $found) {
        $lines[$index] = $replacement
        $found = $true
      } else {
        $lines.RemoveAt($index)
      }
    }
  }
  if (-not $found) {
    $lines.Add($replacement)
  }
}

$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines($envPath, $lines.ToArray(), $utf8WithoutBom)
$secureAppPassword.Dispose()
$appPassword = $null
$credential = $null

Write-Host 'Gmail SMTP settings saved to backend/.env. Secret values were not displayed.'