# Midas DJ

**Version:** 1.3.0

Midas DJ est une plateforme d’écoute sociale en temps réel, inspirée de plug.dj et repensée pour le web moderne.

## Vision

Créer une expérience où l’on peut :
- rejoindre une room publique ou privée ;
- écouter un morceau YouTube en synchro avec tout le monde ;
- discuter en direct ;
- ajouter des titres à une file collaborative ;
- prendre la main comme DJ à tour de rôle ;
- voter, skipper et modérer sans transformer la room en zoo.

## Scope de la release 1.3.0

Cette release ancre enfin la navigation room :
- **route `/rooms/[slug]`** avec vraie page room crédible ;
- **redirection réelle après create/join** vers la room cible ;
- **chargement live Supabase par slug** quand l’environnement est présent ;
- **gestion propre** des cas room absente, user non connecté et accès privé refusé ;
- **placeholders premium** pour player, queue et chat sans casser l’export statique ;
- **fallback GitHub Pages** conservé quand l’environnement n’est pas fourni.

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
- `src/lib/supabase/profile.ts` garantit qu’un profil exploitable existe pour les flux create/join.
- `supabase/schema.sql` contient maintenant un trigger de bootstrap profil et les premières policies RLS.
- Sans variables publiques dans la build, le site reste navigable mais l’auth et les actions room restent désactivées.

## Convention produit

Midas DJ doit respirer :
- le **dark mode natif** ;
- une ambiance **gold / noir / violet** ;
- une expérience **fluide, premium, communautaire** ;
- zéro effet "clone cheap nostalgique".

## Prochaines étapes recommandées

1. Ajouter présence live, chat et queue réellement branchés dans la room.
2. Intégrer YouTube IFrame Player API.
3. Poser la synchro temps réel de playback.
4. Renforcer les règles d’accès des rooms privées.
5. Préparer les actions owner/mod directement depuis la page room.
