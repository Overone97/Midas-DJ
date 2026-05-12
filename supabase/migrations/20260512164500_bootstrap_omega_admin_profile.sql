create or replace function public.bootstrap_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_username text;
  normalized_username text;
  next_user_id uuid := new.id;
  omega_admin boolean := lower(coalesce(new.email, '')) = 'overone97@gmail.com';
begin
  raw_username := coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'midas');
  normalized_username := lower(regexp_replace(raw_username, '[^a-zA-Z0-9]+', '-', 'g'));
  normalized_username := trim(both '-' from normalized_username);

  if normalized_username = '' then
    normalized_username := 'midas';
  end if;

  insert into public.profiles (
    id,
    username,
    is_omega_admin,
    avatar_badge,
    selected_skin_id,
    equipped_accessory_ids,
    unlocked_skin_ids,
    unlocked_accessory_ids,
    avatar_xp,
    avatar_level
  )
  values (
    next_user_id,
    left(normalized_username || '-' || substr(next_user_id::text, 1, 6), 30),
    omega_admin,
    case when omega_admin then 'crown' else 'none' end,
    case when omega_admin then 'animal-dragon-club' else 'animal-fox-neon' end,
    case when omega_admin then '{crown-gold,mic-handheld}'::text[] else '{headphones-pro}'::text[] end,
    case when omega_admin then '{animal-fox-neon,animal-dragon-club,game-pixel-adventurer,human-dj-booth,human-cyberpunk-vj}'::text[] else '{animal-fox-neon}'::text[] end,
    case when omega_admin then '{hat-dj,crown-gold,glasses-neon,mic-handheld,guitar-neon,synth-mini,headphones-pro,royal-cape}'::text[] else '{headphones-pro}'::text[] end,
    case when omega_admin then public.xp_required_for_level(100) else 0 end,
    case when omega_admin then 99 else 1 end
  )
  on conflict (id) do update
  set is_omega_admin = excluded.is_omega_admin,
      avatar_badge = case when excluded.is_omega_admin then 'crown' else public.profiles.avatar_badge end,
      selected_skin_id = case when excluded.is_omega_admin then 'animal-dragon-club' else public.profiles.selected_skin_id end,
      equipped_accessory_ids = case when excluded.is_omega_admin then '{crown-gold,mic-handheld}'::text[] else public.profiles.equipped_accessory_ids end,
      unlocked_skin_ids = case when excluded.is_omega_admin then '{animal-fox-neon,animal-dragon-club,game-pixel-adventurer,human-dj-booth,human-cyberpunk-vj}'::text[] else public.profiles.unlocked_skin_ids end,
      unlocked_accessory_ids = case when excluded.is_omega_admin then '{hat-dj,crown-gold,glasses-neon,mic-handheld,guitar-neon,synth-mini,headphones-pro,royal-cape}'::text[] else public.profiles.unlocked_accessory_ids end,
      avatar_xp = case when excluded.is_omega_admin then greatest(public.profiles.avatar_xp, public.xp_required_for_level(100)) else public.profiles.avatar_xp end,
      avatar_level = case when excluded.is_omega_admin then greatest(public.profiles.avatar_level, 99) else public.profiles.avatar_level end;

  insert into public.user_progression (user_id, xp_total, level, xp_to_next)
  values (
    next_user_id,
    case when omega_admin then public.xp_required_for_level(100) else 0 end,
    case when omega_admin then 99 else 1 end,
    case when omega_admin then 0 else greatest(public.xp_required_for_level(2), 0) end
  )
  on conflict (user_id) do update
  set xp_total = case when omega_admin then greatest(public.user_progression.xp_total, public.xp_required_for_level(100)) else public.user_progression.xp_total end,
      level = case when omega_admin then greatest(public.user_progression.level, 99) else public.user_progression.level end,
      xp_to_next = case when omega_admin then 0 else public.user_progression.xp_to_next end;

  insert into public.dj_stats (user_id, full_plays_count, received_woots_total, plays_without_skip_streak)
  values (
    next_user_id,
    case when omega_admin then 9999 else 0 end,
    case when omega_admin then 99999 else 0 end,
    case when omega_admin then 999 else 0 end
  )
  on conflict (user_id) do update
  set full_plays_count = case when omega_admin then greatest(public.dj_stats.full_plays_count, 9999) else public.dj_stats.full_plays_count end,
      received_woots_total = case when omega_admin then greatest(public.dj_stats.received_woots_total, 99999) else public.dj_stats.received_woots_total end,
      plays_without_skip_streak = case when omega_admin then greatest(public.dj_stats.plays_without_skip_streak, 999) else public.dj_stats.plays_without_skip_streak end;

  return new;
end;
$$;
