# Avatar skins, outfits, animations, and pit system

## Vision

Faire évoluer Midas DJ d’un simple avatar stylisé vers un **système de scène complet**, plus proche de plug.dj :
- avatars persistés par compte ;
- catalogue de skins réels avec silhouettes distinctes ;
- accessoires indépendants ;
- state machine d’animation contextuelle ;
- fosse à **slots fixes** alignés proprement ;
- lisibilité immédiate des intentions live (`woot`, `grab`, `meh`, DJing).

---

## Principes produit

### 1. Un avatar n’est plus juste une couleur
Un avatar devient une **entité visuelle composable** :
- base skin ;
- outfit ;
- accessoires ;
- animation set ;
- état live courant.

### 2. Chaque skin doit avoir une silhouette propre
Pas juste un recolor cheap.

Un renard doit se lire comme un renard.
Un dragon doit se lire comme un dragon.
Un humain cyberpunk doit se lire comme un humain cyberpunk.

### 3. La fosse doit être lisible comme une foule
Pas une liste flottante.

Chaque utilisateur occupe un **slot de fosse** stable, visible, cohérent d’un refresh à l’autre autant que possible.

### 4. Les réactions pilotent l’état d’animation
- `woot` → dancing / celebration
- `grab` → gesture + badge
- `meh` → idle / disengaged
- rien → idle
- DJ actif → boucle spécifique booth

---

## Système de skins

### Catégories de skins

#### 1. Animals
- fox
- wolf
- cat
- rabbit
- bear
- panda
- tiger
- dragon

#### 2. Game characters
- pixel-adventurer
- fantasy-rpg
- sci-fi-runner
- chibi-hero

#### 3. Stylized humans
- streetwear
- dj-booth
- royal
- cyberpunk

---

## Structure d’un skin

```ts
type SkinCategory = 'animal' | 'game_character' | 'stylized_human';
type SkinRarity = 'common' | 'rare' | 'epic' | 'legendary';
type UnlockCurrency = 'soft_coins' | 'premium_gems' | 'xp_only';

type SkinAssetBundle = {
  thumbnailUrl?: string;
  spriteSheetUrl?: string;
  frameAtlasUrl?: string;
  frameWidth?: number;
  frameHeight?: number;
  animations: Record<string, {
    frames: number[];
    fps: number;
    loop: boolean;
  }>;
};

type SkinUnlockCondition = {
  xpRequired?: number;
  softCurrencyCost?: number;
  premiumCurrencyCost?: number;
  eventId?: string;
};

type AvatarSkinDefinition = {
  id: string;
  name: string;
  category: SkinCategory;
  rarity: SkinRarity;
  speciesOrArchetype: string;
  description?: string;
  unlockCondition: SkinUnlockCondition;
  supportedAccessories: string[];
  assetBundle: SkinAssetBundle;
  tags: string[];
};
```

---

## Accessoires

### Accessoires MVP à prévoir
- hat-dj
- crown-gold
- glasses-neon
- mic-handheld
- guitar-neon
- synth-mini
- headphones-pro
- royal-cape

### Structure

```ts
type AccessoryAnchor = 'head' | 'face' | 'back' | 'left_hand' | 'right_hand' | 'body';

type AccessoryDefinition = {
  id: string;
  name: string;
  anchor: AccessoryAnchor;
  rarity: SkinRarity;
  compatibleSkinTags?: string[];
  animationOverrides?: string[];
  assetUrl?: string;
};
```

---

## Profil joueur persistant

Le compte utilisateur doit stocker :

```ts
type AvatarLoadout = {
  selectedSkinId: string;
  equippedAccessoryIds: string[];
  selectedEmotePackId?: string;
  preferredPitPose?: 'standing' | 'sitting';
};

type AvatarProgression = {
  xp: number;
  level: number;
  unlockedSkinIds: string[];
  unlockedAccessoryIds: string[];
  softCoins: number;
  premiumGems: number;
};
```

### Décision produit recommandée
**Ne plus faire porter tout le système avatar sur `species/accessories/color/badge` seulement.**

Conserver ces champs comme fallback/legacy, mais introduire ensuite côté `profiles` ou table dédiée :
- `selected_skin_id`
- `equipped_accessory_ids`
- `avatar_xp`
- `avatar_level`
- `unlocked_skin_ids`
- `unlocked_accessory_ids`

---

## State machine d’animation

### États globaux

```ts
type AvatarAnimationState =
  | 'idle'
  | 'dancing'
  | 'sitting'
  | 'onLike'
  | 'onWoot'
  | 'onGrab'
  | 'onDJing'
  | 'onLevelUp';
```

### Transitions de base

