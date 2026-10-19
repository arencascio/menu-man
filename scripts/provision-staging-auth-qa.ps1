[CmdletBinding()]
param(
  [switch]$Apply,
  [string]$ConfirmProjectRef
)

$ErrorActionPreference = 'Stop'
$expectedRef = 'jjvongzvtnzlvwdfcnjk'
$expectedProjectName = 'Menu Man Staging'
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$supabaseDirectory = Join-Path $repositoryRoot 'supabase'
$projectRefPath = Join-Path $supabaseDirectory '.temp\project-ref'
$linkedProjectPath = Join-Path $supabaseDirectory '.temp\linked-project.json'
$fixtureSqlPath = Join-Path $supabaseDirectory 'qa\provision-authenticated-catering-qa.sql'

foreach ($requiredPath in @($projectRefPath, $linkedProjectPath, $fixtureSqlPath)) {
  if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
    throw "Staging QA provisioning stopped: required project-link or SQL file is missing ($requiredPath)."
  }
}

$linkedRef = (Get-Content -Raw -LiteralPath $projectRefPath).Trim()
if ($linkedRef -cne $expectedRef) {
  throw "Staging QA provisioning stopped: linked project reference is not the approved Staging reference ($expectedRef)."
}

try {
  $linkedProject = Get-Content -Raw -LiteralPath $linkedProjectPath | ConvertFrom-Json
} catch {
  throw 'Staging QA provisioning stopped: linked project metadata is invalid JSON.'
}

if ($linkedProject.ref -cne $expectedRef -or $linkedProject.name -cne $expectedProjectName) {
  throw "Staging QA provisioning stopped: linked metadata must identify $expectedProjectName ($expectedRef)."
}

$fixtureSql = Get-Content -Raw -LiteralPath $fixtureSqlPath
if (-not $Apply) {
  Write-Output "Verified linked project: $expectedProjectName ($expectedRef). No SQL was executed."
  Write-Output "After reviewing the fixture SQL and approved staging accounts, rerun with -Apply -ConfirmProjectRef '$expectedRef'."
  return
}

if ($ConfirmProjectRef -cne $expectedRef) {
  throw "Staging QA provisioning stopped: -Apply requires -ConfirmProjectRef '$expectedRef'."
}

if ($fixtureSql -match 'REPLACE_WITH_QA_') {
  throw 'Staging QA provisioning stopped: replace all four synthetic Auth email placeholders before execution.'
}

$supabaseCli = Get-Command 'supabase' -CommandType Application -ErrorAction Stop
& $supabaseCli.Source --workdir $supabaseDirectory db query --linked -f $fixtureSqlPath
if ($LASTEXITCODE -ne 0) {
  throw "Staging QA fixture SQL failed with exit code $LASTEXITCODE. Stop and inspect staging before retrying."
}

Write-Output "Staging QA fixture SQL completed against linked project $expectedProjectName ($expectedRef). Verify the two restaurants, four memberships, permissions, and settings before running authenticated QA."
