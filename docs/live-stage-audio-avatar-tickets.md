# Tickets — live stage audio + avatars

## Epic
Stabiliser le moteur audio live de la scène Midas DJ, puis brancher dessus les avatars dansants, le grab badge et les micro-FX Woot/Meh.

---

## T1 — Créer un AudioEngine central

**But**  
Sortir la logique de sync/retry/recovery de `SyncScenePlayer`.

**À faire**
- créer `src/lib/audio-engine.ts`
- définir `AudioEngineState`, actions, transitions et listeners
- exposer une API unique :
  - `loadTrack(track, playback)`
  - `play()`
  - `pause()`
  - `stop()`
  - `syncToPlayback(playback)`
  - `retry()`
- ajouter un store observable pour React

**Critères d’acceptation**
- l’état audio peut être lu sans toucher directement au player YouTube
- aucune écriture concurrente depuis plusieurs composants
- la machine à états refuse les transitions invalides

**Risques**
- laisser `audio-controller.ts` continuer à piloter le playback en parallèle

---

## T2 — Créer un adaptateur YouTube isolé

**But**  
Encapsuler l’IFrame API pour arrêter de la laisser fuiter partout.

**À faire**
- créer `src/lib/youtube-audio-adapter.ts`
- wrapper :
  - `load(videoId, startSeconds)`
  - `play()`
  - `pause()`
  - `seek(seconds)`
  - `mute()` / `unmute()`
  - `setVolume(volume)`
  - `getCurrentTime()`
  - `getPlayerState()`
- remonter les événements utiles sous forme normalisée

**Critères d’acceptation**
- `sync-scene-player.tsx` ne manipule plus directement l’API YouTube brute sauf montage du host
- les codes d’état YouTube sont traduits en événements métier

---

## T3 — Ajouter un heartbeat anti-stall

**But**  
Détecter les vraies coupures audio sans sur-réagir au moindre micro drift.

**À faire**
- tick toutes les 500 ms dans l’engine
- stocker `lastProgressAt`, `lastKnownTime`, `driftSeconds`
- si `playing` sans progression > 1500 ms → `buffering`
- si `buffering` > 5000 ms → recovery soft

**Critères d’acceptation**
- un stall réel est détecté
- un simple délai d’API ou micro drift ne déclenche pas 15 retries

---

## T4 — Remplacer les retries agressifs actuels

**But**  
Supprimer le comportement “je spam `playVideo()` jusqu’à ce que ça craque”.

**À faire**
- retirer ou réduire fortement dans `src/components/sync-scene-player.tsx` :
  - `audioRetryRef`
  - `lastPlayAttemptRef`
  - `followUpSyncRef`
  - partie de `syncPlayer()` qui force trop souvent replay/seek
- déléguer ces décisions à l’engine

**Critères d’acceptation**
- une seule politique de retry existe
- les resync sont tracés avec une raison explicite

---

## T5 — Brancher la barre son sur l’engine

**But**  
Faire de `scene-audio-control-bar.tsx` une UI, pas une télécommande sauvage.

**À faire**
- brancher `Play`, `Stop`, `Mute` sur l’engine
- exposer l’état `playing/buffering/paused/error`
- afficher un mini statut lisible

**Critères d’acceptation**
- la barre n’appelle plus des commandes concurrentes hors engine
- l’utilisateur voit quand le son bufferise ou plante

---

## T6 — Définir le mapping avatars live

**But**  
Faire danser les avatars avec une logique propre et stable.

**À faire**
- créer `AvatarMood = 'idle' | 'groove' | 'hype'`
- mapper `AudioEngineState` vers `AvatarMood`
- ajouter un debounce léger sur les changements d’état visuels

**Critères d’acceptation**
- avatar DJ et fosse bougent quand ça joue
- pas de clignotement entre deux états

---

## T7 — Animer la fosse selon l’état live

**But**  
Faire vivre les listeners sans usine à gaz.

**À faire**
- faire varier amplitude/vitesse des classes d’anim selon `AvatarMood`
- prévoir un rendu `buffering` ralenti
- garder la fosse lisible même avec peu de monde

**Critères d’acceptation**
- `playing` = mouvement perceptible
- `buffering` = ralentissement élégant
- `paused/error` = retour calme

---

## T8 — Ajouter le badge grab / wants this track

**But**  
Rendre le `grab` visible et socialement fun.

**À faire**
- transformer les votes `grab` en `SceneSocialEvent`
- afficher un badge `wants this track`
- ajouter une animation courte de main levée/grab
- TTL 2 à 4 secondes

**Critères d’acceptation**
- un grab apparaît immédiatement sur l’avatar concerné ou dans la fosse
- plusieurs grabs rapprochés ne cassent pas l’UI

---

## T9 — Ajouter les micro-effets lumière Woot/Meh

**But**  
Donner du feedback d’ambiance sans transformer la scène en sapin épileptique.

**À faire**
- pulse chaud sur `woot`
- refroidissement léger sur `meh`
- burst detector simple pour déclencher `hype` au-delà d’un seuil

**Critères d’acceptation**
- effet visible mais subtil
- plusieurs votes rapprochés intensifient un peu le rendu

---

## T10 — Ajouter logs et panneau debug dev

**But**  
Rendre enfin les bugs audio traçables au lieu d’exorciser du vent.

**À faire**
- logger : load, ready, play, pause, seek, stall, buffering, recovery, ended, error
- option dev pour afficher :
  - état engine
  - offset attendu
  - offset réel
  - drift
  - nombre de recoveries

**Critères d’acceptation**
- on peut reproduire un bug et comprendre ce qui s’est passé
- pas besoin de relire 8 hooks pour deviner la cause

---

## Ordre recommandé

1. T1 AudioEngine
2. T2 Adaptateur YouTube
3. T3 Heartbeat anti-stall
4. T4 Suppression des retries agressifs
5. T5 Barre son branchée proprement
6. T6 Mapping avatars
7. T7 Fosse live
8. T8 Grab badge
9. T9 FX Woot/Meh
10. T10 Debug panel

---

## Découpage PR recommandé

### PR 1
- T1
- T2
- T3
- T4

### PR 2
- T5
- T6
- T7

### PR 3
- T8
- T9
- T10

Oui, on peut tout balancer d’un coup. Non, ce n’est pas une bonne idée.