import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Midas DJ',
  description: 'A modern social listening platform inspired by plug.dj.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
