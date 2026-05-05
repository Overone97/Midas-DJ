# Midas DJ

**Version:** 1.6.3

Midas DJ est une plateforme d’écoute sociale en temps réel, inspirée de plug.dj et repensée pour le web moderne.

## Vision

Créer une expérience où l’on peut :
- rejoindre une room publique ou privée ;
- écouter un morceau YouTube en synchro avec tout le monde ;
- discuter en direct ;
- ajouter des titres à une file collaborative ;
- prendre la main comme DJ à tour de rôle ;
- voter, skipper et modérer sans transformer la room en zoo.

## Scope de la release 1.6.3

Cette release fait enfin entrer la musique dans la room :
- **queue YouTube réelle** branchée à Supabase ;
- **ajout de titres par URL YouTube** depuis la page room ;
- **embed player** sur le titre courant de la queue ;
- **refresh live de la queue** via Supabase Realtime ;
- **fallback statique conservé** quand Supabase n’est pas dispo.

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

1. Ajouter le chat live.
2. Gérer skip / like / rotation DJ plus finement.
3. Préparer les actions owner/mod directement depuis la page room.
4. Renforcer les règles d’accès et les garde-fous sur les rooms privées.
5. Remplacer l’embed piloté par une expérience encore plus proche de plug.dj côté scène/avatar.
