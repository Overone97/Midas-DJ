# Live stage v1 — audio fiable + avatars réactifs

## Contexte

Aujourd’hui, la scène live de Midas DJ repose surtout sur `src/components/sync-scene-player.tsx` avec une synchro YouTube agressive : `playVideo()` répété, `seekTo()` défensif, polling fréquent, et état audio global séparé dans `src/lib/audio-controller.ts`.

Résultat probable :
- coupures/pertes de son en boucle ;
- faux positifs de resync ;
- UI qui réagit à des signaux partiels ;
- base solide pour la scène, mais pas encore assez robuste pour vendre la fantasy plug.dj.

Le but de cette itération est simple : **arrêter les bugs audio avant de mettre du vernis partout**.

---

## Objectifs produit

1. Les avatars dansent vraiment selon l’état live.
2. Le son ne part plus en vrille au moindre drift.
3. Les signaux sociaux (`woot`, `grab`, `meh`) deviennent lisibles dans la scène.
4. La logique audio devient débogable, testable, et centralisée.

---

## Principes non négociables

### 1. Une seule source de vérité audio
L’UI, les avatars, les badges et les lumières lisent tous le même état : **`AudioEngineState`**.

### 2. Une seule instance de pilotage
Le player YouTube existe toujours, mais **n’est plus le cerveau**.

### 3. Pas de spam `playVideo()` / `seekTo()`
On resynchronise avec seuils, cooldowns et raison explicite. Pas au lance-flammes.

### 4. L’animation suit l’état, pas le chaos du player
Les avatars réagissent à des états stables (`idle`, `groove`, `hype`), pas à 15 callbacks qui se contredisent.

---

## État cible

```ts
type EnginePlaybackState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'buffering'
  | 'paused'
  | 'ended'
  | 'error';

type EngineHealth = 'ok' | 'stalled' | 'recovering' | 'failed';

type AudioEngineState = {
  roomId: string | null;
  trackId: string | null;
  youtubeVideoId: string | null;
  playbackState: EnginePlaybackState;
  health: EngineHealth;
  targetOffsetSeconds: number;
  actualOffsetSeconds: number;
  driftSeconds: number;
  volume: number;
  muted: boolean;
  hasUserGesture: boolean;
  lastProgressAt: number | null;
  lastSyncAt: number | null;
  recoveryAttempts: number;
  errorCode?: string;
  errorMessage?: string;
};
```

---

## Architecture visée

```text
Supabase playback_state / queue_items / votes
                  ↓
      LiveRoomPage (hydrate + realtime)
                  ↓
         AudioEngine store/service
                  ↓
      YouTube adapter / player bridge
                  ↓
    Scene UI / avatars / light FX / badges
```

### Découpage recommandé

- `src/lib/audio-engine.ts` → state machine + heartbeat + recovery
- `src/lib/youtube-audio-adapter.ts` → bridge vers l’IFrame API
- `src/components/sync-scene-player.tsx` → orchestration UI, plus cerveau
- `src/lib/audio-controller.ts` → soit absorbé, soit réduit au contrôle volume/mute

---

## Machine à états

### Transitions autorisées

```text
idle -> loading
loading -> ready
loading -> error
ready -> playing
ready -> paused
playing -> buffering
playing -> paused
playing -> ended
playing -> error
buffering -> playing
buffering -> paused
buffering -> error
paused -> playing
paused -> ended
paused -> error
ended -> loading
error -> loading
```

### Interdits

- `playing -> loading` sans changement de track
- plusieurs appels `play()` concurrents
- resync dur sans seuil documenté
- plusieurs composants qui écrivent dans l’état audio

---

## Détection de stall

### Heartbeat
Fréquence : **500 ms**.

À chaque tick :
- lire `currentTime` du player ;
- comparer à `lastKnownTime` ;
- mesurer le drift contre l’offset attendu ;
- vérifier si la progression avance réellement.

### Règles

Si :
- `playbackState === 'playing'`
- et la position n’avance plus depuis **1500 ms**
- et le player n’est pas explicitement en pause

Alors :
- passer en `buffering`
- marquer `health = 'stalled'`

Si `buffering` dure plus de **5000 ms** :
- lancer une recovery soft

Si 2 recoveries échouent :
- passer en `error`
- `health = 'failed'`

---

## Politique de resync

### Soft sync
Utilisée quand le drift est réel mais pas catastrophique.

- si drift > **1.8 s** en lecture normale ;
- si le player a repris après buffering ;
- si nouveau track chargé.

Action :
- `seekTo(expectedOffset)`
- cooldown de seek : **4 s** minimum sauf nouveau track

### Hard sync
Utilisée seulement :
- au chargement initial du morceau ;
- après recovery ;
- après changement officiel de track.

Action :
- load vidéo
- seek offset attendu
- reprise unique contrôlée

### Ce qu’on arrête

