-- Food tracker: initial schema with row level security (RLS).
-- Principle: private by default. A person's notes, ratings and visits are only
-- visible to others through a list they chose to share.
-- Works on Supabase (auth.uid(), roles anon/authenticated/service_role).

-- ---------------------------------------------------------------- types
create type public.place_status as enum ('want', 'visited', 'favourite', 'skip');
create type public.list_role as enum ('owner', 'editor', 'viewer');
create type public.recommendation_status as enum ('pending', 'accepted', 'dismissed');

-- ---------------------------------------------------------------- helpers
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  home_area text not null default '' check (char_length(home_area) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- create a profile automatically when someone signs up
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 80));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- places (shared catalogue)
-- One row per real-world restaurant, shared by everyone. Only the Google place
-- id is authoritative; name/cuisine are caches refreshed server side.
create table public.places (
  id uuid primary key default gen_random_uuid(),
  google_place_id text not null unique check (char_length(google_place_id) between 5 and 300),
  name_cache text not null default '' check (char_length(name_cache) <= 200),
  cuisine_tags text[] not null default '{}' check (cardinality(cuisine_tags) <= 12),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- user_places (private per person)
create table public.user_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete restrict,
  status public.place_status not null default 'want',
  notes text not null default '' check (char_length(notes) <= 4000),
  source_url text check (source_url is null or char_length(source_url) <= 1000),
  recommended_by text not null default '' check (char_length(recommended_by) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, place_id)
);
create index user_places_user_status_idx on public.user_places (user_id, status) where deleted_at is null;
create trigger user_places_updated before update on public.user_places
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- visits (private per person)
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete restrict,
  visited_on date not null default current_date,
  rating smallint check (rating between 1 and 5),
  dishes text not null default '' check (char_length(dishes) <= 2000),
  spend_inr integer check (spend_inr is null or spend_inr between 0 and 1000000),
  with_whom text not null default '' check (char_length(with_whom) <= 200),
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index visits_user_date_idx on public.visits (user_id, visited_on desc) where deleted_at is null;
create trigger visits_updated before update on public.visits
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- lists and membership
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger lists_updated before update on public.lists
  for each row execute function public.set_updated_at();

