create table if not exists public.user_progression (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  xp_total integer not null default 0 check (xp_total >= 0),
  level integer not null default 1 check (level >= 1),
  xp_to_next integer not null default 283 check (xp_to_next >= 0),
  last_presence_xp_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  room_id uuid references public.rooms (id) on delete cascade,
  queue_item_id uuid references public.queue_items (id) on delete cascade,
  action_type text not null check (action_type in ('woot', 'djFullPlay', 'receivedLike', 'presenceFiveMinutes', 'firstPlayOfDayBonus', 'threePlaysNoSkipBonus')),
  xp_amount integer not null check (xp_amount > 0),
  reason text not null,
  source_key text unique,
  xp_total_after integer not null default 0 check (xp_total_after >= 0),
  level_after integer not null default 1 check (level_after >= 1),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.dj_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  full_plays_count integer not null default 0 check (full_plays_count >= 0),
  received_woots_total integer not null default 0 check (received_woots_total >= 0),
  plays_without_skip_streak integer not null default 0 check (plays_without_skip_streak >= 0),
  last_played_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_progression_level_idx on public.user_progression (level desc, xp_total desc);
create index if not exists xp_events_user_created_idx on public.xp_events (user_id, created_at desc);
create index if not exists xp_events_room_created_idx on public.xp_events (room_id, created_at desc);
create index if not exists xp_events_action_created_idx on public.xp_events (action_type, created_at desc);
create index if not exists dj_stats_full_plays_idx on public.dj_stats (full_plays_count desc, received_woots_total desc);

alter table public.user_progression enable row level security;
alter table public.xp_events enable row level security;
alter table public.dj_stats enable row level security;

drop trigger if exists user_progression_set_timestamp on public.user_progression;
create trigger user_progression_set_timestamp
before update on public.user_progression
for each row
execute function public.set_timestamp();

drop trigger if exists dj_stats_set_timestamp on public.dj_stats;
create trigger dj_stats_set_timestamp
before update on public.dj_stats
for each row
execute function public.set_timestamp();

create or replace function public.xp_required_for_level(level integer)
returns integer
language sql
immutable
as $$
  select case
    when level <= 1 then 0
    else round(100 * power(level::numeric, 1.5))::integer
  end;
$$;

create or replace function public.ensure_user_progression(target_user_id uuid)
returns public.user_progression
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data public.user_progression;
begin
  insert into public.user_progression (user_id, xp_total, level, xp_to_next)
  values (
    target_user_id,
    coalesce((select avatar_xp from public.profiles where id = target_user_id), 0),
    greatest(coalesce((select avatar_level from public.profiles where id = target_user_id), 1), 1),
    greatest(public.xp_required_for_level(greatest(coalesce((select avatar_level from public.profiles where id = target_user_id), 1), 1) + 1) - coalesce((select avatar_xp from public.profiles where id = target_user_id), 0), 0)
  )
  on conflict (user_id) do update
  set xp_total = public.user_progression.xp_total
  returning * into row_data;

  return row_data;
end;
$$;

create or replace function public.ensure_dj_stats(target_user_id uuid)
returns public.dj_stats
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data public.dj_stats;
begin
  insert into public.dj_stats (user_id)
  values (target_user_id)
  on conflict (user_id) do update
  set user_id = excluded.user_id
  returning * into row_data;

  return row_data;
end;
$$;

create or replace function public.award_xp(
  target_user_id uuid,
  action_name text,
  amount integer,
  reason_text text,
  source_key_value text default null,
  room_id_value uuid default null,
  queue_item_id_value uuid default null
)
returns table (
  granted boolean,
  xp_total integer,
  level integer,
  xp_to_next integer,
  leveled_up boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_progress public.user_progression;
  next_xp integer;
  next_level integer;
  next_xp_to_next integer;
  previous_level integer;
begin
  if amount <= 0 then
    return query select false, coalesce((select xp_total from public.user_progression where user_id = target_user_id), 0), coalesce((select level from public.user_progression where user_id = target_user_id), 1), coalesce((select xp_to_next from public.user_progression where user_id = target_user_id), public.xp_required_for_level(2)), false;
    return;
  end if;

  perform public.ensure_user_progression(target_user_id);
  select * into current_progress from public.user_progression where user_id = target_user_id;

  if source_key_value is not null and exists (select 1 from public.xp_events where source_key = source_key_value) then
    return query select false, current_progress.xp_total, current_progress.level, current_progress.xp_to_next, false;
    return;
  end if;

  previous_level := current_progress.level;
  next_xp := current_progress.xp_total + amount;
  next_level := current_progress.level;

  while public.xp_required_for_level(next_level + 1) <= next_xp loop
    next_level := next_level + 1;
  end loop;

  next_xp_to_next := greatest(public.xp_required_for_level(next_level + 1) - next_xp, 0);

  update public.user_progression
  set xp_total = next_xp,
      level = next_level,
      xp_to_next = next_xp_to_next,
      updated_at = timezone('utc', now())
  where user_id = target_user_id;

  update public.profiles
  set avatar_xp = next_xp,
      avatar_level = next_level
  where id = target_user_id;

  insert into public.xp_events (
    user_id,
    room_id,
    queue_item_id,
    action_type,
    xp_amount,
    reason,
    source_key,
    xp_total_after,
    level_after
  ) values (
    target_user_id,
    room_id_value,
    queue_item_id_value,
    action_name,
    amount,
    reason_text,
    source_key_value,
    next_xp,
    next_level
  );

  return query select true, next_xp, next_level, next_xp_to_next, next_level > previous_level;
end;
$$;

create or replace function public.submit_room_reaction(
  room_id_value uuid,
  queue_item_id_value uuid,
  reaction_type text
)
returns table (
  current_reaction text,
  xp_total integer,
  level integer,
  xp_to_next integer,
  leveled_up boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  existing_reaction text;
  track_owner_id uuid;
  xp_row record;
begin
  if actor_user_id is null then
    raise exception 'auth required';
  end if;

  if reaction_type not in ('woot', 'grab', 'meh') then
    raise exception 'invalid reaction type';
  end if;

  if not exists (
    select 1
    from public.room_members
    where room_id = room_id_value
      and user_id = actor_user_id
      and is_banned = false
  ) and not exists (
    select 1 from public.rooms where id = room_id_value and owner_id = actor_user_id
  ) then
    raise exception 'not allowed in room';
  end if;

  select type into existing_reaction
  from public.votes
  where room_id = room_id_value
    and queue_item_id = queue_item_id_value
    and user_id = actor_user_id;

  if existing_reaction = reaction_type then
    delete from public.votes
    where room_id = room_id_value
      and queue_item_id = queue_item_id_value
      and user_id = actor_user_id;

    return query
    select null::text, progress.xp_total, progress.level, progress.xp_to_next, false
    from public.ensure_user_progression(actor_user_id) as progress;
    return;
  end if;

  delete from public.votes
  where room_id = room_id_value
    and queue_item_id = queue_item_id_value
    and user_id = actor_user_id;

  insert into public.votes (room_id, queue_item_id, user_id, type)
  values (room_id_value, queue_item_id_value, actor_user_id, reaction_type);

  if reaction_type = 'woot' then
    select * into xp_row
    from public.award_xp(
      actor_user_id,
      'woot',
      5,
      'Woot envoyé dans la room',
      format('woot:%s:%s', actor_user_id, queue_item_id_value),
      room_id_value,
      queue_item_id_value
    );

    select dj_user_id into track_owner_id
    from public.queue_items
    where id = queue_item_id_value;

    if track_owner_id is not null and track_owner_id <> actor_user_id then
      perform public.ensure_dj_stats(track_owner_id);
      update public.dj_stats
      set received_woots_total = received_woots_total + 1,
          updated_at = timezone('utc', now())
      where user_id = track_owner_id;

      perform public.award_xp(
        track_owner_id,
        'receivedLike',
        2,
        'Like reçu sur une diffusion',
        format('received_like:%s:%s:%s', track_owner_id, queue_item_id_value, actor_user_id),
        room_id_value,
        queue_item_id_value
      );
    end if;

    return query select reaction_type, xp_row.xp_total, xp_row.level, xp_row.xp_to_next, xp_row.leveled_up;
    return;
  end if;

  return query
  select reaction_type, progress.xp_total, progress.level, progress.xp_to_next, false
  from public.ensure_user_progression(actor_user_id) as progress;
end;
$$;

create or replace function public.claim_presence_xp(room_id_value uuid)
returns table (
  granted boolean,
  xp_total integer,
  level integer,
  xp_to_next integer,
  leveled_up boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  progress public.user_progression;
  xp_row record;
begin
  if actor_user_id is null then
    raise exception 'auth required';
  end if;

  if not exists (
    select 1
    from public.room_members
    where room_id = room_id_value
      and user_id = actor_user_id
      and is_banned = false
  ) and not exists (
    select 1 from public.rooms where id = room_id_value and owner_id = actor_user_id
  ) then
    raise exception 'not allowed in room';
  end if;

  select * into progress from public.ensure_user_progression(actor_user_id);

  if progress.last_presence_xp_at is not null and progress.last_presence_xp_at > timezone('utc', now()) - interval '5 minutes' then
    return query select false, progress.xp_total, progress.level, progress.xp_to_next, false;
    return;
  end if;

  select * into xp_row
  from public.award_xp(
    actor_user_id,
    'presenceFiveMinutes',
    3,
    'Présence active dans la room',
    format('presence:%s:%s', actor_user_id, to_char(date_trunc('minute', timezone('utc', now())) - ((extract(minute from timezone('utc', now()))::integer % 5) * interval '1 minute'), 'YYYYMMDDHH24MI')),
    room_id_value,
    null
  );

  update public.user_progression
  set last_presence_xp_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where user_id = actor_user_id;

  return query select xp_row.granted, xp_row.xp_total, xp_row.level, xp_row.xp_to_next, xp_row.leveled_up;
end;
$$;

create or replace function public.advance_queue_and_award_xp(
  room_id_value uuid,
  completion_reason text default 'completed'
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
begin
  if actor_user_id is null then
    raise exception 'auth required';
  end if;

  if completion_reason not in ('completed', 'skipped') then
    raise exception 'invalid completion reason';
  end if;

  select * into playback_row from public.playback_state where room_id = room_id_value;
  if playback_row.room_id is null then
    raise exception 'playback state missing';
  end if;

  if actor_user_id <> playback_row.dj_user_id and not exists (
    select 1 from public.rooms where id = room_id_value and owner_id = actor_user_id
  ) then
    raise exception 'not allowed to advance room';
  end if;

  if playback_row.current_queue_item_id is not null then
    select * into current_item from public.queue_items where id = playback_row.current_queue_item_id;
  end if;

  select * into next_item
  from public.queue_items
  where room_id = room_id_value
    and status in ('queued', 'playing')
    and position > coalesce(current_item.position, 0)
  order by position asc
  limit 1;

  if current_item.id is not null then
    update public.queue_items
    set status = case when completion_reason = 'completed' then 'played' else 'skipped' end,
        played_at = timezone('utc', now())
    where id = current_item.id;

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

  if next_item.id is null then
    update public.playback_state
    set current_queue_item_id = null,
        state = 'paused',
        started_at = null,
        offset_seconds = 0,
        updated_at = timezone('utc', now())
    where room_id = room_id_value;

    return query
    select current_item.id, null::uuid, 'paused'::text, current_item.dj_user_id, case when completion_reason = 'completed' then 20 else 0 end + case when daily_bonus_awarded then 15 else 0 end + case when streak_bonus_awarded then 25 else 0 end, coalesce((select level from public.user_progression where user_id = current_item.dj_user_id), 1);
    return;
  end if;

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
  select current_item.id, next_item.id, 'playing'::text, current_item.dj_user_id, case when completion_reason = 'completed' then 20 else 0 end + case when daily_bonus_awarded then 15 else 0 end + case when streak_bonus_awarded then 25 else 0 end, coalesce((select level from public.user_progression where user_id = current_item.dj_user_id), 1);
end;
$$;

create or replace function public.get_room_leaderboard(
  room_id_value uuid,
  leaderboard_tab text default 'best_listeners',
  leaderboard_limit integer default 50
)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  avatar_skin_id text,
  avatar_accessory_ids text[],
  level integer,
  score bigint
)
language sql
security definer
set search_path = public
as $$
  with room_users as (
    select rm.user_id
    from public.room_members rm
    where rm.room_id = room_id_value
    union
    select r.owner_id
    from public.rooms r
    where r.id = room_id_value
  ),
  listeners as (
    select
      p.id as user_id,
      p.username,
      p.selected_skin_id as avatar_skin_id,
      p.equipped_accessory_ids as avatar_accessory_ids,
      up.level,
      up.xp_total::bigint as score
    from public.user_progression up
    join public.profiles p on p.id = up.user_id
    where up.user_id in (select user_id from room_users)
  ),
  djs as (
    select
      p.id as user_id,
      p.username,
      p.selected_skin_id as avatar_skin_id,
      p.equipped_accessory_ids as avatar_accessory_ids,
      coalesce(up.level, 1) as level,
      ds.full_plays_count::bigint as score
    from public.dj_stats ds
    join public.profiles p on p.id = ds.user_id
    left join public.user_progression up on up.user_id = ds.user_id
    where ds.user_id in (select user_id from room_users)
  ),
  day_scores as (
    select
      p.id as user_id,
      p.username,
      p.selected_skin_id as avatar_skin_id,
      p.equipped_accessory_ids as avatar_accessory_ids,
      coalesce(up.level, 1) as level,
      coalesce(sum(xe.xp_amount), 0)::bigint as score
    from public.profiles p
    left join public.user_progression up on up.user_id = p.id
    left join public.xp_events xe on xe.user_id = p.id and xe.created_at >= timezone('utc', now()) - interval '24 hours'
    where p.id in (select user_id from room_users)
    group by p.id, p.username, p.selected_skin_id, p.equipped_accessory_ids, up.level
  ),
  week_scores as (
    select
      p.id as user_id,
      p.username,
      p.selected_skin_id as avatar_skin_id,
      p.equipped_accessory_ids as avatar_accessory_ids,
      coalesce(up.level, 1) as level,
      coalesce(sum(xe.xp_amount), 0)::bigint as score
    from public.profiles p
    left join public.user_progression up on up.user_id = p.id
    left join public.xp_events xe on xe.user_id = p.id and xe.created_at >= timezone('utc', now()) - interval '7 days'
    where p.id in (select user_id from room_users)
    group by p.id, p.username, p.selected_skin_id, p.equipped_accessory_ids, up.level
  ),
  chosen as (
    select * from listeners where leaderboard_tab = 'best_listeners'
    union all
    select * from djs where leaderboard_tab = 'best_djs'
    union all
    select * from day_scores where leaderboard_tab = 'top_day'
    union all
    select * from week_scores where leaderboard_tab = 'top_week'
  )
  select
    row_number() over (order by chosen.score desc, chosen.level desc, chosen.username asc) as rank,
    chosen.user_id,
    chosen.username,
    chosen.avatar_skin_id,
    chosen.avatar_accessory_ids,
    chosen.level,
    chosen.score
  from chosen
  order by rank
  limit greatest(1, least(leaderboard_limit, 50));
$$;

drop policy if exists "user progression readable by authenticated users" on public.user_progression;
create policy "user progression readable by authenticated users"
on public.user_progression
for select
to authenticated
using (true);

drop policy if exists "xp events readable by owner only" on public.xp_events;
create policy "xp events readable by owner only"
on public.xp_events
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "dj stats readable by authenticated users" on public.dj_stats;
create policy "dj stats readable by authenticated users"
on public.dj_stats
for select
to authenticated
using (true);

grant execute on function public.ensure_user_progression(uuid) to authenticated;
grant execute on function public.ensure_dj_stats(uuid) to authenticated;
grant execute on function public.award_xp(uuid, text, integer, text, text, uuid, uuid) to authenticated;
grant execute on function public.submit_room_reaction(uuid, uuid, text) to authenticated;
grant execute on function public.claim_presence_xp(uuid) to authenticated;
grant execute on function public.advance_queue_and_award_xp(uuid, text) to authenticated;
grant execute on function public.get_room_leaderboard(uuid, text, integer) to authenticated;
grant execute on function public.xp_required_for_level(integer) to authenticated;

insert into public.user_progression (user_id, xp_total, level, xp_to_next)
select p.id, p.avatar_xp, p.avatar_level, greatest(public.xp_required_for_level(p.avatar_level + 1) - p.avatar_xp, 0)
from public.profiles p
on conflict (user_id) do update
set xp_total = excluded.xp_total,
    level = excluded.level,
    xp_to_next = excluded.xp_to_next;

insert into public.dj_stats (user_id)
select p.id
from public.profiles p
on conflict (user_id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'xp_events'
  ) then
    execute 'alter publication supabase_realtime add table public.xp_events';
  end if;
end $$;