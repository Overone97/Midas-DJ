import { AppShell } from '@/components/app-shell';
import { AuthCard } from '@/components/auth-card';
import { hasSupabaseEnv } from '@/lib/supabase/env';

export default function LoginPage() {
  return (
    <AppShell
      eyebrow="Connexion"
      title="Welcome back to the booth"
      description="Un flux de connexion simple, crédible et déjà prêt à accueillir Supabase Auth dès que les variables d’environnement sont branchées."
    >
      <AuthCard mode="login" envReady={hasSupabaseEnv()} />
    </AppShell>
  );
}
