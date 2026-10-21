param(
  [ValidateSet('Validate', 'SchemaVerify', 'SchemaPrep', 'Preflight', 'Verify', 'ArmandoPreflight')][string]$Mode = 'Validate',
  [string]$BaselinePath,
  [string]$ProjectRef = 'fullaiodvmilkdxyxnln',
  [string]$HostName = 'aws-0-us-west-2.pooler.supabase.com',
  [int]$Port = 5432,
  [string]$Database = 'postgres',
  [string]$Username = 'postgres.fullaiodvmilkdxyxnln',
  [string]$SslMode = 'verify-full',
  [string]$RootCertificatePath,
  [string]$PsqlPath = 'C:\Program Files\PostgreSQL\17\bin\psql.exe',
  [string]$OwnerApproval,
  [string]$BackupSha256,
  [string]$BackupPath = 'C:\Users\cowbe\MenuMan-Private-Backups\production\20261021T191304Z\production-public-20261021T1913Z.dump'
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$release = Join-Path $repo 'supabase/releases/super-tacos-public'
$expectedProject = 'fullaiodvmilkdxyxnln'
$expectedHost = 'aws-0-us-west-2.pooler.supabase.com'
$expectedUser = 'postgres.fullaiodvmilkdxyxnln'
$expectedBackupSha = '407feb3604efb37c4bb0149e74cdcbe379b5589dbfba254cfe098e78b834ee02'
$expectedApproval = 'add-production-restaurant-indexability'

function Assert-RestrictedFile([string]$Path, [string]$Label) {
  $file = Get-Item -LiteralPath $Path -ErrorAction Stop
  if ($file -isnot [IO.FileInfo] -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "$Label must be a regular non-reparse file" }
  $currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $allowed = @($currentSid, 'S-1-5-18', 'S-1-5-32-544')
  foreach ($ace in (Get-Acl -LiteralPath $file.FullName).Access) {
    if ($ace.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) { continue }
    $sid = try { $ace.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value } catch { '' }
    if ($sid -and $sid -notin $allowed) { throw "$Label permissions grant access to an unexpected identity" }
  }
  return $file
}

$manifest = Get-Content -LiteralPath (Join-Path $release 'manifest.json') -Raw | ConvertFrom-Json
if ($manifest.project -cne $expectedProject -or $manifest.tenant -cne '20000000-0000-4000-8000-000000000001' -or $manifest.mode -cne 'new-tenant-only-browse-only') { throw 'Wrong release identity' }
foreach ($entry in $manifest.artifacts.PSObject.Properties) {
  if ($entry.Name -notin @('schema-prep.sql', 'schema-verify.sql', 'preflight.sql', 'content.sql', 'verify.sql', 'armandos-preflight.sql')) { throw 'Unexpected artifact path' }
  if ((Get-FileHash -LiteralPath (Join-Path $release $entry.Name) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.Value) { throw "Artifact hash mismatch: $($entry.Name)" }
}
if (@($manifest.artifacts.PSObject.Properties).Count -ne 6 -or @($manifest.sources.PSObject.Properties).Count -ne 3) { throw 'Incomplete artifact manifest' }
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

if ($ProjectRef -cne $expectedProject -or $HostName -cne $expectedHost -or $Port -ne 5432 -or $Database -cne 'postgres' -or $Username -cne $expectedUser -or $SslMode -cne 'verify-full') { throw 'Refusing connection settings that do not exactly match the Production Session Pooler' }
if (!$env:APPDATA) { throw 'APPDATA unavailable; approved root certificate cannot be resolved' }
$canonicalAppData = [Environment]::GetFolderPath([Environment+SpecialFolder]::ApplicationData)
if (!$canonicalAppData -or [IO.Path]::GetFullPath($env:APPDATA) -ine [IO.Path]::GetFullPath($canonicalAppData)) { throw 'APPDATA override does not match the current Windows account profile' }
$approvedRoot = Join-Path $canonicalAppData 'postgresql/root.crt'
if (!$RootCertificatePath) { $RootCertificatePath = $approvedRoot }
if ([IO.Path]::GetFullPath($RootCertificatePath) -ine [IO.Path]::GetFullPath($approvedRoot)) { throw 'Only the pinned APPDATA PostgreSQL root certificate is allowed' }
$root = Assert-RestrictedFile $approvedRoot 'Approved root certificate'
$passFile = Assert-RestrictedFile (Join-Path $canonicalAppData 'postgresql/pgpass.conf') 'PostgreSQL password file'
$psqlFile = Get-Item -LiteralPath $PsqlPath -ErrorAction Stop
if ($psqlFile -isnot [IO.FileInfo] -or $psqlFile.FullName -ine 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -or ($psqlFile.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Only the pinned PostgreSQL 17 psql executable is allowed' }
$version = & $psqlFile.FullName --version 2>&1
if ($LASTEXITCODE -ne 0 -or ($version -join ' ') -notmatch '^psql \(PostgreSQL\) 17\.') { throw 'PostgreSQL 17 psql is required' }

# Explicit service-file selection is rejected. Other libpq environment settings are
# cleared and replaced so the same psql process receives only the pinned endpoint.
foreach ($name in @('PGSERVICE', 'PGSERVICEFILE', 'PGHOSTADDR', 'PGTARGETSESSIONATTRS')) {
  if ([Environment]::GetEnvironmentVariable($name, 'Process')) { throw "Unsafe libpq override is set: $name" }
}
if ($Mode -eq 'SchemaPrep') {
  if ($OwnerApproval -cne $expectedApproval) { throw 'Separate owner approval is required' }
  if ($BackupSha256 -cnotmatch '^[a-f0-9]{64}$' -or $BackupSha256 -cne $expectedBackupSha) { throw 'Approved Production backup SHA attestation is required' }
  $backup = Assert-RestrictedFile $BackupPath 'Verified Production public backup'
  if ((Get-FileHash -LiteralPath $backup.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expectedBackupSha) { throw 'Production backup SHA does not match the approved manifest' }
}
if ($Mode -notin @('ArmandoPreflight', 'SchemaVerify', 'SchemaPrep') -and !$BaselinePath) { throw 'Explicit local baseline path required' }
$baselineFile = if ($BaselinePath) { [IO.Path]::GetFullPath($BaselinePath) } else { $null }
if ($Mode -eq 'Verify') {
  $baseline = Get-Content -LiteralPath $baselineFile -Raw | ConvertFrom-Json
  if ($baseline.project -cne $manifest.project -or $baseline.tenant -cne $manifest.tenant -or $baseline.existingSuperTacos -ne $false -or $baseline.otherContent -cnotmatch '^[a-f0-9]{64}$' -or $baseline.protectedState -cnotmatch '^[a-f0-9]{64}$') { throw 'Invalid baseline identity/fingerprints' }
}
if ($Mode -eq 'Preflight' -and (Test-Path -LiteralPath $baselineFile)) { throw 'Refuse to overwrite existing baseline' }

$names = @((Get-ChildItem Env: | Where-Object { $_.Name -like 'PG*' } | ForEach-Object Name) + @('APPDATA', 'PGSSLMODE', 'PGSSLROOTCERT', 'PGPASSFILE', 'PGCONNECT_TIMEOUT', 'PGAPPNAME') | Select-Object -Unique)
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
  foreach ($name in $names) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
  $env:PGSSLMODE = 'verify-full'
  $env:PGSSLROOTCERT = $root.FullName
  $env:PGPASSFILE = $passFile.FullName
  $env:PGCONNECT_TIMEOUT = '10'
  $env:PGAPPNAME = 'MenuMan-Production-Release-Guard'
  $env:APPDATA = $canonicalAppData
  $arguments = @('-X', '-w', '-qAt', '--host', $expectedHost, '--port', '5432', '--username', $expectedUser, '--dbname', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', "production_project_ref=$expectedProject", '-c', '\conninfo')
  if ($Mode -eq 'SchemaPrep') {
    $arguments += @('-v', "approve_public_schema=$OwnerApproval", '-v', "production_backup_sha256=$BackupSha256", '-f', (Join-Path $release 'schema-prep.sql'))
  } elseif ($Mode -eq 'SchemaVerify') {
    $arguments += @('-f', (Join-Path $release 'schema-verify.sql'))
  } elseif ($Mode -eq 'Preflight') {
    $arguments += @('-f', (Join-Path $release 'preflight.sql'))
  } elseif ($Mode -eq 'Verify') {
    $arguments += @('-v', "baseline_content_sha=$($baseline.otherContent)", '-v', "baseline_protected_sha=$($baseline.protectedState)", '-f', (Join-Path $release 'verify.sql'))
  } elseif ($Mode -eq 'ArmandoPreflight') {
    $arguments += @('-f', (Join-Path $release 'armandos-preflight.sql'))
  }
  $output = & $psqlFile.FullName @arguments 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'Production SQL invocation failed; stop and inspect the guarded transaction result' }
  if ($Mode -eq 'SchemaPrep') { Write-Output 'Reviewed indexability migration completed through the verified Production pooler connection.' }
  elseif ($Mode -eq 'SchemaVerify') { Write-Output 'Read-only Production schema and Armando verification passed.' }
  elseif ($Mode -eq 'Verify') { Write-Output 'Read-only content and isolation verification passed.' }
  elseif ($Mode -eq 'Preflight') {
    $records = @($output | Where-Object { $_ -match '^\{"' })
    if ($records.Count -ne 1) { throw 'Missing or ambiguous baseline output' }
    $baseline = $records[0] | ConvertFrom-Json
    if ($baseline.project -cne $manifest.project -or $baseline.tenant -cne $manifest.tenant -or $baseline.existingSuperTacos -ne $false -or $baseline.otherContent -cnotmatch '^[a-f0-9]{64}$' -or $baseline.protectedState -cnotmatch '^[a-f0-9]{64}$') { throw 'Invalid read-only baseline' }
    [IO.File]::WriteAllText($baselineFile, $records[0], [Text.UTF8Encoding]::new($false))
    Write-Output 'Read-only preflight passed; baseline fingerprints saved locally.'
  } elseif ($Mode -eq 'ArmandoPreflight') {
    $records = @($output | Where-Object { $_ -match '^\{"' })
    if ($records.Count -gt 1) { throw 'Ambiguous Armando identity; stop' }
    if ($records.Count -eq 0) { Write-Output 'No Armando restaurant record found; a separate content release is required.' }
    else { Write-Output $records[0] }
  }
} finally {
  foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
