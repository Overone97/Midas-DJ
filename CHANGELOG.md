# Changelog

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
