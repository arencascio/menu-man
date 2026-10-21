$ErrorActionPreference = 'Stop'
$wrapper = Join-Path $PSScriptRoot 'check-super-tacos-public-release.ps1'
$tokens = $null; $parseErrors = $null
[void][Management.Automation.Language.Parser]::ParseFile($wrapper, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw 'PowerShell parser validation failed' }
& $wrapper -Mode Validate
function Assert-Rejected([scriptblock]$Action) {
  $rejected = $false
  try { & $Action } catch { $rejected = $true }
  if (!$rejected) { throw 'Expected guard to fail closed before connecting' }
}
$savedAppData = $env:APPDATA
try {
  $env:APPDATA = ''
  Assert-Rejected { & $wrapper -Mode Preflight -BaselinePath 'unused-baseline.json' }
  $env:APPDATA = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
  Assert-Rejected { & $wrapper -Mode Verify -BaselinePath 'unused-baseline.json' }
  Assert-Rejected { & $wrapper -Mode Execute }
} finally { $env:APPDATA = $savedAppData }
Write-Output 'PowerShell parse, artifact validation, missing APPDATA/certificate and unsupported execution-mode guards passed. No connection made.'
