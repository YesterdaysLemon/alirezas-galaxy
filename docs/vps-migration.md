# VPS migration runbook

The VPS deployment is the production source of truth. The portfolio runs on
loopback port `3000`; the galaxy uses `3070`, with `3071` reserved for
deploy-manager candidates. Caddy routes the public hostnames to those origins,
and its pre-cutover backup remains available for emergency routing rollback.

## Audited live topology

| Host | Destination |
| --- | --- |
| `alirezaafshan.com`, `www` | galaxy on `127.0.0.1:3070` |
| `portfolio.alirezaafshan.com` | portfolio on `127.0.0.1:3000` |
| `fish` through `androidhell` | independent apps on `3010`–`3060` |
| `deploy` | central signed deploy manager on `9019` |
| galaxy candidate | `127.0.0.1:3071` during deployments |

## 1. DNS staged without changing existing traffic

The following Cloudflare record was added on 2026-09-02:

```text
Type: A
Name: portfolio
IPv4: 107.172.137.190
Proxy: DNS only initially
TTL: Auto
```

This creates the new hostname but does not alter the apex or `www` records.
After Caddy has issued the certificate and verification passes, the record can
be proxied if desired.

## 2. Stage and deploy the galaxy without public cutover

From this repository on the workstation:

```powershell
scp -o HostName=107.172.137.190 -o HostKeyAlias=alirezaafshan.com `
  scripts/vps-migrate.sh alirezaafshan.com:~/vps-migrate.sh

ssh -o HostName=107.172.137.190 -o HostKeyAlias=alirezaafshan.com `
  alirezaafshan.com 'chmod 700 ~/vps-migrate.sh'

ssh -t -o HostName=107.172.137.190 -o HostKeyAlias=alirezaafshan.com `
  alirezaafshan.com 'sudo bash ~/vps-migrate.sh preflight'

ssh -t -o HostName=107.172.137.190 -o HostKeyAlias=alirezaafshan.com `
  alirezaafshan.com 'sudo bash ~/vps-migrate.sh install'

ssh -t -o HostName=107.172.137.190 -o HostKeyAlias=alirezaafshan.com `
  alirezaafshan.com 'sudo bash ~/vps-migrate.sh deploy'
```

At this point the deploy manager has built, candidate-tested, and promoted the
galaxy on loopback port `3070`, while every public hostname still serves its
original app.

## 3. Atomic hostname cutover

Only after the previous stages and the `portfolio` DNS record are healthy:

```powershell
ssh -t -o HostName=107.172.137.190 -o HostKeyAlias=alirezaafshan.com `
  alirezaafshan.com 'sudo bash ~/vps-migrate.sh cutover'

ssh -t -o HostName=107.172.137.190 -o HostKeyAlias=alirezaafshan.com `
  alirezaafshan.com 'sudo bash ~/vps-migrate.sh verify'
```

The cutover backs up the exact Caddyfile, rewrites only the audited root block,
validates the new config before reload, and automatically restores the old
routing if either local hostname check fails.

Emergency routing rollback:

```powershell
ssh -t -o HostName=107.172.137.190 -o HostKeyAlias=alirezaafshan.com `
  alirezaafshan.com 'sudo bash ~/vps-migrate.sh rollback'
```

Rollback returns the portfolio to the apex immediately. It intentionally keeps
the galaxy container and deploy registration so the problem can be inspected
without another image build.

## 4. Arm continuous deployment

After the manual deployment and hostname verification succeed:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/arm-vps-deploy.ps1
```

The script pipes the generated webhook secret directly from the VPS into the
GitHub repository secret, removes the handoff file, and only then enables the
`DEPLOY_ENABLED` repository variable. Future pushes to `main` invoke the signed
deploy-manager endpoint after the container build succeeds.

To freeze automatic deployments without changing the running containers:

```powershell
gh variable set DEPLOY_ENABLED --body false --repo YesterdaysLemon/alirezas-galaxy
```
