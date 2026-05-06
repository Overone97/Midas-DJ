alter table public.profiles
  add column if not exists avatar_species text not null default 'bunny',
  add column if not exists avatar_accessories text[] not null default '{headphones}',
  add column if not exists avatar_outfit_color text not null default 'purple',
  add column if not exists avatar_badge text not null default 'none';

alter table public.profiles
  add constraint profiles_avatar_species_check check (avatar_species in ('bunny', 'panda', 'bear', 'dragon', 'cat'));

alter table public.profiles
  add constraint profiles_avatar_outfit_color_check check (avatar_outfit_color in ('pink', 'gold', 'purple', 'cyan', 'emerald'));

alter table public.profiles
  add constraint profiles_avatar_badge_check check (avatar_badge in ('none', 'vip', 'mod', 'crown'));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'queue_items'
  ) then
    execute 'alter publication supabase_realtime add table public.queue_items';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'playback_state'
  ) then
    execute 'alter publication supabase_realtime add table public.playback_state';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_members'
  ) then
    execute 'alter publication supabase_realtime add table public.room_members';
  end if;
end $$;
