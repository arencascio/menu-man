param(
  [ValidateSet('Validate', 'Preflight', 'Verify', 'ArmandoPreflight')][string]$Mode = 'Validate',
  [string]$BaselinePath
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$release = Join-Path $repo 'supabase/releases/super-tacos-public'
$manifest = Get-Content -LiteralPath (Join-Path $release 'manifest.json') -Raw | ConvertFrom-Json
if ($manifest.project -cne 'fullaiodvmilkdxyxnln' -or $manifest.tenant -cne '20000000-0000-4000-8000-000000000001' -or $manifest.mode -cne 'new-tenant-only-browse-only') { throw 'Wrong release identity' }
foreach ($entry in $manifest.artifacts.PSObject.Properties) {
  if ($entry.Name -notin @('preflight.sql', 'content.sql', 'verify.sql', 'armandos-preflight.sql')) { throw 'Unexpected artifact path' }
  if ((Get-FileHash -LiteralPath (Join-Path $release $entry.Name) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.Value) { throw "Artifact hash mismatch: $($entry.Name)" }
}
if (@($manifest.artifacts.PSObject.Properties).Count -ne 4 -or @($manifest.sources.PSObject.Properties).Count -ne 3) { throw 'Incomplete artifact manifest' }
foreach ($entry in $manifest.sources.PSObject.Properties) {
  if ($entry.Name -notin @('supabase/seeds/staging/super-tacos-demo.json', 'src/lib/demo/theme.json', 'scripts/prepare-super-tacos-public-release.mjs')) { throw 'Unexpected source path' }
  if ((Get-FileHash -LiteralPath (Join-Path $repo $entry.Name) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.Value) { throw 'Source hash mismatch' }
}
if (@($manifest.assets.PSObject.Properties).Count -lt 25) { throw 'Incomplete asset manifest' }
foreach ($entry in $manifest.assets.PSObject.Properties) {
  if ($entry.Name -cnotmatch '^public/img/super-tacos/approved/[a-z0-9-]+\.(webp|svg)$') { throw 'Unexpected asset path' }
  if ((Get-FileHash -LiteralPath (Join-Path $repo $entry.Name) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.Value) { throw 'Asset hash mismatch' }
}
if ($Mode -eq 'Validate') { Write-Output 'Production release artifacts match manifest. No connection made.'; return }
if (!$env:APPDATA) { throw 'APPDATA unavailable; approved root certificate cannot be resolved' }
$root = Get-Item -LiteralPath (Join-Path $env:APPDATA 'postgresql/root.crt')
if ($root -isnot [System.IO.FileInfo] -or ($root.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) { throw 'Approved certificate must be a regular file' }
if ($Mode -ne 'ArmandoPreflight' -and !$BaselinePath) { throw 'Explicit local baseline path required' }
$baselineFile = if ($BaselinePath) { [IO.Path]::GetFullPath($BaselinePath) } else { $null }
$psql = (Get-Command psql -ErrorAction Stop).Source
# This wrapper deliberately has NO Execute mode. It can run only read-only SQL.
$names = @('PGSSLMODE', 'PGSSLROOTCERT', 'PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
  $env:PGSSLMODE = 'verify-full'
  $env:PGSSLROOTCERT = $root.FullName
  Remove-Item Env:PGSERVICE -ErrorAction SilentlyContinue
  Remove-Item Env:PGSERVICEFILE -ErrorAction SilentlyContinue
  $env:PGOPTIONS = '-c default_transaction_read_only=on'
  $arguments = @('-X', '-w', '-qAt', '--host=db.fullaiodvmilkdxyxnln.supabase.co', '--port=5432', '--username=postgres', '--dbname=postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'production_project_ref=fullaiodvmilkdxyxnln')
  if ($Mode -eq 'Verify') {
    $baseline = Get-Content -LiteralPath $baselineFile -Raw | ConvertFrom-Json
    if ($baseline.project -cne $manifest.project -or $baseline.tenant -cne $manifest.tenant -or $baseline.existingSuperTacos -ne $false -or $baseline.otherContent -cnotmatch '^[a-f0-9]{64}$' -or $baseline.paymentsAndOrders -cnotmatch '^[a-f0-9]{64}$') { throw 'Invalid baseline identity/fingerprints' }
    $arguments += @('-v', "baseline_content_sha=$($baseline.otherContent)", '-v', "baseline_payments_sha=$($baseline.paymentsAndOrders)", '-f', (Join-Path $release 'verify.sql'))
  } elseif ($Mode -eq 'ArmandoPreflight') {
    $arguments += @('-f', (Join-Path $release 'armandos-preflight.sql'))
  } else {
    if (Test-Path -LiteralPath $baselineFile) { throw 'Refuse to overwrite existing baseline' }
    $arguments += @('-f', (Join-Path $release 'preflight.sql'))
  }
  $output = & $psql @arguments
  if ($LASTEXITCODE -ne 0) { throw 'Read-only Production check failed; stop' }
  if ($Mode -eq 'Preflight') {
    # Select only the single baseline JSON line; SET/session GUC echoes are not data.
    $records = @($output | Where-Object { $_ -match '^\{"' })
    if ($records.Count -ne 1) { throw 'Missing or ambiguous baseline output' }
    $baseline = $records[0] | ConvertFrom-Json
    if ($baseline.project -cne $manifest.project -or $baseline.tenant -cne $manifest.tenant -or $baseline.existingSuperTacos -ne $false -or $baseline.otherContent -cnotmatch '^[a-f0-9]{64}$' -or $baseline.paymentsAndOrders -cnotmatch '^[a-f0-9]{64}$') { throw 'Invalid read-only baseline' }
    [IO.File]::WriteAllText($baselineFile, $records[0], [Text.UTF8Encoding]::new($false))
    Write-Output 'Read-only preflight passed; baseline fingerprints saved locally.'
  } elseif ($Mode -eq 'Verify') {
    Write-Output 'Read-only content and isolation verification passed.'
  } else {
    $records = @($output | Where-Object { $_ -match '^\{"' })
    if ($records.Count -gt 1) { throw 'Ambiguous Armando identity; stop' }
    if ($records.Count -eq 0) { Write-Output 'No Armando restaurant record found; a separate content release is required.' }
    else { Write-Output $records[0] }
  }
} finally {
  foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
