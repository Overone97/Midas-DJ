# PRD — Midas DJ v1.0.0

## 1. Résumé produit

**Midas DJ** est une plateforme d’écoute sociale en temps réel inspirée de plug.dj. Le produit permet à des utilisateurs de se retrouver dans des rooms publiques ou privées, d’écouter ensemble des morceaux provenant de YouTube, de chatter, d’ajouter des sons à une file d’attente et de se relayer comme DJ.

## 2. Problème

Les expériences d’écoute musicale modernes sont souvent :
- individuelles ;
- peu incarnées socialement ;
- faibles en synchro communautaire ;
- froides côté identité produit.

plug.dj avait le bon cœur produit, mais l’exécution est vieillissante. Midas DJ doit reprendre l’énergie du concept sans refaire un musée.

## 3. Positionnement

> Une plateforme d’écoute sociale en temps réel, inspirée de plug.dj, plus belle, plus fluide et plus moderne.

## 4. Objectifs v1

### Objectifs produit
- Valider qu’une room live synchronisée crée de l’engagement.
- Permettre à un groupe d’amis ou à une communauté de partager une session musicale facilement.
- Offrir une expérience room-first, pas un lecteur audio avec chat collé dessus.

### Objectifs business / traction
- Obtenir des premiers retours qualitatifs sur les rooms publiques et privées.
- Mesurer la rétention sur la première session multi-utilisateur.
- Préparer une base saine pour itérer rapidement.

## 5. Non-objectifs v1

- App mobile native
- DMs privés
- Système de réputation complexe
- Marketplace
- Monétisation avancée
- IA de recommandation
- Support multi-sources audio

## 6. Utilisateurs cibles

### Persona A — Groupe d’amis
Veut créer une room privée, balancer des sons, discuter et alterner les passages DJ sans friction.

### Persona B — Petite communauté publique
Veut une room ouverte, modérable, avec une vibe claire et une file musicale participative.

### Persona C — Curieux nostalgiques de plug.dj
Veulent retrouver le frisson de l’écoute collective mais avec un produit plus propre.

## 7. User stories MVP

### Auth / profil
- En tant qu’utilisateur, je peux créer un compte et me connecter.
- En tant qu’utilisateur, je peux définir un pseudo et un avatar.

### Rooms
- En tant qu’utilisateur, je peux créer une room publique.
- En tant qu’utilisateur, je peux créer une room privée.
- En tant qu’utilisateur, je peux rejoindre une room via lien privé.
- En tant qu’utilisateur, je peux consulter les rooms publiques disponibles.

### Lecture collaborative
- En tant qu’utilisateur, je peux coller un lien YouTube pour ajouter un morceau à la queue.
- En tant que participant, je vois le morceau en cours, sa durée et son état.
- En tant que participant, j’écoute le morceau avec une synchro cohérente avec le reste de la room.

### DJ rotation
- En tant qu’utilisateur, je peux entrer dans la file DJ.
- En tant que room, un seul DJ est actif à la fois.
- En tant que room, le système passe automatiquement au morceau et/ou DJ suivant.

### Interaction sociale
- En tant qu’utilisateur, je peux chatter en direct.
- En tant qu’utilisateur, je peux liker un morceau.
- En tant qu’utilisateur, je peux voter pour skip.

### Modération
- En tant qu’owner, je peux nommer des modérateurs.
- En tant que modérateur, je peux mute, kick ou ban un utilisateur.
- En tant qu’owner, je peux verrouiller l’accès d’une room privée.

## 8. Fonctionnalités MVP

### Obligatoires au lancement
1. Auth basique
2. Profils légers
3. Création de room publique / privée
4. Listing des rooms publiques
5. Rejoindre room privée par lien
6. Chat temps réel
7. Queue collaborative YouTube
8. Player synchronisé
9. DJ rotation simple
10. Votes like / skip
11. Modération owner / mod

### À traiter plus tard
- Historique complet de room
- Discovery avancée
- Badges / gamification
- Analytics communautaires
- Thèmes personnalisables profonds

## 9. Flux principal

1. L’utilisateur se connecte.
2. Il rejoint ou crée une room.
3. Il voit le morceau en cours.
4. Il peut chatter instantanément.
5. Il ajoute un son YouTube à la queue.
6. Il rejoint la file DJ.
7. La room écoute ensemble en synchro.
8. Le morceau suivant démarre automatiquement.

## 10. Contraintes majeures

### Technique
- La synchro doit survivre à la latence et aux petits décrochages client.
- Le player YouTube impose son propre cadre d’intégration.
- Le realtime doit rester robuste même avec plusieurs événements simultanés.

### Produit / légal
- Dépendance à YouTube pour la source média.
- Vérification nécessaire des contraintes ToS avant mise en prod large.
- Les rooms publiques demandent de vrais garde-fous de modération.

## 11. UX / design principles

- Web first
- Dark mode natif
- Palette gold / noir / violet
- Room centrée sur le moment partagé
- Interface rapide, lisible, premium
- Pas de skin “vieille table de mixage” ringarde

## 12. KPIs à suivre plus tard

- Nombre de rooms créées
- Taux de rooms actives > 2 utilisateurs
- Temps moyen passé dans une room
- Nombre moyen de morceaux ajoutés par session
- Taux de skip
- Taux de retour utilisateur à J7

## 13. Définition de succès v1

La v1 est un succès si :
- plusieurs utilisateurs peuvent vivre une session synchronisée sans friction majeure ;
- la queue collaborative et le DJ flow sont jugés fun ;
- les rooms privées fonctionnent bien entre amis ;
- les rooms publiques restent modérables et compréhensibles.
