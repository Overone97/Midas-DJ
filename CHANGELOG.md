# Changelog

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
