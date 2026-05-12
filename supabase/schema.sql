create extension if not exists "pgcrypto";

create or replace function public.set_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.bootstrap_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_username text;
  normalized_username text;
begin
  raw_username := coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'midas');
  normalized_username := lower(regexp_replace(raw_username, '[^a-zA-Z0-9]+', '-', 'g'));
  normalized_username := trim(both '-' from normalized_username);

  if normalized_username = '' then
    normalized_username := 'midas';
  end if;

  insert into public.profiles (id, username)
  values (new.id, left(normalized_username || '-' || substr(new.id::text, 1, 6), 30))
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.is_omega_admin(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p.id = target_user_id
      and (
        p.is_omega_admin = true
        or lower(coalesce(u.email, '')) = 'overone97@gmail.com'
      )
  );
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  is_omega_admin boolean not null default false,
  avatar_url text,
  avatar_species text not null default 'bunny' check (avatar_species in ('bunny', 'panda', 'bear', 'dragon', 'cat')),
  avatar_accessories text[] not null default '{headphones}',
  avatar_outfit_color text not null default 'purple' check (avatar_outfit_color in ('pink', 'gold', 'purple', 'cyan', 'emerald')),
  avatar_badge text not null default 'none' check (avatar_badge in ('none', 'vip', 'mod', 'crown')),
  selected_skin_id text not null default 'animal-fox-neon',
  equipped_accessory_ids text[] not null default '{headphones-pro}',
  unlocked_skin_ids text[] not null default '{animal-fox-neon}',
  unlocked_accessory_ids text[] not null default '{headphones-pro}',
  avatar_xp integer not null default 0 check (avatar_xp >= 0),
  avatar_level integer not null default 1 check (avatar_level >= 1),
  bio text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  type text not null check (type in ('public', 'private')),
  description text,
  cover_image_url text,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'mod', 'member')),
  joined_at timestamptz not null default timezone('utc', now()),
  is_banned boolean not null default false,
  is_muted boolean not null default false,
  primary key (room_id, user_id)
);

create table if not exists public.dj_queue (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  position integer not null,
  joined_at timestamptz not null default timezone('utc', now()),
  active boolean not null default true,
  unique (room_id, position)
);

create table if not exists public.queue_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  added_by uuid not null references public.profiles (id) on delete cascade,
  dj_user_id uuid references public.profiles (id) on delete set null,
  youtube_video_id text not null,
  title text not null,
  thumbnail_url text,
  duration_seconds integer not null default 0,
  position integer not null,
  status text not null default 'queued' check (status in ('queued', 'playing', 'played', 'skipped')),
  created_at timestamptz not null default timezone('utc', now()),
  played_at timestamptz,
  unique (room_id, position)
);

create table if not exists public.playback_state (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  current_queue_item_id uuid references public.queue_items (id) on delete set null,
  dj_user_id uuid references public.profiles (id) on delete set null,
  state text not null default 'paused' check (state in ('playing', 'paused', 'ended')),
  started_at timestamptz,
  offset_seconds numeric(8,2) not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  queue_item_id uuid not null references public.queue_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('woot', 'grab', 'meh')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (queue_item_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.user_playlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  youtube_video_id text not null,
  title text not null,
  thumbnail_url text,
  duration_seconds integer not null default 0,
  position integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, position)
);

create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  target_user_id uuid references public.profiles (id) on delete set null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('mute', 'unmute', 'kick', 'ban', 'unban', 'force_skip')),
  reason text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists rooms_owner_id_idx on public.rooms (owner_id);
create index if not exists room_members_user_id_idx on public.room_members (user_id);
create index if not exists dj_queue_room_id_idx on public.dj_queue (room_id, active, position);
create index if not exists queue_items_room_id_idx on public.queue_items (room_id, status, position);
create index if not exists votes_room_item_idx on public.votes (room_id, queue_item_id);
create index if not exists messages_room_id_idx on public.messages (room_id, created_at desc);
create index if not exists user_playlist_items_user_id_idx on public.user_playlist_items (user_id, position);
create index if not exists moderation_events_room_id_idx on public.moderation_events (room_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.dj_queue enable row level security;
alter table public.queue_items enable row level security;
alter table public.playback_state enable row level security;
alter table public.votes enable row level security;
alter table public.messages enable row level security;
alter table public.user_playlist_items enable row level security;
alter table public.moderation_events enable row level security;

drop trigger if exists profiles_set_timestamp on public.profiles;
create trigger profiles_set_timestamp
before update on public.profiles
for each row
execute function public.set_timestamp();

drop trigger if exists rooms_set_timestamp on public.rooms;
create trigger rooms_set_timestamp
before update on public.rooms
for each row
execute function public.set_timestamp();

drop trigger if exists playback_state_set_timestamp on public.playback_state;
create trigger playback_state_set_timestamp
before update on public.playback_state
for each row
execute function public.set_timestamp();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.bootstrap_profile();

drop policy if exists "profiles are readable by authenticated users" on public.profiles;
create policy "profiles are readable by authenticated users"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "users manage their own profile" on public.profiles;
create policy "users manage their own profile"
on public.profiles
for all
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "public rooms are visible and authenticated users can inspect more" on public.rooms;
create policy "public rooms are visible and authenticated users can inspect more"
on public.rooms
for select
to anon, authenticated
using (type = 'public' or auth.role() = 'authenticated');

drop policy if exists "authenticated users can create their rooms" on public.rooms;
create policy "authenticated users can create their rooms"
on public.rooms
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "owners can update their rooms" on public.rooms;
create policy "owners can update their rooms"
on public.rooms
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "owners can delete their rooms" on public.rooms;
create policy "owners can delete their rooms"
on public.rooms
for delete
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "members can read their memberships" on public.room_members;
create policy "members can read their memberships"
on public.room_members
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.rooms
    where rooms.id = room_members.room_id
      and rooms.owner_id = auth.uid()
  )
);

