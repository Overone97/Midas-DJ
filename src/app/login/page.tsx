import { AppShell } from '@/components/app-shell';
import { AuthCard } from '@/components/auth-card';
import { hasSupabaseEnv } from '@/lib/supabase/env';

export default function LoginPage() {
  return (
    <AppShell
      eyebrow="Connexion"
      title="Welcome back to the booth"
      description="Le flux de connexion est maintenant branché sur Supabase côté client. Si les variables publiques sont présentes dans la build, tu peux vraiment te connecter."
    >
      <AuthCard mode="login" envReady={hasSupabaseEnv()} />
    </AppShell>
  );
}