create table public.list_members (
  list_id uuid not null references public.lists (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.list_role not null,
  joined_at timestamptz not null default now(),
  primary key (list_id, user_id)
);
create index list_members_user_idx on public.list_members (user_id);
-- exactly one owner per list
create unique index list_members_one_owner_idx on public.list_members (list_id) where role = 'owner';

create table public.list_items (
  list_id uuid not null references public.lists (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete restrict,
  added_by uuid references auth.users (id) on delete set null,
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  primary key (list_id, place_id)
);

-- the list owner becomes a member automatically
create function public.add_owner_membership() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.list_members (list_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end $$;
create trigger lists_add_owner after insert on public.lists
  for each row execute function public.add_owner_membership();

-- ---------------------------------------------------------------- role helpers (security definer: avoid RLS recursion)
create function public.list_role_of(p_list uuid) returns public.list_role
language sql stable security definer set search_path = public as $$
  select role from public.list_members where list_id = p_list and user_id = auth.uid()
$$;

create function public.is_list_member(p_list uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.list_members where list_id = p_list and user_id = auth.uid())
$$;

create function public.is_list_editor(p_list uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.list_members
    where list_id = p_list and user_id = auth.uid() and role in ('owner', 'editor')
  )
$$;

create function public.is_list_owner(p_list uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.list_members
    where list_id = p_list and user_id = auth.uid() and role = 'owner'
  )
$$;

create function public.shares_list_with(p_other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.list_members me
    join public.list_members other on other.list_id = me.list_id
    where me.user_id = auth.uid() and other.user_id = p_other
  )
$$;

-- ---------------------------------------------------------------- invites (hashed tokens, created and accepted via functions only)
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  token_hash text not null unique,
  role public.list_role not null check (role in ('editor', 'viewer')),
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Returns the plaintext token ONCE; only a hash is stored.
create function public.create_invite(p_list uuid, p_role public.list_role, p_ttl_hours integer default 72)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.is_list_owner(p_list) then raise exception 'only the list owner can invite' using errcode = '42501'; end if;
  if p_role = 'owner' then raise exception 'cannot invite as owner' using errcode = '22023'; end if;
  if p_ttl_hours < 1 or p_ttl_hours > 720 then raise exception 'ttl must be 1-720 hours' using errcode = '22023'; end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.invites (list_id, token_hash, role, created_by, expires_at)
  values (p_list, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), p_role, auth.uid(),
          now() + make_interval(hours => p_ttl_hours));
  return v_token;
end $$;

create function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_inv public.invites;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into v_inv from public.invites
  where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  for update;
  if not found or v_inv.accepted_at is not null or v_inv.expires_at < now() then
    raise exception 'invalid or expired invite' using errcode = '22023';
  end if;
  insert into public.list_members (list_id, user_id, role)
  values (v_inv.list_id, auth.uid(), v_inv.role)
  on conflict (list_id, user_id) do nothing;
  update public.invites set accepted_by = auth.uid(), accepted_at = now() where id = v_inv.id;
  return v_inv.list_id;
end $$;

-- ---------------------------------------------------------------- recommendations
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  message text not null default '' check (char_length(message) <= 500),
  status public.recommendation_status not null default 'pending',
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);
create index recommendations_to_idx on public.recommendations (to_user, status);

-- ---------------------------------------------------------------- API usage quotas (cost control)
create table public.api_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  kind text not null check (kind in ('places_search', 'places_nearby', 'link_parse')),
  count integer not null default 0,
  primary key (user_id, day, kind)
);

-- Returns true if the call is allowed (and counts it), false if the daily cap is hit.
create function public.consume_quota(p_kind text, p_daily_limit integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  insert into public.api_usage (user_id, day, kind, count)
  values (auth.uid(), current_date, p_kind, 1)
  on conflict (user_id, day, kind) do update set count = public.api_usage.count + 1
  returning count into v_count;
  if v_count > p_daily_limit then
    update public.api_usage set count = p_daily_limit
    where user_id = auth.uid() and day = current_date and kind = p_kind;
    return false;
  end if;
  return true;
end $$;

-- ---------------------------------------------------------------- export my data (runs with caller's RLS)
create function public.export_my_data() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'user_places', coalesce((select jsonb_agg(to_jsonb(u)) from public.user_places u where u.user_id = auth.uid()), '[]'::jsonb),
    'visits', coalesce((select jsonb_agg(to_jsonb(v)) from public.visits v where v.user_id = auth.uid()), '[]'::jsonb),
    'lists_owned', coalesce((select jsonb_agg(to_jsonb(l)) from public.lists l where l.owner_id = auth.uid()), '[]'::jsonb)
  )
$$;

-- ================================================================ ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.user_places enable row level security;
alter table public.visits enable row level security;
alter table public.lists enable row level security;
alter table public.list_members enable row level security;
alter table public.list_items enable row level security;
alter table public.invites enable row level security;
alter table public.recommendations enable row level security;
alter table public.api_usage enable row level security;

-- profiles: see your own and people you share a list with; edit only your own
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_list_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- places: shared catalogue. Everyone signed in can read and add; nobody edits or deletes via the API.
create policy places_select on public.places for select to authenticated using (true);
create policy places_insert on public.places for insert to authenticated
  with check (created_by = auth.uid());

-- user_places and visits: strictly private to the owner
create policy user_places_all on public.user_places for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy visits_all on public.visits for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- lists
-- owner_id check is needed so `insert ... returning` works: the owner's membership
-- row is only added by an AFTER INSERT trigger, i.e. after RETURNING is evaluated.
create policy lists_select on public.lists for select to authenticated
  using (owner_id = auth.uid() or public.is_list_member(id));
create policy lists_insert on public.lists for insert to authenticated
  with check (owner_id = auth.uid());
create policy lists_update on public.lists for update to authenticated
  using (public.is_list_owner(id)) with check (public.is_list_owner(id) and owner_id = auth.uid());
create policy lists_delete on public.lists for delete to authenticated
  using (public.is_list_owner(id));

-- list_members: members see the roster; no direct inserts (use accept_invite / owner trigger).
-- The owner can remove people; anyone can leave (except the owner row).
create policy list_members_select on public.list_members for select to authenticated
  using (public.is_list_member(list_id));
create policy list_members_delete on public.list_members for delete to authenticated
  using (role <> 'owner' and (user_id = auth.uid() or public.is_list_owner(list_id)));
create policy list_members_update on public.list_members for update to authenticated
  using (public.is_list_owner(list_id) and role <> 'owner')
  with check (public.is_list_owner(list_id) and role <> 'owner');

-- list_items: members read; editors and the owner write
create policy list_items_select on public.list_items for select to authenticated
  using (public.is_list_member(list_id));
create policy list_items_insert on public.list_items for insert to authenticated
  with check (public.is_list_editor(list_id) and added_by = auth.uid());
create policy list_items_update on public.list_items for update to authenticated
  using (public.is_list_editor(list_id)) with check (public.is_list_editor(list_id));
create policy list_items_delete on public.list_items for delete to authenticated
  using (public.is_list_editor(list_id));

-- invites: only the list owner can see or revoke them; creation/acceptance via functions
create policy invites_select on public.invites for select to authenticated
  using (public.is_list_owner(list_id));
create policy invites_delete on public.invites for delete to authenticated
  using (public.is_list_owner(list_id));

-- recommendations: sender and recipient see them; you can only send to someone you share a list with
create policy recommendations_select on public.recommendations for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());
create policy recommendations_insert on public.recommendations for insert to authenticated
  with check (from_user = auth.uid() and public.shares_list_with(to_user));
