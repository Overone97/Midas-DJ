# Modèle de données initial — Midas DJ v1.1.0

## profiles
- id
- username
- avatar_url
- bio
- created_at
- updated_at

## rooms
- id
- name
- slug
- type (`public` | `private`)
- description
- cover_image_url
- owner_id
- created_at
- updated_at

## room_members
- room_id
- user_id
- role (`owner` | `mod` | `member`)
- joined_at
- is_banned
- is_muted

## dj_queue
- id
- room_id
- user_id
- position
- joined_at
- active

## queue_items
- id
- room_id
- added_by
- dj_user_id
- youtube_video_id
- title
- thumbnail_url
- duration_seconds
- position
- status (`queued` | `playing` | `played` | `skipped`)
- created_at
- played_at

## playback_state
- room_id
- current_queue_item_id
- dj_user_id
- state (`playing` | `paused` | `ended`)
- started_at
- offset_seconds
- updated_at

## votes
- id
- room_id
- queue_item_id
- user_id
- type (`like` | `skip`)
- created_at

## messages
- id
- room_id
- user_id
- content
- created_at
- deleted_at

## moderation_events
- id
- room_id
- target_user_id
- actor_user_id
- action (`mute` | `unmute` | `kick` | `ban` | `unban` | `force_skip`)
- reason
- created_at

## Remarques
- `profiles` complète `auth.users` côté produit.
- `playback_state` reste la source de vérité du player.
- `queue_items` garde l’historique d’état des morceaux.
- `dj_queue` reste volontairement simple en v1.
- Le SQL concret vit dans `supabase/schema.sql`.
