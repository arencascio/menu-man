-- Platform prerequisites for a clean Menu Man Supabase project.
-- Supabase normally provides pgcrypto already; this keeps local and hosted
-- bootstrap behavior explicit and idempotent.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

commit;