drop policy if exists "authenticated users can join themselves" on public.room_members;
create policy "authenticated users can join themselves"
on public.room_members
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "members can leave their own rooms" on public.room_members;
create policy "members can leave their own rooms"
on public.room_members
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "queue visible to authenticated users" on public.dj_queue;
create policy "queue visible to authenticated users"
on public.dj_queue
for select
to authenticated
using (true);

drop policy if exists "queue items visible to authenticated users" on public.queue_items;
create policy "queue items visible to authenticated users"
on public.queue_items
for select
to authenticated
using (true);

drop policy if exists "members can add queue items" on public.queue_items;
create policy "members can add queue items"
on public.queue_items
for insert
to authenticated
with check (
  auth.uid() = added_by
  and (
    exists (
      select 1 from public.room_members
      where room_members.room_id = queue_items.room_id
        and room_members.user_id = auth.uid()
        and room_members.is_banned = false
    )
    or exists (
      select 1 from public.rooms
      where rooms.id = queue_items.room_id
        and rooms.owner_id = auth.uid()
    )
  )
);

drop policy if exists "playback visible to authenticated users" on public.playback_state;
create policy "playback visible to authenticated users"
on public.playback_state
for select
to authenticated
using (true);

drop policy if exists "members can insert playback state" on public.playback_state;
create policy "members can insert playback state"
on public.playback_state
for insert
to authenticated
with check (
  (auth.uid() = dj_user_id or public.is_omega_admin(auth.uid()))
  and exists (
    select 1 from public.room_members
    where room_members.room_id = playback_state.room_id
      and room_members.user_id = auth.uid()
      and room_members.is_banned = false
  )
);

drop policy if exists "dj can update playback state" on public.playback_state;
create policy "dj can update playback state"
on public.playback_state
for update
to authenticated
using (auth.uid() = dj_user_id or public.is_omega_admin(auth.uid()))
with check (auth.uid() = dj_user_id or public.is_omega_admin(auth.uid()));

drop policy if exists "votes visible to authenticated users" on public.votes;
create policy "votes visible to authenticated users"
on public.votes
for select
to authenticated
using (true);

drop policy if exists "members can react to tracks" on public.votes;
create policy "members can react to tracks"
on public.votes
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    exists (
      select 1 from public.room_members
      where room_members.room_id = votes.room_id
        and room_members.user_id = auth.uid()
        and room_members.is_banned = false
    )
    or exists (
      select 1 from public.rooms
      where rooms.id = votes.room_id
        and rooms.owner_id = auth.uid()
    )
  )
);

drop policy if exists "users can remove their reactions" on public.votes;
create policy "users can remove their reactions"
on public.votes
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "messages visible to authenticated users" on public.messages;
create policy "messages visible to authenticated users"
on public.messages
for select
to authenticated
using (true);

drop policy if exists "users can read their playlist items" on public.user_playlist_items;
create policy "users can read their playlist items"
on public.user_playlist_items
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users can insert their playlist items" on public.user_playlist_items;
create policy "users can insert their playlist items"
on public.user_playlist_items
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "users can update their playlist items" on public.user_playlist_items;
create policy "users can update their playlist items"
on public.user_playlist_items
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can delete their playlist items" on public.user_playlist_items;
create policy "users can delete their playlist items"
on public.user_playlist_items
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "members can send messages" on public.messages;
create policy "members can send messages"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    exists (
      select 1 from public.room_members
      where room_members.room_id = messages.room_id
        and room_members.user_id = auth.uid()
        and room_members.is_banned = false
        and room_members.is_muted = false
    )
    or exists (
      select 1 from public.rooms
      where rooms.id = messages.room_id
        and rooms.owner_id = auth.uid()
    )
  )
);

drop policy if exists "moderation events visible to authenticated users" on public.moderation_events;
create policy "moderation events visible to authenticated users"
on public.moderation_events
for select
to authenticated
using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'queue_items'
  ) then
    execute 'alter publication supabase_realtime add table public.queue_items';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'playback_state'
  ) then
    execute 'alter publication supabase_realtime add table public.playback_state';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_members'
  ) then
    execute 'alter publication supabase_realtime add table public.room_members';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'votes'
  ) then
    execute 'alter publication supabase_realtime add table public.votes';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_playlist_items'
  ) then
    execute 'alter publication supabase_realtime add table public.user_playlist_items';
  end if;
end $$;
