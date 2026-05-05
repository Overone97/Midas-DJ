import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { RoomsShowcase } from '@/components/rooms-showcase';
import { hasSupabaseEnv } from '@/lib/supabase/env';

export default function RoomsPage() {
  return (
    <AppShell
      eyebrow="Rooms"
      title="Le lobby Midas DJ prend forme"
      description="Liste publique, aperçu des rooms privées et parcours de création/rejoindre : assez réaliste pour guider la suite, sans sacrifier l’export statique."
      actions={
        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/72">
          Supabase env {hasSupabaseEnv() ? 'connectées' : 'absentes'}
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-white/72">
            Chargement du lobby…
          </div>
        }
      >
        <RoomsShowcase envReady={hasSupabaseEnv()} />
      </Suspense>
    </AppShell>
  );
}
