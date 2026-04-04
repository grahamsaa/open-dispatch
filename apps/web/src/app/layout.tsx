import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OpenDispatch',
  description: 'Local AI agent orchestration',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <header className="border-b border-gray-800 px-6 py-4">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <h1 className="text-xl font-bold tracking-tight">OpenDispatch</h1>
            <span className="text-sm text-gray-500">Local AI Agent Orchestration</span>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
