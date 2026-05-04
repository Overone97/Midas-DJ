# Midas DJ

**Version:** 1.1.0

Midas DJ est une plateforme d’écoute sociale en temps réel, inspirée de plug.dj et repensée pour le web moderne.

## Vision

Créer une expérience où l’on peut :
- rejoindre une room publique ou privée ;
- écouter un morceau YouTube en synchro avec tout le monde ;
- discuter en direct ;
- ajouter des titres à une file collaborative ;
- prendre la main comme DJ à tour de rôle ;
- voter, skipper et modérer sans transformer la room en zoo.

## Scope de la release 1.1.0

Cette release transforme le projet de simple landing/doc en vrai squelette d’application :
- **socle Next.js + TypeScript + Tailwind** conservé ;
- **helpers Supabase client/server** ajoutés sans casser l’export statique ;
- **pages `/login` et `/signup`** avec UX de preview crédible ;
- **page `/rooms`** avec rooms mockées publiques/privées et CTA créer/rejoindre ;
- **schéma SQL Supabase** pour les entités clés du produit ;
- **documentation et versioning** mis à jour pour préparer la suite.

## Stack retenue

- **Frontend** : Next.js, TypeScript, Tailwind CSS
- **Backend** : Supabase (Auth, Postgres, Realtime)
- **Player** : YouTube IFrame Player API
- **Déploiement** : GitHub Pages (statique) + backend Supabase, puis Vercel si besoin côté app server

## Documents clés

- [PRD v1](./docs/PRD-v1.md)
- [Architecture technique](./docs/ARCHITECTURE.md)
- [Roadmap](./docs/ROADMAP.md)
- [Schéma de données](./docs/DATA_MODEL.md)
- [Versioning](./docs/VERSIONING.md)
- [Changelog](./CHANGELOG.md)
- [Schéma SQL Supabase](./supabase/schema.sql)

## Lancer le projet

```bash
npm install
cp .env.example .env.local
npm run dev
```

Si les variables Supabase ne sont pas présentes, l’application reste pleinement navigable en mode preview statique.

## Variables d’environnement

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Notes Supabase

- `src/lib/supabase/client.ts` expose un client navigateur paresseux.
- `src/lib/supabase/server.ts` prépare le client serveur basé sur les cookies Next.
- `src/lib/supabase/env.ts` centralise la détection des variables manquantes pour garder un fallback propre.
- Tant que l’auth réelle n’est pas branchée, `/login` et `/signup` restent des previews UX intentionnelles.

## Convention produit

Midas DJ doit respirer :
- le **dark mode natif** ;
- une ambiance **gold / noir / violet** ;
- une expérience **fluide, premium, communautaire** ;
- zéro effet "clone cheap nostalgique".

## Prochaines étapes recommandées

1. Brancher les formulaires auth sur Supabase Auth.
2. Ajouter les policies RLS et seeds de démarrage.
3. Construire la vraie page room avec queue, chat et présence.
4. Intégrer YouTube IFrame Player API.
5. Poser la synchro temps réel de playback.
