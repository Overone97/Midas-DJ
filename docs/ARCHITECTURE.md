# Architecture technique — Midas DJ v1.0.0

## Stack

### Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS

### Backend / données
- Supabase Auth
- Supabase Postgres
- Supabase Realtime
- Server actions / route handlers Next.js pour certaines opérations métier

### Media
- YouTube IFrame Player API

### Hébergement
- Vercel pour le front
- Supabase pour la couche data / auth / realtime

## Principes d’architecture

1. **Room-first** : l’état de room est le centre du système.
2. **Server authoritative** : le serveur décide de l’état officiel de playback.
3. **Client resilient** : les clients se resynchronisent automatiquement.
4. **Realtime pragmatique** : on commence simple, puis websocket dédié si nécessaire.

## Composants principaux

### 1. Frontend Web
Responsable de :
- authentification utilisateur ;
- affichage room / queue / chat ;
- intégration player YouTube ;
- émission et réception des événements realtime.

### 2. Couche Supabase
Responsable de :
- comptes utilisateurs ;
- stockage rooms / queue / messages / votes ;
- diffusion realtime des mutations importantes.

### 3. Couche métier Next.js
Responsable de :
- validation des actions ;
- calculs de rotation DJ ;
- transitions de playback ;
- permissions de modération.

## États critiques

### Playback state
Le playback state officiel doit contenir au minimum :
- room_id
- current_queue_item_id
- dj_user_id
- status (`playing`, `paused`, `ended`)
- started_at
- offset_seconds
- updated_at

### Pourquoi ce modèle
Au lieu d’essayer de synchroniser chaque lecteur au frame près, on conserve un **point de vérité serveur** :
- quel morceau joue ;
- à partir de quand ;
- avec quel offset.

Chaque client calcule ensuite localement la position attendue et se resynchronise si la dérive devient trop grande.

## Flux de synchro recommandé

1. Le serveur démarre un morceau avec un `started_at` officiel.
2. Les clients reçoivent l’événement realtime.
3. Chaque client charge la vidéo YouTube correspondante.
4. Chaque client calcule la position à jouer selon `now - started_at + offset_seconds`.
5. Si la dérive dépasse un seuil, le client seek automatiquement.

## Gestion du skip

- Les votes `skip` sont stockés par morceau.
- Un seuil configurable déclenche le skip.
- Le serveur clôture le morceau courant.
- Le serveur sélectionne le prochain item et met à jour `playback_state`.

## Gestion de la queue DJ

### Option MVP retenue
- Une file de DJs potentiels.
- Un seul DJ actif à la fois.
- Chaque morceau joué est associé à un DJ.
- En absence de morceau pour le DJ actif, le système passe au suivant.

### Pourquoi rester simple
Le piège classique, c’est de coder une logique de scène de concert avant même d’avoir validé la room. Le MVP doit rester compréhensible et robuste.

## Sécurité / permissions

### Rôles
- owner
- mod
- member

### Permissions minimales
- owner : contrôle total room
- mod : mute, kick, ban, skip forcé
- member : chat, vote, ajout de morceaux, entrée dans la file DJ

## Évolution probable après v1

Si Supabase Realtime devient limite :
- ajouter un service websocket dédié pour l’état room/playback ;
- garder Supabase comme persistance principale.

## Découpage technique conseillé

```text
src/
  app/
    page.tsx
    rooms/
    room/[slug]/
  components/
    room/
    player/
    chat/
    queue/
  lib/
    supabase/
    youtube/
    playback/
    permissions/
  types/
```

## Risques techniques majeurs

1. Drift de synchro entre clients
2. Variations de comportement du player YouTube
3. Conditions de course sur skip / next track
4. Rooms publiques sans modération suffisante

## Recommandation franche

Ne pas surconstruire au départ. On veut une room qui tient bien debout, pas une cathédrale distribuée pour 12 utilisateurs de test.
