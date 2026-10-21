# Reviewable future operator entry point. No connection or write without -Execute.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$BackupFile,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedSqlSha256,
  [string]$ConnectionHost = 'aws-0-us-east-2.pooler.supabase.com',
  [string]$ConnectionUser = 'postgres.jjvongzvtnzlvwdfcnjk',
  [ValidateRange(1,65535)][int]$ConnectionPort = 5432,
  [string]$Approval = '',
  [switch]$Execute
)
function Test-SuperTacosTlsPreflight([string]$Output, [int]$ExitCode) {
  if ($ExitCode -ne 0) { return $false }
  $securityLines = @($Output -split "\r?\n" | Where-Object { $_ -match '^\s*SSL (Connection|Protocol|Cipher)\b' })
  $cipher = $null
  if ($securityLines.Count -eq 3) {
    $connection = @($securityLines | Where-Object { $_ -match '^\s*SSL Connection\s*\|\s*true\s*$' })
    $protocol = @($securityLines | Where-Object { $_ -match '^\s*SSL Protocol\s*\|\s*TLSv1\.[23]\s*$' })
    $cipherRows = @($securityLines | Where-Object { $_ -match '^\s*SSL Cipher\s*\|\s*[A-Z0-9][A-Z0-9_-]{2,127}\s*$' })
    if ($connection.Count -ne 1 -or $protocol.Count -ne 1 -or $cipherRows.Count -ne 1) { return $false }
    $cipher = ($cipherRows[0] -split '\|', 2)[1].Trim()
  } elseif ($securityLines.Count -eq 1 -and $securityLines[0] -match '^\s*SSL connection\s*\(protocol:\s*TLSv1\.[23],\s*cipher:\s*([A-Z0-9][A-Z0-9_-]{2,127})(?:,\s*compression:\s*(?:on|off))?(?:,\s*ALPN:\s*[A-Z0-9_./-]+)?\)\s*$') {
    $cipher = $Matches[1]
  } else { return $false }
  return $cipher -notmatch '(?:^|[_-])(?:NONE|NULL|UNKNOWN)(?:$|[_-])'
}
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$projectRef = 'jjvongzvtnzlvwdfcnjk'
$tenantId = '20000000-0000-4000-8000-000000000001'
if ($ConnectionPort -ne 5432) { throw 'Session Pooler and Staging connection port must be 5432.' }
if (!(($ConnectionHost -ceq "db.$projectRef.supabase.co" -and $ConnectionUser -ceq 'postgres') -or
  ($ConnectionHost -ceq 'aws-0-us-east-2.pooler.supabase.com' -and $ConnectionUser -ceq "postgres.$projectRef"))) {
  throw 'Exact Staging host/user required.'
}
$branch = & git -C $repoRoot branch --show-current
if ($LASTEXITCODE -ne 0 -or $branch -cne 'feature/super-tacos-demo') { throw 'Expected feature/super-tacos-demo worktree.' }
$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $repoRoot 'supabase/qa/super-tacos-content-c1-manifest.json') | ConvertFrom-Json
if ($manifest.projectRef -cne $projectRef -or $manifest.tenantId -cne $tenantId -or $manifest.version -cne 'sprint-c3') { throw 'Invalid content manifest.' }
foreach ($file in $manifest.files.PSObject.Properties) {
  $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $repoRoot $file.Name)).Hash.ToLowerInvariant()
  if ($actualHash -cne $file.Value) { throw "Artifact drift: $($file.Name)" }
}
$sqlRelative = 'supabase/seeds/staging/016_super_tacos_content_c1.sql'
if ($manifest.files.$sqlRelative -cne $ExpectedSqlSha256.ToLowerInvariant()) { throw 'SQL differs from the separately reviewed artifact.' }
$backupPath = (Resolve-Path -LiteralPath $BackupFile).Path
$backup = Get-Content -Raw -Encoding UTF8 -LiteralPath $backupPath | ConvertFrom-Json
$exportedAt = [DateTimeOffset]::Parse($backup.exported_at)
if ($backup.format -cne 'super-tacos-content-backup-v1' -or $backup.project_ref -cne $projectRef -or
  $backup.tenant_id -cne $tenantId -or $backup.menu_id -cne '20000000-0000-4000-8000-000000000002' -or
  $backup.restaurant.id -cne $tenantId -or $backup.restaurant.slug -cne 'super-tacos' -or
  @($backup.items).Count -ne 30 -or @($backup.sections).Count -ne 6 -or @($backup.placements).Count -ne 30 -or
  @($backup.groups).Count -ne 4 -or @($backup.options).Count -ne 10 -or @($backup.overrides).Count -ne 0 -or
  $exportedAt -lt [DateTimeOffset]::UtcNow.AddHours(-24) -or $exportedAt -gt [DateTimeOffset]::UtcNow.AddMinutes(5)) {
  throw 'Fresh verified installed-v1 tenant-content backup required; stop.'
}
if ($backup.restaurant.logo_url -cne '/img/super-tacos/logo.svg' -or $backup.restaurant.phone -or
  $backup.restaurant.address_line1 -or $backup.restaurant.city -or $backup.restaurant.state -or
  $backup.restaurant.postal_code -or $backup.restaurant.google_maps_url -or $backup.restaurant.is_indexable) {
  throw 'Installed restaurant contact or publication state drift; stop.'
}
foreach ($rows in @($backup.items,$backup.groups,$backup.options,$backup.attachments,$backup.overrides)) {
  foreach ($row in $rows) { if ($row.restaurant_id -cne $tenantId) { throw 'Foreign tenant row in backup.' } }
}
foreach ($row in $backup.sections) { if ($row.menu_id -cne $backup.menu_id) { throw 'Foreign menu section in backup.' } }
$baseline = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $repoRoot 'supabase/qa/super-tacos-installed-catalog-v1.json') | ConvertFrom-Json
function Get-DemoId([int]$Number) { return '20000000-0000-4000-8000-' + $Number.ToString('D12') }
$expectedAttachmentCount = 0
foreach ($expected in $baseline.items) {
  $itemId = Get-DemoId (200 + $expected.number)
  $row = @($backup.items | Where-Object { $_.id -ceq $itemId })
  if ($row.Count -ne 1 -or $row[0].name -cne $expected.name -or $row[0].description -cne $expected.description -or
    $row[0].price_cents -ne $expected.price -or $row[0].source_item_id -cne $expected.key -or !$row[0].is_orderable) {
    throw "Backup item identity/content mismatch: $itemId"
  }
  $placement = @($backup.placements | Where-Object { $_.item_id -ceq $itemId })
  if ($placement.Count -ne 1 -or $placement[0].id -cne (Get-DemoId (300 + $expected.number)) -or
    $placement[0].section_id -cne (Get-DemoId $expected.section) -or $placement[0].sort_order -ne $expected.number) { throw 'Backup placement mismatch.' }
  foreach ($groupNumber in $expected.groups) {
    $expectedAttachmentCount++
    $group = $baseline.modifierGroups | Where-Object { $_.number -eq $groupNumber }
    $attachment = @($backup.attachments | Where-Object { $_.menu_item_id -ceq $itemId -and $_.modifier_group_id -ceq (Get-DemoId (500 + $groupNumber)) })
    if ($attachment.Count -ne 1 -or !$attachment[0].is_active -or $attachment[0].min_selections -ne $group.min -or
      $attachment[0].max_selections -ne $group.max) { throw 'Backup required-modifier configuration mismatch.' }
  }
}
if (@($backup.attachments).Count -ne $expectedAttachmentCount) { throw 'Backup attachment inventory mismatch.' }
foreach ($expected in $baseline.modifierGroups) {
  $groupId = Get-DemoId (500 + $expected.number)
  $row = @($backup.groups | Where-Object { $_.id -ceq $groupId })
  if ($row.Count -ne 1 -or $row[0].name -cne $expected.name -or !$row[0].is_active) { throw 'Backup group mismatch.' }
  foreach ($option in $expected.options) {
    $row = @($backup.options | Where-Object { $_.id -ceq (Get-DemoId (600 + $option.number)) -and $_.modifier_group_id -ceq $groupId })
    if ($row.Count -ne 1 -or $row[0].name -cne $option.name -or !$row[0].is_active -or
      $row[0].default_price_adjustment_cents -ne $option.price -or [bool]$row[0].is_default -ne [bool]$option.default) { throw 'Backup modifier pricing/default mismatch.' }
  }
}
foreach ($expected in $baseline.sections) {
  $row = @($backup.sections | Where-Object { $_.id -ceq (Get-DemoId $expected.number) })
  if ($row.Count -ne 1 -or $row[0].name -cne $expected.name -or $row[0].sort_order -ne $expected.sort -or !$row[0].is_active) { throw 'Backup section mismatch.' }
}
$backupSha = (Get-FileHash -Algorithm SHA256 -LiteralPath $backupPath).Hash.ToLowerInvariant()
Write-Output "Verified local artifacts and content backup SHA256: $backupSha"
if (!$Execute) { Write-Output 'Preview only. No database connection or write attempted.'; return }
if ($Approval -cne 'sync-super-tacos-sprint-c3') { throw 'Separate explicit Sprint C.3 content-sync approval required.' }
$appDataPath = $env:APPDATA
if ([string]::IsNullOrWhiteSpace($appDataPath)) { throw 'APPDATA is unavailable; trusted PostgreSQL root certificate cannot be resolved.' }
$rootCertificateCandidate = Join-Path $appDataPath 'postgresql/root.crt'
try {
  $rootCertificateItem = Get-Item -LiteralPath $rootCertificateCandidate -ErrorAction Stop
  if ($rootCertificateItem -isnot [System.IO.FileInfo] -or $rootCertificateItem.PSIsContainer) { throw 'Expected a regular certificate file.' }
  $trustedRootCertificate = (Resolve-Path -LiteralPath $rootCertificateCandidate -ErrorAction Stop).Path
} catch {
  throw 'The approved trusted PostgreSQL root certificate is missing or is not a regular file.'
}
$psqlCommand = Get-Command psql -CommandType Application -ErrorAction Stop
$previousSslMode = $env:PGSSLMODE
$previousSslRootCert = $env:PGSSLROOTCERT
$previousConnectTimeout = $env:PGCONNECT_TIMEOUT
try {
  $env:PGSSLMODE = 'verify-full'
  $env:PGSSLROOTCERT = $trustedRootCertificate
  $env:PGCONNECT_TIMEOUT = '10'
  # Uses standard pgpass; never reads/displays its contents and never prompts for a password.
  # The verified preflight confirms client-to-pooler TLS; PGSSLMODE enforces it again for execution.
  $preflightOutput = (& $psqlCommand.Source -X -w -h $ConnectionHost -p $ConnectionPort -U $ConnectionUser -d postgres -c '\conninfo' 2>&1 | Out-String)
  if (!(Test-SuperTacosTlsPreflight -Output $preflightOutput -ExitCode $LASTEXITCODE)) {
    throw 'Client TLS preflight failed; no content sync attempted.'
  }
  Write-Output 'Client TLS preflight passed with sslmode=verify-full.'
  & $psqlCommand.Source -X -w -h $ConnectionHost -p $ConnectionPort -U $ConnectionUser -d postgres `
    -v 'ON_ERROR_STOP=1' -v 'menu_man_environment=staging' -v "menu_man_staging_project_ref=$projectRef" `
    -v 'menu_man_client_tls_mode=verify-full' `
    -v "approve_super_tacos_content=$Approval" -v "backup_sha256=$backupSha" -f (Join-Path $repoRoot $sqlRelative)
  if ($LASTEXITCODE -ne 0) { throw 'Content sync failed; transaction must be rolled back. Stop and review the database error.' }
} finally {
  if ($null -eq $previousSslMode) { Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue } else { $env:PGSSLMODE = $previousSslMode }
  if ($null -eq $previousSslRootCert) { Remove-Item Env:PGSSLROOTCERT -ErrorAction SilentlyContinue } else { $env:PGSSLROOTCERT = $previousSslRootCert }
  if ($null -eq $previousConnectTimeout) { Remove-Item Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue } else { $env:PGCONNECT_TIMEOUT = $previousConnectTimeout }
}
