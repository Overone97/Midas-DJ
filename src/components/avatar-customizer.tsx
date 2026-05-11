'use client';

import { AvatarDisplay } from '@/components/avatar-display';
import {
  avatarAccessoryCatalog,
  avatarSkinCatalog,
  getAvatarAccessoryById,
  getAvatarSkinById,
  isAccessoryUnlocked,
  isSkinUnlocked,
  normalizeAvatarLoadout,
  normalizeAvatarProgression,
  projectLoadoutToAvatar,
  sanitizeLoadoutForProgression,
  type AvatarLoadout,
  type AvatarProgression,
} from '@/lib/avatar-catalog';
import { avatarOptionLabels, normalizeAvatar, type AvatarConfig } from '@/lib/avatar';
import { createXpSnapshot, xpRequiredForLevel } from '@/lib/xp';

function formatRequirementBits(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(' · ');
}

function SkinChip({
  active,
  locked,
  label,
  meta,
  onClick,
}: {
  active: boolean;
  locked: boolean;
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      className={`rounded-2xl border px-3 py-3 text-left transition ${
        active
          ? 'border-cyan-300/45 bg-cyan-300/14 text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
          : locked
            ? 'cursor-not-allowed border-white/8 bg-white/5 text-white/38 opacity-80'
            : 'border-white/10 bg-white/5 text-white/72 hover:border-white/15 hover:bg-white/8'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        {locked ? <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-white/45">locked</span> : null}
      </div>
      <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-white/45">{meta}</p>
    </button>
  );
}

export function AvatarCustomizer({
  open,
  avatar,
  loadout,
  progression,
  submitting,
  onClose,
  onChange,
  onSave,
}: {
  open: boolean;
  avatar: AvatarConfig;
  loadout: AvatarLoadout;
  progression: AvatarProgression;
  submitting: boolean;
  onClose: () => void;
  onChange: (next: { avatar: AvatarConfig; loadout: AvatarLoadout }) => void;
  onSave: () => void;
}) {
  const resolvedAvatar = normalizeAvatar(avatar);
  const resolvedProgression = normalizeAvatarProgression(progression);
  const resolvedLoadout = sanitizeLoadoutForProgression(loadout, resolvedProgression);
  const selectedSkin = getAvatarSkinById(resolvedLoadout.selectedSkinId);
  const xpSnapshot = createXpSnapshot(resolvedProgression.xp);

  if (!open) {
    return null;
  }

  function commitLoadout(nextLoadout: Partial<AvatarLoadout>) {
    const normalizedLoadout = sanitizeLoadoutForProgression(
      {
        ...resolvedLoadout,
        ...nextLoadout,
      },
      resolvedProgression,
    );

    onChange({
      avatar: projectLoadoutToAvatar(normalizedLoadout, resolvedAvatar),
      loadout: normalizedLoadout,
    });
  }

  function toggleAccessory(accessoryId: string) {
    const currentlyEquipped = resolvedLoadout.equippedAccessoryIds.includes(accessoryId);
    const nextAccessoryIds = currentlyEquipped
      ? resolvedLoadout.equippedAccessoryIds.filter((item) => item !== accessoryId)
      : [...resolvedLoadout.equippedAccessoryIds, accessoryId];

    commitLoadout({ equippedAccessoryIds: nextAccessoryIds.slice(0, 4) });
  }

  const nextUnlockableSkin = avatarSkinCatalog
    .filter((skin) => !isSkinUnlocked(skin.id, resolvedProgression))
    .sort((a, b) => (a.unlockCondition.xpRequired ?? 0) - (b.unlockCondition.xpRequired ?? 0))[0];

  const nextUnlockLevel = avatarAccessoryCatalog
    .filter((accessory) => !isAccessoryUnlocked(accessory.id, resolvedProgression))
    .sort((a, b) => (a.unlockLevel ?? 1) - (b.unlockLevel ?? 1))[0]?.unlockLevel;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl rounded-[2rem] border border-fuchsia-300/15 bg-[radial-gradient(circle_at_top,#a855f71f,transparent_30%),linear-gradient(180deg,#120f1d,#07070d)] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-fuchsia-200/70">Avatar lab</p>
            <h3 className="mt-2 text-2xl font-black text-white">Loadout de scène</h3>
            <p className="mt-2 max-w-2xl text-sm text-white/68">Cette fois on branche enfin le vrai catalogue : skins, accessoires compatibles et verrous de progression. Pas juste du maquillage.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/78 transition hover:bg-white/10">
            Fermer
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="rounded-[1.6rem] border border-cyan-300/12 bg-[linear-gradient(180deg,rgba(4,10,16,0.95),rgba(7,9,15,0.92))] p-5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/68">Preview</p>
              <div className="mt-5 flex min-h-[20rem] items-center justify-center rounded-[1.4rem] border border-white/10 bg-black/25">
                <AvatarDisplay avatar={resolvedAvatar} label="Ton avatar" size="lg" showLabel badge={resolvedAvatar.badge !== 'none' ? avatarOptionLabels.badges[resolvedAvatar.badge] : undefined} />
              </div>
              <div className="mt-4 rounded-[1rem] border border-gold/15 bg-gold/10 p-3 text-sm text-white/82">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gold/72">Progression</p>
                <p className="mt-1 font-black text-white">Niveau {xpSnapshot.level} · {xpSnapshot.xp} XP</p>
                <p className="mt-1 text-xs text-white/62">Encore {xpSnapshot.xpToNext} XP avant le prochain niveau.</p>
              </div>
              {(nextUnlockableSkin || nextUnlockLevel) ? (
                <div className="mt-3 rounded-[1rem] border border-white/10 bg-white/5 p-3 text-sm text-white/75">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Prochaine carotte</p>
                  {nextUnlockableSkin ? <p className="mt-1">Skin <span className="font-semibold text-white">{nextUnlockableSkin.name}</span> à {nextUnlockableSkin.unlockCondition.xpRequired ?? 0} XP.</p> : null}
                  {nextUnlockLevel ? <p className="mt-1">Niveau {nextUnlockLevel} pour plus d’accessoires.</p> : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-5">
            <section className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Skins</p>
                  <p className="mt-1 text-sm text-white/62">Choisis une vraie silhouette de scène.</p>
                </div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">{avatarSkinCatalog.length} options</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {avatarSkinCatalog.map((skin) => {
                  const locked = !isSkinUnlocked(skin.id, resolvedProgression);
                  const requirement = formatRequirementBits([
                    skin.rarity,
                    typeof skin.unlockCondition.xpRequired === 'number' ? `${skin.unlockCondition.xpRequired} XP` : null,
                    typeof skin.unlockCondition.softCurrencyCost === 'number' ? `${skin.unlockCondition.softCurrencyCost} coins` : null,
                    typeof skin.unlockCondition.premiumCurrencyCost === 'number' ? `${skin.unlockCondition.premiumCurrencyCost} gems` : null,
                  ]);

                  return (
                    <SkinChip
                      key={skin.id}
                      active={resolvedLoadout.selectedSkinId === skin.id}
                      locked={locked}
                      label={skin.name}
                      meta={requirement || skin.category}
                      onClick={() => {
                        if (!locked) {
                          commitLoadout({ selectedSkinId: skin.id, equippedAccessoryIds: [] });
                        }
                      }}
                    />
                  );
                })}
              </div>
            </section>

            <section className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Accessoires</p>
                <p className="mt-1 text-sm text-white/62">Filtrés selon le skin actif. Les trucs incompatibles restent au vestiaire.</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {selectedSkin.supportedAccessories.map((accessoryId) => {
                  const accessory = getAvatarAccessoryById(accessoryId);
                  if (!accessory) {
                    return null;
                  }

                  const locked = !isAccessoryUnlocked(accessory.id, resolvedProgression);
                  const active = resolvedLoadout.equippedAccessoryIds.includes(accessory.id);
                  const requirement = formatRequirementBits([
                    accessory.rarity,
                    accessory.unlockLevel ? `lvl ${accessory.unlockLevel}` : null,
                  ]);

                  return (
                    <SkinChip
                      key={accessory.id}
                      active={active}
                      locked={locked}
                      label={accessory.name}
                      meta={requirement}
                      onClick={() => {
                        if (!locked) {
                          toggleAccessory(accessory.id);
                        }
                      }}
                    />
                  );
                })}
              </div>
            </section>

            <section className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">Résumé technique</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1rem] border border-white/8 bg-black/20 px-3 py-3 text-sm text-white/75">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Skin actif</p>
                  <p className="mt-1 font-semibold text-white">{selectedSkin.name}</p>
                </div>
                <div className="rounded-[1rem] border border-white/8 bg-black/20 px-3 py-3 text-sm text-white/75">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Accessoires</p>
                  <p className="mt-1 font-semibold text-white">{resolvedLoadout.equippedAccessoryIds.length > 0 ? resolvedLoadout.equippedAccessoryIds.length : 'aucun'}</p>
                </div>
                <div className="rounded-[1rem] border border-white/8 bg-black/20 px-3 py-3 text-sm text-white/75">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Prochain niveau</p>
                  <p className="mt-1 font-semibold text-white">{xpRequiredForLevel(xpSnapshot.level + 1)} XP total</p>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white/78 transition hover:bg-white/10">
            Annuler
          </button>
          <button type="button" onClick={onSave} disabled={submitting} className="rounded-full border border-cyan-300/25 bg-cyan-300/12 px-5 py-3 font-semibold text-cyan-50 transition hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? 'Sauvegarde…' : 'Sauver mon loadout'}
          </button>
        </div>
      </div>
    </div>
  );
}
