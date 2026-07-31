import type { Metadata } from 'next';
import { SpriteSheet } from '@/components/atoms/SpriteSheet';
import { ThemeScript } from '@/lib/theme/theme-script';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'OSRS Clan Toolkit',
    template: '%s · OSRS Clan Toolkit',
  },
  description:
    'Grand Exchange, combat, skilling and clan tools for Old School RuneScape.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: ThemeScript mutates the class on <html> before
    // React hydrates, so server and client markup legitimately differ here.
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh antialiased">
        {/* One copy of the sprite artwork for the whole app; every <Sprite> is a
            <use href> pointing at it. Inlining seven sprites into 27 routes
            would be dead weight. */}
        <SpriteSheet />
        {children}
      </body>
    </html>
  );
}
