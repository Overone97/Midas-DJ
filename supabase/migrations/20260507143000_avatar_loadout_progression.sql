alter table public.profiles
  add column if not exists selected_skin_id text not null default 'animal-fox-neon',
  add column if not exists equipped_accessory_ids text[] not null default '{headphones-pro}',
  add column if not exists unlocked_skin_ids text[] not null default '{animal-fox-neon}',
  add column if not exists unlocked_accessory_ids text[] not null default '{headphones-pro}',
  add column if not exists avatar_xp integer not null default 0 check (avatar_xp >= 0),
  add column if not exists avatar_level integer not null default 1 check (avatar_level >= 1);

update public.profiles
set
  selected_skin_id = coalesce(nullif(selected_skin_id, ''), case avatar_species
    when 'dragon' then 'animal-dragon-club'
    else 'animal-fox-neon'
  end),
  equipped_accessory_ids = case
    when array_length(equipped_accessory_ids, 1) is not null then equipped_accessory_ids
    else array_remove(array[
      case when 'crown' = any(avatar_accessories) then 'crown-gold' end,
      case when 'glasses' = any(avatar_accessories) then 'glasses-neon' end,
      case when 'hat' = any(avatar_accessories) then 'hat-dj' end,
      case when 'headphones' = any(avatar_accessories) then 'headphones-pro' end
    ], null)
  end,
  unlocked_skin_ids = case
    when array_length(unlocked_skin_ids, 1) is not null then unlocked_skin_ids
    else array[coalesce(nullif(selected_skin_id, ''), case avatar_species when 'dragon' then 'animal-dragon-club' else 'animal-fox-neon' end)]
  end,
  unlocked_accessory_ids = case
    when array_length(unlocked_accessory_ids, 1) is not null then unlocked_accessory_ids
    else coalesce(
      case
        when array_length(equipped_accessory_ids, 1) is not null then equipped_accessory_ids
        else array_remove(array[
          case when 'crown' = any(avatar_accessories) then 'crown-gold' end,
          case when 'glasses' = any(avatar_accessories) then 'glasses-neon' end,
          case when 'hat' = any(avatar_accessories) then 'hat-dj' end,
          case when 'headphones' = any(avatar_accessories) then 'headphones-pro' end
        ], null)
      end,
      '{}'::text[]
    )
  end,
  avatar_xp = greatest(coalesce(avatar_xp, 0), 0),
  avatar_level = greatest(coalesce(avatar_level, 1), 1);

update public.profiles
set equipped_accessory_ids = '{headphones-pro}'
where coalesce(array_length(equipped_accessory_ids, 1), 0) = 0;

update public.profiles
set unlocked_accessory_ids = equipped_accessory_ids
where coalesce(array_length(unlocked_accessory_ids, 1), 0) = 0;

update public.profiles
set unlocked_skin_ids = array[selected_skin_id]
where coalesce(array_length(unlocked_skin_ids, 1), 0) = 0;