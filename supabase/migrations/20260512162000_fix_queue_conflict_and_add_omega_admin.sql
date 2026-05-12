alter table public.profiles
  add column if not exists is_omega_admin boolean not null default false;

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
  streak_bonus_awarded boolean := false;
  daily_bonus_awarded boolean := false;
  can_manage_room boolean := false;
  can_report_track_end boolean := false;
  actor_is_omega boolean := false;
begin
  if actor_user_id is null then
    raise exception 'auth required';
  end if;

  if completion_reason not in ('completed', 'skipped') then
    raise exception 'invalid completion reason';
  end if;

  actor_is_omega := public.is_omega_admin(actor_user_id);

  select *
  into playback_row
  from public.playback_state
  where room_id = room_id_value
  for update;

  if playback_row.room_id is null then
    raise exception 'playback state missing';
  end if;

  select (
    actor_is_omega
    or actor_user_id = playback_row.dj_user_id
    or exists (
      select 1 from public.rooms where id = room_id_value and owner_id = actor_user_id
    )
  )
  into can_manage_room;

  select (
    can_manage_room
    or exists (
      select 1 from public.room_members where room_id = room_id_value and user_id = actor_user_id and is_banned = false
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

    if completion_reason = 'completed' and current_item.dj_user_id is not null then
      perform public.ensure_dj_stats(current_item.dj_user_id);
      select * into dj_row from public.dj_stats where user_id = current_item.dj_user_id;

      perform public.award_xp(
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

grant execute on function public.is_omega_admin(uuid) to authenticated;
grant execute on function public.advance_queue_and_award_xp(uuid, text, uuid) to authenticated;

update public.profiles p
set is_omega_admin = true,
    avatar_badge = 'crown',
    selected_skin_id = 'animal-dragon-club',
    equipped_accessory_ids = '{crown-gold,mic-handheld}',
    unlocked_skin_ids = '{animal-fox-neon,animal-dragon-club,game-pixel-adventurer,human-dj-booth,human-cyberpunk-vj}',
    unlocked_accessory_ids = '{hat-dj,crown-gold,glasses-neon,mic-handheld,guitar-neon,synth-mini,headphones-pro,royal-cape}',
    avatar_level = greatest(avatar_level, 99),
    avatar_xp = greatest(avatar_xp, public.xp_required_for_level(100))
from auth.users u
where u.id = p.id
  and lower(coalesce(u.email, '')) = 'overone97@gmail.com';

insert into public.user_progression (user_id, xp_total, level, xp_to_next)
select p.id, public.xp_required_for_level(100), 99, 0
from public.profiles p
join auth.users u on u.id = p.id
where lower(coalesce(u.email, '')) = 'overone97@gmail.com'
on conflict (user_id) do update
set xp_total = greatest(public.user_progression.xp_total, excluded.xp_total),
    level = greatest(public.user_progression.level, excluded.level),
    xp_to_next = 0;

insert into public.dj_stats (user_id, full_plays_count, received_woots_total, plays_without_skip_streak)
select p.id, 9999, 99999, 999
from public.profiles p
join auth.users u on u.id = p.id
where lower(coalesce(u.email, '')) = 'overone97@gmail.com'
on conflict (user_id) do update
set full_plays_count = greatest(public.dj_stats.full_plays_count, excluded.full_plays_count),
    received_woots_total = greatest(public.dj_stats.received_woots_total, excluded.received_woots_total),
    plays_without_skip_streak = greatest(public.dj_stats.plays_without_skip_streak, excluded.plays_without_skip_streak);
