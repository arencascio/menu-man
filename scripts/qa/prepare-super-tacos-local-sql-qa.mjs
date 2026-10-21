// LOCAL ONLY: substitute environment guards to execute release logic on the
// disposable loopback database. Never use these derived files for a release.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const destination = process.argv[2];
if (!destination) throw new Error('Specify a local temporary output directory');
mkdirSync(destination, { recursive: true });
const sourceDir = 'supabase/releases/super-tacos-public';
const identity = /if current_setting\('menu_man\.release_project'\)[\s\S]*?then raise exception 'Exact Production identity and verified TLS required'; end if;/g;
const approval = [
  /if current_setting\('menu_man\.schema_approval'\)[\s\S]*?then raise exception 'Separate schema approval and verified backup SHA required'; end if;/g,
  /if current_setting\('menu_man\.release_approval'\)[\s\S]*?then raise exception 'Separate approval, verified backup SHA and fresh baseline required'; end if;/g,
];
const localIdentity = "if current_database() !~ '^menu_man_gate_a4(_[a-z]+)?$' or current_user <> 'localqa' then raise exception 'Local QA database identity required'; end if;";
for (const name of ['schema-prep', 'schema-verify', 'preflight', 'content', 'verify']) {
  const input = readFileSync(join(sourceDir, `${name}.sql`));
  let text = input.toString('utf8');
  const matches = [...text.matchAll(identity)];
  if (matches.length !== 1) throw new Error(`${name}: expected exactly one Production identity guard`);
  text = text.replace(identity, () => localIdentity);
  for (const expression of approval) {
    const count = [...text.matchAll(expression)].length;
    if (count > 1) throw new Error(`${name}: ambiguous approval guard (${count})`);
    if (count) text = text.replace(expression, "if current_setting('menu_man.local_qa') <> 'isolated-only' then raise exception 'Local QA marker required'; end if;");
  }
  // Marker remains local and cannot be confused with a Production approval.
  text = text.replace(/(begin isolation level serializable read (?:write|only);)/,
    "$1\nselect set_config('menu_man.local_qa','isolated-only',true);");
  const output = Buffer.from(text, 'utf8');
  writeFileSync(join(destination, `${name}.sql`), output);
  const hash = value => createHash('sha256').update(value).digest('hex');
  console.log(`${name}: original ${hash(input)} local-copy ${hash(output)}`);
}
