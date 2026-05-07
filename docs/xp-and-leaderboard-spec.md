# XP and leaderboard system

## Goal

Ajouter une progression room-first, persistée côté serveur, anti-triche, et visible en temps réel dans l’interface.

---

## XP sources

| Action | XP |
|---|---:|
| Woot / like une musique | +5 |
| Diffusion complète en tant que DJ | +20 |
| Like reçu sur sa diffusion | +2 |
| Présence toutes les 5 minutes | +3 |
| Première diffusion du jour | +15 |
| 3 diffusions consécutives sans skip | +25 |

---

## Level curve

```ts
xpRequired(level) = 100 * level^1.5
```

Repères :
- niveau 1 = 0 XP
- niveau 2 ≈ 283 XP
- niveau 5 ≈ 1118 XP
- niveau 10 ≈ 3162 XP

---

## Unlocks

- niveau 2 → accès file DJ
- niveau 5 → skins rares
- niveau 10 → skins épiques
- niveau 15 → priorité rangée 1 dans la fosse
- niveau 20 → skins légendaires

---

## Server authority

### Règle absolue
Tous les gains XP doivent être calculés **côté serveur uniquement**.

Le client peut :
- afficher une toast ;
- afficher une barre de progression ;
- recevoir un événement temps réel.

Le client ne décide jamais :
- du montant ;
- du niveau ;
- du déblocage ;
- du score leaderboard.

---

## Tables recommandées

### `user_progression`
- `user_id`
- `xp_total`
- `level`
- `xp_to_next`
- `updated_at`

### `xp_events`
- `id`
- `user_id`
- `room_id`
- `queue_item_id`
- `action_type`
- `xp_amount`
- `reason`
- `created_at`

### `dj_stats`
- `user_id`
- `full_plays_count`
- `received_woots_total`
- `plays_without_skip_streak`
- `last_played_at`

### `leaderboard_snapshots` (optionnel plus tard)
- utile si on veut éviter des agrégations lourdes temps réel

---

## Leaderboard tabs

- `best_listeners`
- `best_djs`
- `top_day`
- `top_week`

### Limit
- 50 entrées max par onglet

### UI expectations
- top 3 avec médaille
- utilisateur courant surligné
- si hors top, entrée épinglée en bas
- mobile = modal plein écran
- desktop = panneau latéral rétractable

---

## Realtime events

Le serveur doit émettre des événements du genre :
- `xp_awarded`
- `level_up`
- `leaderboard_updated`

Le client écoute et met à jour :
- barre XP
- toast gain
- animation level-up
- leaderboard panel

---

## Recommended implementation path

1. migration DB progression/xp_events/dj_stats
2. fonctions serveur d’attribution XP
3. événements realtime progression
4. UI barre XP + toasts
5. panel leaderboard

---

## Honest recommendation

Ne pas coder le leaderboard en calcul client.
Ce serait joli 10 minutes et faux ensuite.