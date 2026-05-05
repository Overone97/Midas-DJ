import { AppShell } from '@/components/app-shell';
import { LiveRoomPage } from '@/components/live-room-page';
import { featuredRooms, getPreviewRoomState } from '@/lib/rooms';
import { hasSupabaseEnv } from '@/lib/supabase/env';

export function generateStaticParams() {
  return featuredRooms.map((room) => ({ slug: room.slug }));
}

export default async function RoomSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <AppShell
      eyebrow="Room"
      title={`Room · ${slug}`}
      description={
        hasSupabaseEnv()
          ? 'Route statique compatible GitHub Pages, puis hydratation live côté client pour la vraie room.'
          : 'Fallback statique GitHub Pages : la room garde une vraie URL crédible même sans backend branché.'
      }
    >
      <LiveRoomPage initialState={getPreviewRoomState(slug)} />
    </AppShell>
  );
}
