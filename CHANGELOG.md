# Changelog

## [1.6.37] - 2026-05-07

### Added
- Migration Supabase pour persister `selected_skin_id`, `equipped_accessory_ids`, inventaires débloqués, `avatar_xp` et `avatar_level`
- Mapping de compatibilité entre l’ancien avatar editor et le nouveau modèle de loadout

### Changed
- Les hydrations room/chat/queue/members relisent maintenant les vrais champs avatar depuis `profiles`
- Le layout global du site et les colonnes room prennent plus de largeur sur grand écran

## [1.6.36] - 2026-05-07

### Added
- Fondation `avatar-catalog` pour préparer un vrai système de skins, rareté, accessoires et loadouts
- Helpers `xp` et `leaderboard` pour structurer la progression et le classement avant branchement serveur
- Specs détaillées pour le système avatars/pit et le futur système XP/leaderboard

### Changed
- La fosse live s’appuie maintenant sur un layout à slots fixes orienté plug.dj, prêt à monter jusqu’à 44 places audience

## [1.6.35] - 2026-05-07

### Changed
- Les réactions live conservent maintenant une vue par utilisateur pour piloter la scène, pas seulement des compteurs globaux
- La fosse aligne mieux les avatars côte à côte pour se rapprocher de l’énergie plug.dj

### Added
- États visuels d’avatar `idle / groove / hype`
- Danse individuelle des avatars quand leur joueur fait un `Woot`
- Main levée + badge sur `Grab` pour rendre l’intention visible directement dans la fosse

## [1.6.34] - 2026-05-07

### Added
- Table `votes` ajoutée à la publication `supabase_realtime` pour que les réactions remontent enfin en live sans refresh

### Fixed
- Recalage playback relancé quand le player devient réellement prêt, pour mieux aligner un utilisateur qui rejoint une room déjà en cours
- Chat room qui re-scroll automatiquement sur les nouveaux messages tant que l’utilisateur est resté au bas de la conversation

## [1.6.33] - 2026-05-07

### Fixed
- Policy RLS `votes` corrigée pour autoriser le owner d’une room à insérer ses réactions live sans erreur `new row violates row-level security policy`
- Permissions des réactions alignées avec la logique déjà utilisée pour les messages room

## [1.6.32] - 2026-05-07

### Fixed
- Adaptateur YouTube blindé contre le cas où certaines méthodes du player ne sont pas encore exposées au moment où l’UI pousse volume/mute
- Disparition du crash `setVolume is not a function` observé pendant les interactions live type Woot
- Réapplication du volume/mute local après chargement d’un nouveau morceau, pour éviter l’impression de reset audio à chaque transition

## [1.6.31] - 2026-05-07

### Added
- AudioEngine client central pour piloter l’état live audio de la scène et exposer un heartbeat anti-stall
- Adaptateur YouTube dédié pour isoler la couche IFrame API du reste de la room
- Docs produit/tech pour cadrer la suite : spec live stage, tickets d’implémentation et pseudo-code AudioEngine

### Changed
- `SyncScenePlayer` n’est plus le cerveau audio principal : la logique de sync, stall et recovery est recentrée dans l’engine
- La barre son affiche maintenant un vrai statut de lecture (`loading`, `buffering`, `playing`, `error`)
- Premiers moods de scène branchés côté rendu (`idle`, `groove`, `hype`) pour préparer les avatars plus vivants

### Fixed
- Réduction du spam `playVideo()` / `seekTo()` qui pouvait recouper la lecture en boucle
- Recovery soft plus propre quand le player YouTube décroche pendant la lecture live
- Base plus robuste pour éviter les resyncs paniqués dispersés dans plusieurs hooks

## [1.6.11] - 2026-05-05

### Fixed
- Volume local à 0 = mute réel côté client, au lieu d’un volume faible encore potentiellement audible selon le player YouTube
- Conservation du comportement de déverrouillage audio pour les volumes supérieurs à 0

## [1.6.10] - 2026-05-05

### Fixed
- Passage automatique au morceau suivant quand la vidéo atteint réellement la fin côté DJ
- Protection contre les doubles déclenchements de `next track` sur la même piste

## [1.6.9] - 2026-05-05

### Fixed
- Stabilisation de l’arrivée d’un second participant : le player évite désormais de relancer/seek en boucle pendant la phase de chargement join-in-progress
- Garde-fous supplémentaires sur les `playVideo`/`seekTo` quand le player YouTube bufferise ou n’a pas encore commencé à progresser

## [1.6.8] - 2026-05-05

