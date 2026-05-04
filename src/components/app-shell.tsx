import Link from 'next/link';
import { ReactNode } from 'react';

type AppShellProps = {
  children: ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

const nav = [
  { href: '/', label: 'Accueil' },
  { href: '/rooms', label: 'Rooms' },
  { href: '/login', label: 'Login' },
  { href: '/signup', label: 'Signup' },
  { href: '/docs', label: 'Docs' },
];

export function AppShell({ children, eyebrow, title, description, actions }: AppShellProps) {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-8 md:px-10 md:py-12">
      <header className="mb-10 rounded-[2rem] border border-white/10 bg-black/20 p-5 backdrop-blur">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="inline-flex items-center gap-3 text-lg font-black tracking-[0.18em] text-gold">
              <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs uppercase tracking-[0.3em]">
                Midas DJ
              </span>
              v1.1.0
            </Link>
            <div className="mt-4 space-y-3">
              {eyebrow ? <p className="text-sm uppercase tracking-[0.25em] text-gold/75">{eyebrow}</p> : null}
              <h1 className="text-4xl font-black tracking-tight md:text-6xl">{title}</h1>
              <p className="max-w-3xl text-base text-white/72 md:text-lg">{description}</p>
            </div>
          </div>

          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>

        <nav className="mt-6 flex flex-wrap gap-2 text-sm text-white/78">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 transition hover:border-gold/30 hover:text-gold"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {children}
    </main>
  );
}
