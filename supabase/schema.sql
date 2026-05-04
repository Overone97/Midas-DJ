create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  avatar_url text,
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
  type text not null check (type in ('like', 'skip')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (queue_item_id, user_id, type)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
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
create index if not exists moderation_events_room_id_idx on public.moderation_events (room_id, created_at desc);
