import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mandate — Investment Desk',
  description: 'Cited equity research, reviewable paper orders, and enforced investment permissions for small investment teams.',
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="sr-only skip-link" href="#main-content">Skip to main content</a>{children}</body></html>;
}
