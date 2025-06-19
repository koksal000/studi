
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { UserProvider } from '@/contexts/user-context';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { Toaster } from '@/components/ui/toaster';
import { SettingsProvider } from '@/contexts/settings-context';
import { AnnouncementStatusProvider } from '@/contexts/announcement-status-context';
import { GoogleAdScript } from '@/components/specific/google-ad-script';
import { FirebaseMessagingProvider } from '@/contexts/firebase-messaging-context'; // New import

export const metadata: Metadata = {
  title: 'KöyümDomaniç - Çamlıca Köyü Portalı',
  description: 'Domaniç Çamlıca Köyü resmi web sitesi.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        {/* AdSense script'i GoogleAdScript bileşenine taşındı */}
      </head>
      <body className={`antialiased flex flex-col min-h-screen`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <UserProvider>
            <SettingsProvider>
              <AnnouncementStatusProvider>
                <FirebaseMessagingProvider> {/* FCM Provider added */}
                  <Navbar />
                  <main className="flex-grow container mx-auto px-4 py-8">
                    {children}
                  </main>
                  <Footer />
                  <Toaster />
                  <GoogleAdScript />
                </FirebaseMessagingProvider>
              </AnnouncementStatusProvider>
            </SettingsProvider>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
