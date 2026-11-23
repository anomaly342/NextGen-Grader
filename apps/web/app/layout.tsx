import type { Metadata } from 'next';
import { JetBrains_Mono, Manrope } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
});

const jetBrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'NextGen Grader',
  description: 'Programming judge for KMUTNB',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
