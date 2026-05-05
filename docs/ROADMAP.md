# Roadmap — Midas DJ

## v1.0.0 — Foundation
- Repo GitHub public
- Socle Next.js + TypeScript + Tailwind
- Vision produit
- PRD MVP complet
- Architecture technique
- Modèle de données initial
- Convention de versioning

## v1.1.0 — Backend skeleton
- Setup Supabase
- Helpers client/server et fallback statique GitHub Pages
- Auth preview sur `/login` et `/signup`
- Lobby `/rooms` avec discovery publique/privée
- Tables principales via schéma SQL initial
- Variables d’environnement documentées

## v1.2.0 — Auth live + room bootstrap
- Signup/login Supabase branchés côté client
- Liste de rooms publiques branchée au backend
- Création de room publique / privée
- Rejoindre une room privée par slug
- Profil bootstrap + base RLS

## v1.3.0 — Room page + presence
- UI room de base
- Navigation réelle vers une room créée/rejointe
- Contrôle d’accès initial sur les rooms privées
- Placeholders premium pour player / queue / chat

## v1.3.1 — Presence branchée
- Présence des utilisateurs
- Roster live plus précis
- États room temps réel minimaux

## v1.4.0 — YouTube + queue
- Parsing URL YouTube
- Ajout à la queue
- Lecture vidéo intégrée
- Refresh live de la queue dans la room

## v1.5.0 — Realtime sync
- Playback state serveur
- Realtime room events
- Resync client automatique
- Gestion du drift

## v1.6.0 — Social + moderation
- Chat live
- Likes / skip
- Owner / mod / member
- Mute / kick / ban

## v2.0.0 — Polish and growth
- Discovery plus solide
- Historique room
- Profils enrichis
- Analytics communautaires
- Optimisation perf / infra
