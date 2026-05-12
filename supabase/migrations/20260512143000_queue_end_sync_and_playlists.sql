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

create index if not exists user_playlist_items_user_id_idx on public.user_playlist_items (user_id, position);

alter table public.user_playlist_items enable row level security;

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

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_playlist_items'
  ) then
    execute 'alter publication supabase_realtime add table public.user_playlist_items';
  end if;
end $$;

drop function if exists public.advance_queue_and_award_xp(uuid, text);

create or replace function public.advance_queue_and_award_xp(
  room_id_value uuid,
  completion_reason text default 'completed',
  expected_queue_item_id uuid default null
)
returns table (
  previous_queue_item_id uuid,
  next_queue_item_id uuid,
  playback_state text,
  awarded_to_user_id uuid,
  awarded_xp integer,
  awarded_level integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  playback_row public.playback_state;
  current_item public.queue_items;
  next_item public.queue_items;
  dj_row public.dj_stats;
  xp_row record;
  streak_bonus_awarded boolean := false;
  daily_bonus_awarded boolean := false;
  can_manage_room boolean := false;
  can_report_track_end boolean := false;
begin
  if actor_user_id is null then
    raise exception 'auth required';
  end if;

  if completion_reason not in ('completed', 'skipped') then
    raise exception 'invalid completion reason';
  end if;

  select *
  into playback_row
  from public.playback_state
  where room_id = room_id_value
  for update;

  if playback_row.room_id is null then
    raise exception 'playback state missing';
  end if;

  select (
    actor_user_id = playback_row.dj_user_id
    or exists (
      select 1 from public.rooms where id = room_id_value and owner_id = actor_user_id
    )
  )
  into can_manage_room;

  select (
    can_manage_room
    or exists (
      select 1 from public.room_members where room_id = room_id_value and user_id = actor_user_id
    )
  )
  into can_report_track_end;

  if completion_reason = 'skipped' and not can_manage_room then
    raise exception 'not allowed to advance room';
  end if;

  if completion_reason = 'completed' and not can_report_track_end then
    raise exception 'not allowed to report track completion';
  end if;

  if playback_row.current_queue_item_id is not null then
    select *
    into current_item
    from public.queue_items
    where id = playback_row.current_queue_item_id
    for update;
  end if;

  if expected_queue_item_id is not null and current_item.id is distinct from expected_queue_item_id then
    return query
    select
      current_item.id,
      playback_row.current_queue_item_id,
      playback_row.state::text,
      null::uuid,
      0,
      coalesce((select level from public.user_progression where user_id = current_item.dj_user_id), 1);
    return;
  end if;

  if current_item.id is not null then
    update public.queue_items
    set status = case when completion_reason = 'completed' then 'played' else 'skipped' end,
        played_at = timezone('utc', now())
    where id = current_item.id;

    update public.queue_items
    set position = position - 1
    where room_id = room_id_value
      and status = 'queued'
      and position > current_item.position;

    if completion_reason = 'completed' and current_item.dj_user_id is not null then
      perform public.ensure_dj_stats(current_item.dj_user_id);
      select * into dj_row from public.dj_stats where user_id = current_item.dj_user_id;

      select * into xp_row
      from public.award_xp(
        current_item.dj_user_id,
        'djFullPlay',
        20,
        'Diffusion complète en tant que DJ',
        format('dj_full_play:%s', current_item.id),
        room_id_value,
        current_item.id
      );

      update public.dj_stats
      set full_plays_count = full_plays_count + 1,
          plays_without_skip_streak = plays_without_skip_streak + 1,
          last_played_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
      where user_id = current_item.dj_user_id;

      if not exists (
        select 1 from public.xp_events
        where user_id = current_item.dj_user_id
          and action_type = 'firstPlayOfDayBonus'
          and created_at >= date_trunc('day', timezone('utc', now()))
      ) then
        perform public.award_xp(
          current_item.dj_user_id,
          'firstPlayOfDayBonus',
          15,
          'Première diffusion de la journée',
          format('first_play_day:%s:%s', current_item.dj_user_id, to_char(timezone('utc', now()), 'YYYYMMDD')),
          room_id_value,
          current_item.id
        );
        daily_bonus_awarded := true;
      end if;

      select * into dj_row from public.dj_stats where user_id = current_item.dj_user_id;
      if dj_row.plays_without_skip_streak >= 3 then
        perform public.award_xp(
          current_item.dj_user_id,
          'threePlaysNoSkipBonus',
          25,
          format('3 diffusions consécutives sans skip (%s)', dj_row.plays_without_skip_streak),
          format('three_play_streak:%s:%s', current_item.dj_user_id, dj_row.plays_without_skip_streak),
          room_id_value,
          current_item.id
        );
        streak_bonus_awarded := true;
      end if;
    elsif current_item.dj_user_id is not null then
      perform public.ensure_dj_stats(current_item.dj_user_id);
      update public.dj_stats
      set plays_without_skip_streak = 0,
          updated_at = timezone('utc', now())
      where user_id = current_item.dj_user_id;
    end if;
  end if;

  select *
  into next_item
  from public.queue_items
  where room_id = room_id_value
    and status = 'queued'
  order by position asc
  limit 1
  for update;

  if next_item.id is null then
    update public.playback_state
    set current_queue_item_id = null,
        state = 'paused',
        started_at = null,
        offset_seconds = 0,
        updated_at = timezone('utc', now())
    where room_id = room_id_value;

    return query
    select
      current_item.id,
      null::uuid,
      'paused'::text,
      current_item.dj_user_id,
      case when completion_reason = 'completed' then 20 else 0 end
        + case when daily_bonus_awarded then 15 else 0 end
        + case when streak_bonus_awarded then 25 else 0 end,
      coalesce((select level from public.user_progression where user_id = current_item.dj_user_id), 1);
    return;
  end if;

  update public.queue_items
  set status = 'queued'
  where room_id = room_id_value
    and status = 'playing'
    and id <> next_item.id;

  update public.queue_items
  set status = 'playing'
  where id = next_item.id;

  update public.playback_state
  set current_queue_item_id = next_item.id,
      state = 'playing',
      started_at = timezone('utc', now()),
      offset_seconds = 0,
      updated_at = timezone('utc', now())
  where room_id = room_id_value;

  return query
  select
    current_item.id,
    next_item.id,
    'playing'::text,
    current_item.dj_user_id,
    case when completion_reason = 'completed' then 20 else 0 end
      + case when daily_bonus_awarded then 15 else 0 end
      + case when streak_bonus_awarded then 25 else 0 end,
    coalesce((select level from public.user_progression where user_id = current_item.dj_user_id), 1);
end;
$$;

grant execute on function public.advance_queue_and_award_xp(uuid, text, uuid) to authenticated;