Le pattern actuel dans `sync-scene-player.tsx` où :
- on rejoue fréquemment si pas `PLAYING` ;
- on combine retry interval + sync interval + follow-up timeout ;
- on finit par provoquer plus de chaos que de stabilité.

---

## Recovery strategy

### Soft recovery
1. mémoriser `trackId` et `lastStableOffset`
2. repasser en `loading`
3. reload de la vidéo
4. seek au dernier offset stable
5. tentative unique de reprise

### Hard failure
Après 2 échecs :
- état `error`
- bannière discrète côté scène : `Le son a décroché. Retry.`
- bouton retry manuel

---

## Contrat UI

### Mapping audio -> avatar

```ts
type AvatarMood = 'idle' | 'groove' | 'hype';
```

| Audio engine | Avatar mood | Notes |
|---|---|---|
| `idle` | `idle` | rien ne joue |
| `loading` | `idle` | petite attente visuelle |
| `ready` | `idle` | scène prête |
| `playing` | `groove` | base normale |
| `playing` + burst social fort | `hype` | drop / burst woot / grab fort |
| `buffering` | `groove` ralenti | freeze léger, pas brutal |
| `paused` | `idle` | retour calme |
| `ended` | `idle` | fin de morceau |
| `error` | `idle` | feedback discret |

### États avatars MVP

Trois états suffisent :
- `idle`
- `groove`
- `hype`

Pas 12 variations maintenant. Ce serait du sucre avant de réparer le moteur.

---

## Grab / wants this track

Événement UI éphémère :

```ts
type SceneSocialEvent =
  | { type: 'grab'; userId: string; trackId: string; at: number }
  | { type: 'woot'; userId: string; trackId: string; at: number }
  | { type: 'meh'; userId: string; trackId: string; at: number };
```

### Rendu grab
- main levée ou geste de grab sur l’avatar ;
- badge `wants this track` ;
- affichage 2 à 4 secondes ;
- queue d’événements si rafale.

---

## Micro-effets lumière

### Woot
- pulse chaud ;
- petite hausse de glow/saturation ;
- 300 à 700 ms.

### Meh
- refroidissement bref ;
- baisse légère du glow ;
- 300 à 700 ms.

### Garde-fou
Subtil. Si ça clignote comme une boîte de nuit Wish, c’est raté.

---

## Observabilité

Logs requis :

```ts
[AUDIO] load_track { trackId, youtubeVideoId }
[AUDIO] ready
[AUDIO] play
[AUDIO] pause
[AUDIO] progress { actualOffsetSeconds, expectedOffsetSeconds, driftSeconds }
[AUDIO] buffering_start
[AUDIO] buffering_end
[AUDIO] stall_detected
[AUDIO] seek { reason, targetOffsetSeconds }
[AUDIO] recovery_attempt { attempt, fromOffsetSeconds }
[AUDIO] recovery_failed
[AUDIO] ended
[AUDIO] error { code, message }
```

Optionnel ensuite : panneau debug masqué en dev.

---

## Impact code actuel

### Fichiers directement touchés
- `src/components/sync-scene-player.tsx`
- `src/lib/audio-controller.ts`
- `src/components/scene-audio-control-bar.tsx`
- `src/components/avatar-display.tsx`
- `src/components/live-room-page.tsx`

### Refactor principal
Retirer de `SyncScenePlayer` :
- la majorité des refs `lastPlayAttemptRef`, `audioRetryRef`, `followUpSyncRef`, etc. du rôle de cerveau central ;
- la logique de sync/récupération dispersée.

Cette logique doit vivre dans `AudioEngine`.

---

## Critères d’acceptation

### Audio
- pas de double lecture ;
- pas de boucle de recovery infinie ;
- un stall réel passe par `buffering` puis recovery ;
- un faux drift mineur ne coupe pas le son ;
- un track change recharge proprement une seule fois.

### Avatars
- l’avatar DJ et la fosse bougent selon l’état live ;
- pas de flicker entre `idle` et `groove` ;
- `hype` ne s’active que sur signaux forts.

### Social FX
- un `grab` est visible immédiatement ;
- `woot/meh` modifient légèrement la scène ;
- rafale d’événements gérée sans spam visuel.

---

## Plan de livraison recommandé

### Phase 1 — Audio engine
- introduire `audio-engine.ts`
- brancher YouTube adapter
- centraliser play/pause/seek/recovery
- ajouter logs

### Phase 2 — Intégration scène
- brancher `SyncScenePlayer` sur l’engine
- exposer état stable à la barre audio
- supprimer les retries sauvages

### Phase 3 — Avatars live
- mapping `playbackState -> AvatarMood`
- mouvement fosse + DJ
- transitions fluides

### Phase 4 — Social polish
- badge grab
- main levée
- lumière woot/meh

---

## Verdict

La priorité, c’est **Phase 1**. Tant que le son bug, tout le reste est du rouge à lèvres sur un bug système.