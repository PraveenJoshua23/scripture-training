import type { Metadata, Viewport } from 'next';
import { Source_Sans_3, Source_Serif_4, Noto_Sans_Tamil } from 'next/font/google';
import './globals.css';
import { StoreProvider } from '@/lib/store';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';

const ui = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-ui',
  display: 'swap',
});

const serif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif-en',
  display: 'swap',
});

const tamil = Noto_Sans_Tamil({
  subsets: ['tamil'],
  variable: '--font-tamil',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Scripture Training',
  description: 'Memorise Revelation in English and Tamil through typing, blanks, voice, and listening.',
};

export const viewport: Viewport = {
  themeColor: '#a8761f',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${serif.variable} ${tamil.variable}`}>
      <body className="min-h-dvh flex flex-col">
        <StoreProvider>
          <Nav />
          <main className="flex-1 w-full max-w-3xl mx-auto px-4 pb-16 pt-6">{children}</main>
          <Footer />
        </StoreProvider>
      </body>
    </html>
  );
}
