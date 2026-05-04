# Midas DJ

**Version:** 1.0.0

Midas DJ est une plateforme d’écoute sociale en temps réel, inspirée de plug.dj et repensée pour le web moderne.

## Vision

Créer une expérience où l’on peut :
- rejoindre une room publique ou privée ;
- écouter un morceau YouTube en synchro avec tout le monde ;
- discuter en direct ;
- ajouter des titres à une file collaborative ;
- prendre la main comme DJ à tour de rôle ;
- voter, skipper et modérer sans transformer la room en zoo.

## Scope de la release 1.0.0

Cette PR pose :
- le **socle du projet Next.js + TypeScript + Tailwind** ;
- le **positionnement produit** ;
- le **PRD v1 complet** ;
- la **proposition d’architecture technique** ;
- le **modèle de données initial** ;
- la **roadmap V1 / V1.1 / V2** ;
- les **règles de versioning** pour les prochaines PR.

## Stack retenue

- **Frontend** : Next.js, TypeScript, Tailwind CSS
- **Backend** : Supabase (Auth, Postgres, Realtime)
- **Player** : YouTube IFrame Player API
- **Déploiement** : Vercel + Supabase

## Documents clés

- [PRD v1](./docs/PRD-v1.md)
- [Architecture technique](./docs/ARCHITECTURE.md)
- [Roadmap](./docs/ROADMAP.md)
- [Schéma de données](./docs/DATA_MODEL.md)
- [Versioning](./docs/VERSIONING.md)
- [Changelog](./CHANGELOG.md)

## Lancer le projet

```bash
npm install
npm run dev
```

## Convention produit

Midas DJ doit respirer :
- le **dark mode natif** ;
- une ambiance **gold / noir / violet** ;
- une expérience **fluide, premium, communautaire** ;
- zéro effet "clone cheap nostalgique".

## Prochaines étapes recommandées

1. Brancher Supabase et l’auth.
2. Créer les tables Room / Queue / Messages / Playback.
3. Intégrer YouTube IFrame Player API.
4. Poser la synchro temps réel de playback.
5. Construire l’UI Room.
