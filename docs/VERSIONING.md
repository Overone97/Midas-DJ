# Versioning — Midas DJ

## Règle validée
Chaque Pull Request doit porter un numéro de version visible et incrémenté.

## Convention retenue
- La première PR fondatrice de Midas DJ = **1.0.0**
- Ensuite, on incrémente selon l’ampleur :
  - **patch** (`1.0.1`, `1.0.2`, etc.) pour corrections, ajustements, petits ajouts
  - **minor** (`1.1.0`, `1.2.0`, etc.) pour nouvelles fonctionnalités nettes
  - **major** (`2.0.0`) pour gros changement de structure ou de produit

## Où mettre la version
- `package.json`
- `README.md`
- `CHANGELOG.md`
- dans l’interface quand pertinent
- dans le titre de la PR

## Format recommandé des PR
`release: vX.Y.Z - résumé court`

Exemples :
- `release: v1.0.0 - foundation, PRD and architecture`
- `release: v1.1.0 - supabase auth and schema bootstrap`
- `release: v1.1.1 - fix room creation flow`
