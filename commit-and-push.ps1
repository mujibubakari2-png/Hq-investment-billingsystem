# ─────────────────────────────────────────────────────────────────────────────
# HQInvestment ISP — Commit & Push Script (PowerShell)
# Run this from the project root:  .\commit-and-push.ps1
# ─────────────────────────────────────────────────────────────────────────────

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  HQInvestment ISP — Git Commit & Push" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Show what changed
Write-Host "📋 Changed files:" -ForegroundColor Yellow
git status --short
Write-Host ""

# Stage all changes
Write-Host "📦 Staging all changes..." -ForegroundColor Yellow
git add -A

# Commit
$msg = "fix: add FreeRADIUS setup script and RADIUS health endpoint to resolve MikroTik RADIUS server not responding error`n`n- Add backend/scripts/setup-freeradius.sh: installs FreeRADIUS, configures PostgreSQL SQL module on correct port 5444, registers MikroTik NAS client, opens UFW ports 1812/1813`n- Add src/app/api/radius/health/route.ts: new health check endpoint reporting FreeRADIUS status, port availability, NAS client count, and fix instructions`n- Update backend/scripts/droplet-start.sh: add FreeRADIUS status check on startup with clear error messages and fix command`n- Add prisma/schema.prisma: RadPostAuth model (radpostauth table) required by FreeRADIUS post-auth SQL module`n- Add prisma migration: 20260509_add_radpostauth_table"

git commit -m $msg

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Committed successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️  Nothing to commit or commit failed." -ForegroundColor Yellow
}

# Push
Write-Host ""
Write-Host "🚀 Pushing to remote..." -ForegroundColor Yellow

$branch = git rev-parse --abbrev-ref HEAD
Write-Host "   Branch: $branch" -ForegroundColor Gray

git push origin $branch

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Pushed successfully to origin/$branch!" -ForegroundColor Green
    Write-Host ""
    Write-Host "─────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "📡 Next: Deploy to Droplet and run FreeRADIUS setup" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  SSH into your Droplet then run:" -ForegroundColor White
    Write-Host "  git pull && sudo bash backend/scripts/setup-freeradius.sh" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Then in MikroTik → RADIUS:" -ForegroundColor White
    Write-Host "  Address : 10.0.0.1 (WireGuard IP)" -ForegroundColor Yellow
    Write-Host "  Secret  : hqinvestment_radius_secret" -ForegroundColor Yellow
    Write-Host "  Auth    : 1812   Acct: 1813" -ForegroundColor Yellow
    Write-Host "─────────────────────────────────────────────────" -ForegroundColor DarkGray
} else {
    Write-Host ""
    Write-Host "❌ Push failed! Check your git remote and credentials." -ForegroundColor Red
    Write-Host "   Try: git remote -v" -ForegroundColor Gray
}

Write-Host ""
