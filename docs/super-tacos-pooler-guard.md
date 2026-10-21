# Production schema guard through the Session Pooler

The standalone indexability migration and read-only verifier use the verified
Production Session Pooler. `scripts/check-super-tacos-public-release.ps1` pins
the project, pooler host, port, database, project-scoped username, PostgreSQL
17 client, `sslmode=verify-full`, and `%APPDATA%\postgresql\root.crt`. It rejects
service-file and host-address overrides, clears other libpq connection
overrides, and uses the existing `%APPDATA%\postgresql\pgpass.conf` without
interactive password prompts. Certificate and password files must be regular
files with access limited to the current account, SYSTEM, and Administrators.

The wrapper starts one `psql` process with `\conninfo` followed by the selected
SQL file. Connection establishment and certificate verification therefore
apply to the same database session that executes SQL. The release SQL checks
that libpq reported the exact pooler host and project-scoped login, and checks
the Production project and database identity. It intentionally does not use
`pg_stat_ssl`: the pooler's backend connection may report `ssl=false` even
when the client-to-pooler session passed certificate verification.

Run `-Mode Validate` to validate manifest and source hashes without connecting.
`-Mode SchemaVerify` invokes only the read-only schema verifier. `-Mode
SchemaPrep` requires the exact schema approval value and backup SHA, then
re-hashes the approved public archive before invoking the one-column migration.
The approval value is a wrapper safeguard, not authorization by itself; the
owner must separately authorize execution. No migration is authorized by this
documentation or by manifest regeneration.

The SQL retains the 15-table inventory, Armando baseline, composite placement
key precondition, absent-column check, serializable transaction, two-second
lock timeout, 30-second statement timeout, one-column DDL, and rollback on any
guard failure. Do not invoke the SQL file directly; use the wrapper so client
TLS and endpoint checks apply to the SQL execution session.
