create table if not exists public.rooms (
  id uuid primary key,
  code text not null unique,
  title text not null,
  password text not null default '',
  has_password boolean not null default false,
  status text not null default 'waiting',
  host_id text not null,
  players jsonb not null default '[]'::jsonb,
  game_state jsonb,
  created_at bigint not null
);

alter table public.rooms
add column if not exists game_state jsonb;

alter table public.rooms enable row level security;

drop policy if exists "rooms_select_all" on public.rooms;
drop policy if exists "rooms_insert_all" on public.rooms;
drop policy if exists "rooms_update_all" on public.rooms;
drop policy if exists "rooms_delete_all" on public.rooms;

create policy "rooms_select_all"
on public.rooms for select
to anon
using (true);

create policy "rooms_insert_all"
on public.rooms for insert
to anon
with check (true);

create policy "rooms_update_all"
on public.rooms for update
to anon
using (true)
with check (true);

create policy "rooms_delete_all"
on public.rooms for delete
to anon
using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end $$;