create policy recommendations_update on public.recommendations for update to authenticated
  using (to_user = auth.uid()) with check (to_user = auth.uid());
create policy recommendations_delete on public.recommendations for delete to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

-- api_usage: you can read your own counters; writes only through consume_quota()
create policy api_usage_select on public.api_usage for select to authenticated
  using (user_id = auth.uid());

-- ================================================================ privileges (least privilege)
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon;

-- Column-level UPDATE grants stop clients from rewriting ownership or identity columns.
grant select on public.profiles to authenticated;
grant update (display_name, home_area) on public.profiles to authenticated;
grant select, insert on public.places to authenticated;
grant select, insert, delete on public.user_places, public.visits to authenticated;
grant update (status, notes, source_url, recommended_by, deleted_at) on public.user_places to authenticated;
grant update (visited_on, rating, dishes, spend_inr, with_whom, notes, deleted_at) on public.visits to authenticated;
grant select, insert, delete on public.lists to authenticated;
grant update (name) on public.lists to authenticated;
grant select, delete on public.list_members to authenticated;
grant update (role) on public.list_members to authenticated;
grant select, insert, delete on public.list_items to authenticated;
grant update (note) on public.list_items to authenticated;
grant select, delete on public.invites to authenticated;
grant select, insert, delete on public.recommendations to authenticated;
grant update (status) on public.recommendations to authenticated;
grant select on public.api_usage to authenticated;

grant execute on function public.list_role_of(uuid) to authenticated;
grant execute on function public.is_list_member(uuid) to authenticated;
grant execute on function public.is_list_editor(uuid) to authenticated;
grant execute on function public.is_list_owner(uuid) to authenticated;
grant execute on function public.shares_list_with(uuid) to authenticated;
grant execute on function public.create_invite(uuid, public.list_role, integer) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.consume_quota(text, integer) to authenticated;
grant execute on function public.export_my_data() to authenticated;
