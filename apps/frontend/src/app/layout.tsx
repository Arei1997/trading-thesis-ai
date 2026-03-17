import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Trading Thesis AI',
  description: 'Monitor your trading theses with AI-powered news analysis',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="border-b border-gray-800 bg-gray-950">
          <div className="max-w-3xl mx-auto px-4 py-3 flex gap-6">
            <Link href="/" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Theses
            </Link>
            <Link href="/signals" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Signals
            </Link>
            <Link href="/evaluations" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Evaluations
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
