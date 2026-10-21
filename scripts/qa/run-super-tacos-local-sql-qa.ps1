# LOCAL ONLY. Run against the disposable PostgreSQL 17 cluster on 127.0.0.1:55417.
# This never supplies a Production approval or backup attestation.
$ErrorActionPreference = 'Continue' # psql rejection stderr is expected in negative cases.
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
$createdb = 'C:\Program Files\PostgreSQL\17\bin\createdb.exe'
$qaRoot = Join-Path $env:TEMP 'menu-man-gate-a4-pg17'
$derived = Join-Path $qaRoot 'derived'
$env:PGSSLMODE = 'disable'
$env:PGSSLROOTCERT = 'C:\local-qa\root.crt'
$env:APPDATA = 'C:\local-qa'
$connection = @('-X','-qAt','-v','ON_ERROR_STOP=1','-v','production_project_ref=local-only','-h','127.0.0.1','-p','55417','-U','localqa')

function Invoke-LocalSql($database, $file, $variables = @()) {
  $output = & $psql @connection -d $database @variables -f $file 2>&1
  return @{ Exit = $LASTEXITCODE; Lines = @($output) }
}
function Invoke-LocalQuery($database, $query) {
  $output = & $psql @connection -d $database -c $query 2>&1
  if ($LASTEXITCODE -ne 0) { throw "Local query failed: $output" }
  return @($output)[-1]
}
function Get-Baseline($database) {
  $result = Invoke-LocalSql $database (Join-Path $derived 'preflight.sql')
  if ($result.Exit -ne 0) { throw "Local preflight failed: $($result.Lines -join ' ')" }
  return $result.Lines[-1] | ConvertFrom-Json
}
function Invoke-Content($database, $baseline) {
  $variables = @(
    '-v','approve_public_content=local-only',
    '-v','production_backup_sha256=none',
    '-v',"baseline_captured_at=$($baseline.capturedAt)",
    '-v',"baseline_content_sha=$($baseline.otherContent)",
    '-v',"baseline_protected_sha=$($baseline.protectedState)"
  )
  return Invoke-LocalSql $database (Join-Path $derived 'content.sql') $variables
}
function New-Scenario($name) {
  $database = "menu_man_gate_a4_$name"
  & $createdb -h 127.0.0.1 -p 55417 -U localqa -E UTF8 -T template0 --lc-collate=C --lc-ctype=C $database
  if ($LASTEXITCODE -ne 0) { throw "Could not create $database (refusing to overwrite)" }
  $fixture = Invoke-LocalSql $database 'scripts/qa/super-tacos-production-shaped.sql'
  if ($fixture.Exit -ne 0) { throw "Fixture failed: $($fixture.Lines -join ' ')" }
  $migration = Invoke-LocalSql $database (Join-Path $derived 'schema-prep.sql') @('-v','approve_public_schema=local-only','-v','production_backup_sha256=none')
  if ($migration.Exit -ne 0) { throw "Migration failed: $($migration.Lines -join ' ')" }
  return $database
}
function Expect-Rejection($label, $result, $message, $database) {
  $errorText = $result.Lines -join ' '
  if ($result.Exit -eq 0 -or $errorText -notmatch [regex]::Escape($message)) {
    throw "$label did not reject as expected: $errorText"
  }
  $demoCount = Invoke-LocalQuery $database "select count(*) from public.restaurants where id='20000000-0000-4000-8000-000000000001'"
  if ($demoCount -ne '0') { throw "$label left a Super Tacos restaurant" }
  Write-Output "$label rejected, transaction rolled back"
}

$database = New-Scenario 'slug'
$baseline = Get-Baseline $database
Invoke-LocalQuery $database "insert into public.restaurants(id,slug,name) values ('30000000-0000-4000-8000-000000000001','super-tacos','Synthetic Collision')" | Out-Null
Expect-Rejection 'Slug collision' (Invoke-Content $database $baseline) 'Existing restaurant' $database

$database = New-Scenario 'id'
$baseline = Get-Baseline $database
Invoke-LocalQuery $database "insert into public.menu_items(id,restaurant_id,name,price_cents) values ('20000000-0000-4000-8000-000000000999','10000000-0000-4000-8000-000000000001','Synthetic Collision',100)" | Out-Null
Expect-Rejection 'Reserved ID collision' (Invoke-Content $database $baseline) 'Reserved identity collision' $database

$database = New-Scenario 'fingerprint'
$baseline = Get-Baseline $database
Invoke-LocalQuery $database "update public.restaurants set name='Synthetic Armando changed' where slug='armandos'" | Out-Null
Expect-Rejection 'Other-tenant fingerprint change' (Invoke-Content $database $baseline) 'Other-tenant content or operational fingerprint changed' $database

$database = New-Scenario 'rollback'
Invoke-LocalQuery $database "alter table public.restaurant_ordering_settings add constraint local_qa_reject_demo check (restaurant_id <> '20000000-0000-4000-8000-000000000001'::uuid)" | Out-Null
$baseline = Get-Baseline $database
Expect-Rejection 'Late constraint failure' (Invoke-Content $database $baseline) 'local_qa_reject_demo' $database
