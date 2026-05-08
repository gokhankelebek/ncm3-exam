-- Adds a short, human-typeable resume code to each attempt so students can
-- pause and continue from a different browser/device without authenticating.
--
-- Code format: 8 chars from a 32-char alphabet (no I/O/0/1 to avoid confusion).
-- Search space ~10^12 — collision-safe at school scale.

create or replace function public.gen_resume_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end
$$;

alter table public.attempts
  add column if not exists resume_code text;

-- Backfill existing rows with unique codes
do $$
declare
  r record;
begin
  for r in select id from public.attempts where resume_code is null loop
    update public.attempts set resume_code = public.gen_resume_code() where id = r.id;
  end loop;
end $$;

alter table public.attempts
  alter column resume_code set not null,
  alter column resume_code set default public.gen_resume_code();

create unique index if not exists attempts_resume_code_key
  on public.attempts(resume_code);