### Changed
- Refonte du layout room pour arrêter l’effet “blog” : scène pleine largeur, deck principal mis en avant, panneaux secondaires rangés comme une vraie app de room musicale
- Hiérarchie visuelle revue pour coller davantage à une expérience plug.dj avec la scène comme élément dominant

## [1.6.7] - 2026-05-05

### Changed
- Lissage visuel de la scène pour coller davantage à l’énergie plug.dj : néons, booth plus assumé, crowd plus lisible, panneau de contrôle plus cohérent
- Contrastes et accents couleur retravaillés pour donner une vibe plus club sans casser le layout existant

## [1.6.6] - 2026-05-05

### Fixed
- Déverrouillage audio local renforcé avec plusieurs tentatives courtes après le premier geste utilisateur, pour éviter le son qui retombe dès qu’on arrête de bouger le slider
- Resync playback encore assoupli pour éviter qu’un seek trop fréquent recoupe la lecture côté audience

## [1.6.5] - 2026-05-05

### Fixed
- Suppression du resync trop agressif qui relançait/coupait la vidéo en boucle chez certains clients
- Volume local rendu beaucoup plus visible, avec un vrai slider central inspiré d’une scène plug.dj

### Changed
- Le player part toujours auto en muet, puis le slider volume sert de geste clair pour activer l’audio local sans refresh multiple

## [1.6.4] - 2026-05-05

### Fixed
- Resync client renforcé : correction périodique du drift pendant la lecture au lieu d’un seul recalage au changement d’état
- Déverrouillage audio local plus robuste avec relances `play/unmute` après geste utilisateur sur le volume
- Réduction du cas où un participant restait plusieurs secondes derrière le DJ après lancement

## [1.6.3] - 2026-05-05

### Changed
- Refonte du layout room pour quelque chose de plus compact et plus proche d’une vraie scène plug.dj
- La vidéo reprend la place centrale et l’iframe YouTube remplit explicitement son conteneur
- Les panneaux queue/chat sont rééquilibrés pour éviter l’effet étiré sur grand écran

## [1.6.2] - 2026-05-05

### Fixed
- Les visiteurs authentifiés d’une room publique sont maintenant auto-inscrits comme membres à l’ouverture, ce qui débloque enfin le chat et les autres actions room
- Le player force mieux l’autoplay en muet au chargement et remplace le vieux bouton de son par un vrai contrôle de volume local

## [1.6.1] - 2026-05-05

### Fixed
- Déblocage audio local du player YouTube renforcé : le clic utilisateur force maintenant seek + play + unmute dans le même geste
- Réduction du cas où un participant reste silencieux malgré le bouton d’activation audio

## [1.6.0] - 2026-05-05

### Added
- Chat live par room avec historique court, envoi de messages et refresh temps réel via Supabase
- Policy RLS `messages` pour autoriser l’envoi uniquement aux membres non bannis/non mutés et au owner

### Changed
- La room devient plus sociale : la scène sync peut maintenant se commenter en direct sans quitter le dancefloor

## [1.5.1] - 2026-05-05

### Added
- Habillage visuel de scène plus proche de plug.dj avec booth DJ, crowd et éclairages de stage
- Cartes crowd/booth dérivées des membres présents pour donner une vraie sensation de room vivante

### Changed
- Le player sync est maintenant mis en scène comme un dancefloor au lieu d’un simple bloc technique

## [1.5.0] - 2026-05-05

### Added
- Scène room synchronisée inspirée de plug.dj avec vrai player YouTube piloté côté client
- État partagé `playback_state` branché au rendu room pour play/pause/skip synchronisés
- Contrôles DJ de base et policies RLS pour insérer / mettre à jour le playback state

### Changed
- La room ne montre plus juste une vidéo embed : elle suit désormais une horloge partagée entre les membres présents
- La queue alimente maintenant directement la scène sync et le morceau suivant

## [1.4.3] - 2026-05-05

### Fixed
- Les rooms custom ouvertes via `?slug=` rechargent maintenant bien la vraie room Supabase, même quand le slug n’existe pas dans les previews statiques
- Le fallback "Room introuvable" ne bloque plus l’hydratation live côté client

## [1.4.2] - 2026-05-05

### Fixed
- Les rooms créées ou rejointes utilisent désormais `/rooms?slug=...` au lieu d’un slug dynamique incompatible avec GitHub Pages
- Le bouton d’ouverture de room et le flow de join n’envoient plus vers un 404 pour les slugs personnalisés

## [1.4.1] - 2026-05-05

