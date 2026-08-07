import { Poppins } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';
import type { Metadata } from 'next';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Lab Inventory System',
  description: 'Laboratory Inventory Management System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={poppins.className}>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            containerStyle={{ zIndex: 99999, top: 16, right: 16 }}
            toastOptions={{
              duration: 4000,
              style: {
                fontFamily: 'inherit',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: '10px',
                padding: '12px 16px',
                maxWidth: '380px',
                boxShadow: '0 4px 24px 0 rgba(0,0,0,0.18)',
              },
              success: {
                style: {
                  background: '#16a34a',
                  color: '#ffffff',
                },
                iconTheme: { primary: '#ffffff', secondary: '#16a34a' },
              },
              error: {
                duration: 5000,
                style: {
                  background: '#dc2626',
                  color: '#ffffff',
                },
                iconTheme: { primary: '#ffffff', secondary: '#dc2626' },
              },
              loading: {
                style: {
                  background: '#1e40af',
                  color: '#ffffff',
                },
                iconTheme: { primary: '#ffffff', secondary: '#1e40af' },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
