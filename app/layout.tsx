import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mandate — Investment Desk',
  description: 'Cited equity research, reviewable paper orders, and enforced investment permissions for small investment teams.',
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><head><link rel="preload" href="/fonts/geist-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" /></head><body><a className="sr-only skip-link" href="#main-content">Skip to main content</a>{children}</body></html>;
}