### Fixed
- Route `/rooms/[slug]` rendue à nouveau compatible avec l’export statique GitHub Pages
- Hydratation live de la room déplacée côté client pour éviter le crash `cookies()` pendant le build Pages

## [1.4.0] - 2026-05-05

### Added
- Queue YouTube réelle sur la page room avec récupération des `queue_items` Supabase
- Formulaire d’ajout de titre par URL YouTube avec parsing d’URL et miniature automatique
- Embed player sur le titre courant et refresh live de la queue via Realtime
- Policy RLS pour autoriser les membres d’une room à ajouter des titres

### Changed
- La room hydrate maintenant ses premiers vrais médias au lieu d’un bloc queue purement décoratif
- README et version applicative alignés sur la première release YouTube + queue

## [1.3.1] - 2026-05-05

### Added
- Composant client `LiveRoomPage` pour hydrater une room avec la présence Supabase Realtime
- Compteur de présence live et indicateurs online/offline dans le roster room

### Changed
- La route `/rooms/[slug]` rend maintenant la vue room via un wrapper client capable de suivre les présences live
- Le type de state room accepte désormais les infos de présence et les visiteurs temporaires

## [1.3.0] - 2026-05-04

### Added
- Nouvelle route `src/app/rooms/[slug]/page.tsx` avec vraie page room crédible
- Vue room partagée avec état live / preview / room absente / accès refusé
- Helpers room centralisés pour mock preview, slugify et états fallback

### Changed
- Création de room depuis `/rooms` redirige maintenant vers `/rooms/[slug]`
- Join privé par slug redirige maintenant vers `/rooms/[slug]`
- README et roadmap alignés sur la navigation room réelle

## [1.2.4] - 2026-05-04

### Fixed
- Suppression des upserts `profiles` côté client pendant signup/login/lobby pour laisser le trigger SQL Supabase faire son boulot
- Message d’erreur plus propre quand Supabase répond `429` sur signup

## [1.2.3] - 2026-05-04

### Fixed
- Le signup ne se casse plus visuellement si l’upsert client de `profiles` n’est pas nécessaire après création du compte
- La connexion reste valide même si `ensureProfile` rencontre un cas déjà couvert par le trigger SQL

## [1.2.2] - 2026-05-04

### Fixed
- Version affichée dans l’interface synchronisée avec `package.json`
- Source unique ajoutée pour éviter les décalages entre repo, UI et docs

## [1.2.1] - 2026-05-04

### Added
- Migration SQL versionnée dans `supabase/migrations/` pour refléter l’état réel du projet distant

### Fixed
- `supabase/.temp/` ignoré par Git pour éviter de salir le repo avec des fichiers CLI temporaires

## [1.2.0] - 2026-05-04

### Added
- Auth Supabase réellement branchée côté client pour `/login` et `/signup`
- Création de room publique/privée depuis `/rooms`
- Join privé par slug avec insertion dans `room_members`
- Synchronisation du profil utilisateur côté client via `ensureProfile`
- Trigger Supabase de bootstrap profil + premières policies RLS de base

### Changed
- Lobby `/rooms` désormais relié aux vraies données Supabase quand l’environnement est configuré
- Homepage, docs et shell mis à jour pour refléter le passage en v1.2.0

## [1.1.1] - 2026-05-04

### Fixed
- Activation de `trailingSlash` pour générer des sous-pages compatibles GitHub Pages (`/rooms/`, `/login/`, `/signup/`, `/docs/`) et éviter les 404 au clic
- Export statique aligné avec la navigation réelle du site déployé

## [1.1.0] - 2026-05-04

### Added
- Ajout des dépendances Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
- Helpers Supabase client/server et détection centralisée des variables d’environnement
- Fichier `.env.example` pour documenter l’intégration Supabase
- Pages `/login` et `/signup` avec UX de preview et fallback clair si Supabase n’est pas configuré
- Page `/rooms` avec mock data crédible pour rooms publiques et privées
- Composants partagés de shell applicatif pour ancrer la future app
- Schéma SQL Supabase initial pour profiles, rooms, queue, playback, votes, messages et modération

### Changed
- Homepage et docs mises à niveau pour refléter le passage en squelette d’application
- Version du projet alignée sur `1.1.0`

## [1.0.0] - 2026-05-04

### Added
- Création du repo public Midas DJ
- Socle Next.js + TypeScript + Tailwind CSS
- Landing page initiale avec branding Midas DJ
- PRD v1 du produit
- Architecture technique initiale
- Modèle de données de référence
- Roadmap par versions
- Convention officielle de versioning pour les futures PR
