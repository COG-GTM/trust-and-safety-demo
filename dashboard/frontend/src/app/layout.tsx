import './globals.css';

import type { Metadata } from 'next';

import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Osprey Dashboard',
  description: 'Executive analytics dashboard for the Osprey trust & safety pipeline',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-canvas text-white min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 px-6 py-6 md:px-10 md:py-8 max-w-[1600px] mx-auto w-full">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
