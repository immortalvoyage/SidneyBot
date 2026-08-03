$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "SidneyBot local Discord setup" -ForegroundColor Cyan
Write-Host "This tool writes local secrets to .dev.vars. The file is ignored by Git." -ForegroundColor DarkGray
Write-Host ""

$applicationId = Read-Host "Discord Application ID"
if ([string]::IsNullOrWhiteSpace($applicationId)) {
  throw "Discord Application ID is required."
}

$guildId = Read-Host "Discord Server/Guild ID (recommended for instant command updates; press Enter to skip)"

$secureToken = Read-Host "Discord Bot Token" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
  $botToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

if ([string]::IsNullOrWhiteSpace($botToken)) {
  throw "Discord Bot Token is required."
}

$lines = @(
  "# SidneyBot local development secrets"
  "# This file is ignored by Git. Do not upload it."
  "DISCORD_APPLICATION_ID=$applicationId"
  "DISCORD_BOT_TOKEN=$botToken"
)

if (-not [string]::IsNullOrWhiteSpace($guildId)) {
  $lines += "DISCORD_GUILD_ID=$guildId"
}

$lines | Set-Content -Path ".dev.vars" -Encoding UTF8

Write-Host ""
Write-Host "OK: .dev.vars created." -ForegroundColor Green
Write-Host "Next command: npm run register" -ForegroundColor Yellow
