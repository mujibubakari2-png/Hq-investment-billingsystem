#!/usr/bin/env pwsh
# ============================================================
# GitHub Actions Secrets Setup Script
# Repo: mujibubakari2-png/Hq-investment-billingsystem
# Run: .\set-github-secrets.ps1
# Requires: gh CLI + gh auth login
# ============================================================

$REPO = "mujibubakari2-png/Hq-investment-billingsystem"

Write-Host ""
Write-Host "GitHub Actions Secrets Setup" -ForegroundColor Cyan
Write-Host "Repo: $REPO" -ForegroundColor Cyan
Write-Host ""

# ── Generate CI-only secrets ──────────────────────────────────
Write-Host "Generating secure random values..." -ForegroundColor Yellow

$CI_JWT_ACCESS_SECRET    = node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))"
$CI_JWT_REFRESH_SECRET   = node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))"
$CI_JWT_SECRET           = node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
$CI_FIELD_ENCRYPTION_KEY = node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
$CI_CRON_SECRET          = node -e "process.stdout.write(require('crypto').randomBytes(16).toString('hex'))"

# ── Get Droplet info from user ────────────────────────────────
Write-Host ""
Write-Host "Droplet / VPS info needed:" -ForegroundColor Yellow
$DROPLET_HOST = Read-Host "  DROPLET_HOST (IP address, e.g. 164.92.x.x)"
$DROPLET_USER = Read-Host "  DROPLET_USER (SSH username, usually 'root')"
$SSH_KEY_PATH = Read-Host "  Path to SSH private key (e.g. C:\Users\hqbak\.ssh\id_rsa)"

if (-not (Test-Path $SSH_KEY_PATH)) {
    Write-Host "ERROR: SSH key file not found at $SSH_KEY_PATH" -ForegroundColor Red
    exit 1
}
$DROPLET_SSH_KEY = Get-Content $SSH_KEY_PATH -Raw

# ── Set all secrets ───────────────────────────────────────────
Write-Host ""
Write-Host "Setting secrets on GitHub..." -ForegroundColor Yellow

$secrets = @{
    "CI_JWT_ACCESS_SECRET"    = $CI_JWT_ACCESS_SECRET
    "CI_JWT_REFRESH_SECRET"   = $CI_JWT_REFRESH_SECRET
    "CI_JWT_SECRET"           = $CI_JWT_SECRET
    "CI_FIELD_ENCRYPTION_KEY" = $CI_FIELD_ENCRYPTION_KEY
    "CI_CRON_SECRET"          = $CI_CRON_SECRET
    "DROPLET_HOST"            = $DROPLET_HOST
    "DROPLET_USER"            = $DROPLET_USER
    "DROPLET_SSH_KEY"         = $DROPLET_SSH_KEY
}

$success = 0
$failed  = 0

foreach ($name in $secrets.Keys) {
    $value = $secrets[$name]
    $value | gh secret set $name --repo $REPO 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  SET $name" -ForegroundColor Green
        $success++
    } else {
        Write-Host "  FAILED $name" -ForegroundColor Red
        $failed++
    }
}

# ── Summary ───────────────────────────────────────────────────
Write-Host ""
Write-Host "Done: $success secrets set, $failed failed" -ForegroundColor $(if($failed -eq 0){"Green"}else{"Red"})

if ($failed -eq 0) {
    Write-Host ""
    Write-Host "All secrets configured! The CI pipeline is now ready." -ForegroundColor Green
    Write-Host "Push to 'main' to trigger: lint -> test -> build -> deploy" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Verify at: https://github.com/$REPO/settings/secrets/actions" -ForegroundColor Cyan
}
