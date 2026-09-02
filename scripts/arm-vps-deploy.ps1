param(
  [string]$Repository = 'YesterdaysLemon/alirezas-galaxy',
  [string]$SshHost = 'alirezaafshan.com',
  [string]$VpsAddress = '107.172.137.190'
)

$ErrorActionPreference = 'Stop'

& gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
  throw 'GitHub CLI is not authenticated.'
}

$sshArgs = @(
  '-o', 'BatchMode=yes',
  '-o', "HostName=$VpsAddress",
  '-o', "HostKeyAlias=$SshHost",
  $SshHost
)

Write-Host 'Transferring the webhook secret directly from the VPS to GitHub...'
& ssh @sshArgs 'cat ~/.galaxy-menu-webhook-secret' |
  gh secret set DEPLOY_WEBHOOK_SECRET --repo $Repository
if ($LASTEXITCODE -ne 0) {
  throw 'The secret handoff failed; automatic deploys remain disabled.'
}

& ssh @sshArgs 'shred -u ~/.galaxy-menu-webhook-secret'
if ($LASTEXITCODE -ne 0) {
  throw 'GitHub received the secret, but the VPS handoff file was not removed.'
}

& gh variable set DEPLOY_ENABLED --body true --repo $Repository
if ($LASTEXITCODE -ne 0) {
  throw 'The webhook secret is installed, but DEPLOY_ENABLED was not armed.'
}

Write-Host 'Automatic VPS deployments are armed.'
