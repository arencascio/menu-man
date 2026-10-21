$ErrorActionPreference = 'Stop'
# Load only the parser function, never the operator script's executable body.
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'sync-super-tacos-content.ps1'), [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw 'Wrapper syntax errors.' }
$parser = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Test-SuperTacosTlsPreflight' }, $true)
if (!$parser) { throw 'TLS parser missing.' }
Invoke-Expression $parser.Extent.Text
$table = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'fixtures/super-tacos-psql18-conninfo.txt')
$prose = 'You are connected to database "postgres".' + "`n" + 'SSL connection (protocol: TLSv1.3, cipher: TLS_AES_256_GCM_SHA384, compression: off)'
$cases = @(
  @{ Name='captured psql 18 table'; Output=$table; ExitCode=0; Expected=$true },
  @{ Name='older prose'; Output=$prose; ExitCode=0; Expected=$true },
  @{ Name='TLS disabled'; Output=($table -replace 'SSL Connection\s*\| true','SSL Connection | false'); ExitCode=0; Expected=$false },
  @{ Name='missing protocol'; Output=($table -replace '(?m)^ SSL Protocol[^\r\n]*\r?\n',''); ExitCode=0; Expected=$false },
  @{ Name='missing cipher'; Output=($table -replace '(?m)^ SSL Cipher[^\r\n]*\r?\n',''); ExitCode=0; Expected=$false },
  @{ Name='duplicate connection'; Output=($table + "`nSSL Connection | true"); ExitCode=0; Expected=$false },
  @{ Name='contradictory connection'; Output=($table + "`nSSL Connection | false"); ExitCode=0; Expected=$false },
  @{ Name='duplicate protocol'; Output=($table + "`nSSL Protocol | TLSv1.2"); ExitCode=0; Expected=$false },
  @{ Name='duplicate cipher'; Output=($table + "`nSSL Cipher | AES256-SHA"); ExitCode=0; Expected=$false },
  @{ Name='empty cipher'; Output=($table -replace 'TLS_AES_256_GCM_SHA384',''); ExitCode=0; Expected=$false },
  @{ Name='null cipher'; Output=($table -replace 'TLS_AES_256_GCM_SHA384','TLS_NULL_WITH_NULL_NULL'); ExitCode=0; Expected=$false },
  @{ Name='malformed field'; Output=($table -replace 'SSL Connection\s*\|','SSL Connection ='); ExitCode=0; Expected=$false },
  @{ Name='unknown protocol'; Output=($table -replace 'TLSv1.3','unknown'); ExitCode=0; Expected=$false },
  @{ Name='mixed formats'; Output=($table + "`n" + $prose); ExitCode=0; Expected=$false },
  @{ Name='missing output'; Output=''; ExitCode=0; Expected=$false },
  @{ Name='failed psql table'; Output=$table; ExitCode=1; Expected=$false },
  @{ Name='failed psql prose'; Output=$prose; ExitCode=1; Expected=$false }
)
foreach ($case in $cases) {
  $actual = Test-SuperTacosTlsPreflight -Output $case.Output -ExitCode $case.ExitCode
  if ($actual -ne $case.Expected) { throw "TLS parser test failed: $($case.Name)" }
  Write-Output "PASS $($case.Name)"
}
Write-Output "$($cases.Count) TLS preflight tests passed. No database connection made."
