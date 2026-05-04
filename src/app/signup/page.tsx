import { AppShell } from '@/components/app-shell';
import { AuthCard } from '@/components/auth-card';
import { hasSupabaseEnv } from '@/lib/supabase/env';

export default function SignupPage() {
  return (
    <AppShell
      eyebrow="Inscription"
      title="Claim your Midas identity"
      description="Le signup est maintenant branché sur Supabase côté client pour créer un vrai compte, préparer ton profil et amorcer les rooms privées."
    >
      <AuthCard mode="signup" envReady={hasSupabaseEnv()} />
    </AppShell>
  );
}