```text
idle -> dancing
idle -> sitting
idle -> onLike
idle -> onWoot
idle -> onGrab

sitting -> idle
sitting -> onWoot

dancing -> onLike
dancing -> onWoot
dancing -> onGrab
dancing -> onDJing

after onLike -> dancing or idle
after onWoot -> dancing
after onGrab -> idle or dancing
after onLevelUp -> dancing or idle
```

### Politique simple
- `woot` = entre en état `dancing`
- `meh` = retourne `idle`
- `grab` = geste court + badge
- DJ actif = `onDJing` tant qu’il est au booth

---

## Animations de base

Toutes les familles de skins doivent fournir au minimum :
- `idle`
- `dancing`
- `sitting`
- `onLike`
- `onWoot`
- `onGrab`
- `onDJing`
- `onLevelUp`

---

## Animations spécifiques par espèce / archétype

### Fox / Wolf / Cat
- queue sway sync légère ;
- danse plus agile ;
- posture penchée et nerveuse.

### Rabbit
- oreilles indépendantes ;
- petit hop sur le beat ;
- version idle plus vive.

### Bear
- mouvement plus lourd ;
- groove ample ;
- `onLike` avec impact visuel plus massif.

### Panda
- dancing plus rond et goofy ;
- pause idle plus molle.

### Tiger
- pas latéraux plus nerveux ;
- regard plus agressif.

### Dragon
- micro battement d’ailes en idle ;
- `onLike` / `onWoot` avec souffle ou flare visuel.

### Game characters
- pixel-adventurer : mouvements plus saccadés, lisibilité sprite rétro
- fantasy-rpg : cape / robe / arme légère
- sci-fi-runner : accents néon et motions plus techniques
- chibi-hero : exagération cartoon

### Stylized humans
- streetwear : groove casual
- dj-booth : performance/booth spécifique
- royal : attitude plus posée, gestes nobles
- cyberpunk : mouvements plus nerveux, néons, glitch léger

---

## Accessoires animés

### hat-dj
- rotation légère sur drop / `onWoot`

### mic-handheld
- tenue en main ;
- léger mouvement performance en `onDJing`

### guitar-neon / synth-mini
- animation de jeu pendant diffusion ou emote dédiée

### headphones-pro
- vibration ou bounce léger sur groove fort

---

## Fosse plug.dj-style

### Objectif
Chaque avatar doit être placé dans un **slot fixe** d’une grille/arc de fosse.

### Contraintes
- rendu stable ;
- ordre prédictible ;
- lisibilité de la densité ;
- pas d’effet “avatars jetés au hasard”.

### Structure recommandée

```ts
type PitSlot = {
  id: string;
  x: number;
  y: number;
  zIndex: number;
  scale: number;
  lane: 'front' | 'mid' | 'back';
};
```

### Règles
- front row : membres les plus visibles
- owner/DJ hors fosse, au booth
- membres en ligne occupent les premiers slots
- ordre stable par `join order` ou `user_id hash`

### Recommandation visuelle
- 12 à 18 slots visibles max
- 3 rangées : front / mid / back
- légère perspective via `scale`
- z-index par rangée

---

## Architecture technique recommandée

### Nouveaux modules

```text
src/lib/avatar-catalog.ts
src/lib/avatar-animation.ts
src/lib/pit-layout.ts
src/components/pit-avatar.tsx
src/components/pit-crowd.tsx
```

### Responsabilités

#### `avatar-catalog.ts`
- définit les skins
- définit les accessoires
- helpers d’unlock/loadout

#### `avatar-animation.ts`
- state machine d’animation
- mapping réactions -> états
- timers `onWoot` / `onLike`

#### `pit-layout.ts`
- calcule les slots fixes
- place les membres dans la fosse

#### `pit-avatar.tsx`
- rendu d’un avatar unique avec skin/accessoires/état

#### `pit-crowd.tsx`
- composition de la fosse entière

---

## Plan de livraison conseillé

### Phase A — Fondation data
- catalogue de skins
- catalogue d’accessoires
- types de loadout/progression
- spec complète

### Phase B — Layout pit fixe
- slots fixes front/mid/back
- mapping stable membres -> slots
- DJ séparé du pit

### Phase C — Animation state machine
- idle / dancing / sitting / onWoot / onGrab / onDJing
- transitions fluides et TTL d’événements

### Phase D — Skins réels
- 3 à 5 skins complets d’abord
- 2 à 3 accessoires animés
- pas 25 skins vides dès le départ

### Phase E — Progression & unlocks
- XP / level
- inventory
- conditions d’unlock

---

## Recommandation franche

Le piège serait de vouloir coder **30 skins + 20 accessoires + 10 animations** d’un coup.

La bonne stratégie :
1. architecture propre ;
2. fosse fixe ;
3. state machine ;
4. quelques skins vraiment bons ;
5. expansion ensuite.

Sinon on va se retrouver avec un zoo mal animé au lieu d’une scène qui claque.