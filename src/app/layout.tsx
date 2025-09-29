
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
import { NotificationManager } from '@/components/specific/notification-manager';
import { OneSignalProvider } from '@/contexts/onesignal-context';
import Script from 'next/script';


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
        <link rel="manifest" href="/manifest.json" />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6542591429414591"
          crossOrigin="anonymous"
        ></script>
        <Script id="onesignal-sdk" strategy="afterInteractive">
          {`
            window.OneSignalDeferred = window.OneSignalDeferred || [];
            OneSignalDeferred.push(async function(OneSignal) {
              try {
                await OneSignal.init({
                  appId: "af7c8099-b2c1-4376-be91-afb88be83161",
                });
              } catch (error) {
                console.error("OneSignal Init Error:", error);
              }
            });
          `}
        </Script>
      </head>
      <body className={`antialiased flex flex-col min-h-screen`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <OneSignalProvider>
            <UserProvider>
              <SettingsProvider>
                <AnnouncementStatusProvider>
                  <Navbar />
                  <main className="flex-grow container mx-auto px-4 py-8">
                    {children}
                  </main>
                  <Footer />
                  <Toaster />
                </AnnouncementStatusProvider>
              </SettingsProvider>
            </UserProvider>
          </OneSignalProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
