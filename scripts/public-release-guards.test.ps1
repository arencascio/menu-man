$ErrorActionPreference = 'Stop'
$wrapper = Join-Path $PSScriptRoot 'check-super-tacos-public-release.ps1'
$tokens = $null; $parseErrors = $null
[void][Management.Automation.Language.Parser]::ParseFile($wrapper, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw 'PowerShell parser validation failed' }
& $wrapper -Mode Validate
$prepSql = Get-Content (Join-Path (Split-Path $PSScriptRoot -Parent) 'supabase/releases/super-tacos-public/schema-prep.sql') -Raw
$verifySql = Get-Content (Join-Path (Split-Path $PSScriptRoot -Parent) 'supabase/releases/super-tacos-public/schema-verify.sql') -Raw
if ($prepSql -notmatch "release_host'\) <> 'aws-0-us-west-2\.pooler\.supabase\.com'" -or $prepSql -notmatch "release_user'\) <> 'postgres\.fullaiodvmilkdxyxnln'" -or $prepSql -match 'pg_stat_ssl') { throw 'Migration must pin the Production pooler identity and rely on verified client TLS' }
if ($verifySql -notmatch "release_host'\) <> 'aws-0-us-west-2\.pooler\.supabase\.com'" -or $verifySql -notmatch "release_user'\) <> 'postgres\.fullaiodvmilkdxyxnln'" -or $verifySql -match 'pg_stat_ssl') { throw 'Verifier must pin the Production pooler identity and rely on verified client TLS' }
if ([regex]::Matches($prepSql, '(?im)^alter\s+table\s+public\.restaurants\s+add\s+column\s+is_indexable\s+boolean\s+not\s+null\s+default\s+true;\s*$').Count -ne 1) { throw 'Migration DDL changed from the one approved column' }
$writeStatements = [regex]::Matches($prepSql, '(?im)^\s*(create|drop|alter|update|delete|insert|grant|revoke|comment|truncate)\b')
if ($writeStatements.Count -ne 1) { throw 'Migration must contain exactly one schema write statement' }
function Assert-Rejected([scriptblock]$Action) {
  $rejected = $false
  try { & $Action } catch { $rejected = $true }
  if (!$rejected) { throw 'Expected guard to fail closed before connecting' }
}
function Assert-ArgsRejected([string[]]$ArgumentVector) {
  $rejected = $false
  try { & $wrapper @ArgumentVector } catch { $rejected = $true }
  if (!$rejected) { throw "Expected wrapper argument rejection: $($ArgumentVector -join ' ')" }
}
Assert-ArgsRejected @('-Mode','SchemaVerify','-ProjectRef','jjvongzvtnzlvwdfcnjk')
Assert-ArgsRejected @('-Mode','SchemaVerify','-HostName','db.fullaiodvmilkdxyxnln.supabase.co')
Assert-ArgsRejected @('-Mode','SchemaVerify','-Port','6543')
Assert-ArgsRejected @('-Mode','SchemaVerify','-Username','postgres')
Assert-ArgsRejected @('-Mode','SchemaVerify','-SslMode','require')
Assert-ArgsRejected @('-Mode','SchemaVerify','-RootCertificatePath','C:\local\wrong-root.crt')
Assert-ArgsRejected @('-Mode','SchemaVerify','-PsqlPath','C:\local\psql.exe')
$savedService = $env:PGSERVICE
$savedServiceFile = $env:PGSERVICEFILE
try { $env:PGSERVICE = 'untrusted-service'; Assert-ArgsRejected @('-Mode','SchemaVerify') }
finally { $env:PGSERVICE = $savedService }
try { $env:PGSERVICEFILE = 'C:\local\pg_service.conf'; Assert-ArgsRejected @('-Mode','SchemaVerify') }
finally { $env:PGSERVICEFILE = $savedServiceFile }
$savedAppDataOverride = $env:APPDATA
try { $env:APPDATA = Join-Path ([IO.Path]::GetTempPath()) 'untrusted-appdata'; Assert-Rejected { & $wrapper -Mode SchemaVerify } }
finally { $env:APPDATA = $savedAppDataOverride }
$savedAppData = $env:APPDATA
try {
  $env:APPDATA = ''
  Assert-Rejected { & $wrapper -Mode Preflight -BaselinePath 'unused-baseline.json' }
  Assert-Rejected { & $wrapper -Mode SchemaVerify }
  $env:APPDATA = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
  Assert-Rejected { & $wrapper -Mode Verify -BaselinePath 'unused-baseline.json' }
  Assert-Rejected { & $wrapper -Mode Execute }
} finally { $env:APPDATA = $savedAppData }
Assert-Rejected { & $wrapper -Mode SchemaPrep -OwnerApproval '' }
Assert-Rejected { & $wrapper -Mode SchemaPrep -OwnerApproval 'add-production-restaurant-indexability' -BackupSha256 '' }
Write-Output 'PowerShell parse, artifact validation, fixed Production identity/TLS/service overrides, missing certificate, approval and backup attestation guards passed. No connection made.'
