import { AppShell } from '@/components/app-shell';
import { AuthCard } from '@/components/auth-card';
import { hasSupabaseEnv } from '@/lib/supabase/env';

export default function SignupPage() {
  return (
    <AppShell
      eyebrow="Inscription"
      title="Claim your Midas identity"
      description="Réserve ton pseudo, prépare tes rooms privées et pose la première brique de ton profil social listening."
    >
      <AuthCard mode="signup" envReady={hasSupabaseEnv()} />
    </AppShell>
  );
}
