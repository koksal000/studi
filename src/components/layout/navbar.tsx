
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Settings, X, Search as SearchIcon, Lock, Bell } from 'lucide-react'; // Bell eklendi
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'; // Popover importları
import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/user-context';
import { SettingsDialog } from '@/components/specific/settings-dialog';
import { AdminPasswordDialog } from '@/components/specific/admin-password-dialog';
import { NAVIGATION_LINKS, VILLAGE_NAME, ADMIN_PANEL_PATH } from '@/lib/constants';
import { Input } from '@/components/ui/input';
import { useAnnouncements } from '@/hooks/use-announcements'; // Yeni import
import { useAnnouncementStatus } from '@/contexts/announcement-status-context'; // Yeni import
import { AnnouncementPopoverContent } from '@/components/specific/announcement-popover-content'; // Yeni import


export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminPasswordDialogOpen, setIsAdminPasswordDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNotificationPopoverOpen, setIsNotificationPopoverOpen] = useState(false);

  const { announcements, unreadCount } = useAnnouncements(); // unreadCount alındı
  const { setLastOpenedNotificationTimestamp } = useAnnouncementStatus();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
      setIsSheetOpen(false); 
      setSearchTerm('');
    }
  };
  
  useEffect(() => {
    setIsSheetOpen(false);
  }, [pathname]);

  const handleAdminPanelAccess = () => {
    setIsAdminPasswordDialogOpen(true);
  };

  const onAdminVerifiedForPanel = () => {
    setIsAdminPasswordDialogOpen(false);
    router.push(ADMIN_PANEL_PATH);
  };

  const handleNotificationPopoverOpenChange = (open: boolean) => {
    setIsNotificationPopoverOpen(open);
    if (open) {
      setLastOpenedNotificationTimestamp(Date.now());
    }
  };

  if (!user) {
    return null; 
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="mr-6 flex items-center space-x-2">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-primary">
              <path d="M12 2L1 9l3 11h16l3-11L12 2zm0 2.36L17.64 9H6.36L12 4.36zM4.58 10h14.84l-2.4 8H6.98l-2.4-8z"/>
              <path d="M10 11h4v6h-4z"/> 
            </svg>
            <span className="font-bold sm:inline-block text-lg">
              {VILLAGE_NAME}
            </span>
          </Link>

          <nav className="hidden items-center space-x-1 md:flex">
            {NAVIGATION_LINKS.map((link) => (
              <Button key={link.href} variant={pathname === link.href ? "secondary" : "ghost"} size="sm" asChild>
                <Link href={link.href}>{link.label}</Link>
              </Button>
            ))}
          </nav>
         
          <div className="flex items-center ml-auto md:ml-4 gap-1"> {/* ml-auto eklendi, md:ml-4 korundu, gap eklendi */}
            <form onSubmit={handleSearch} className="relative hidden md:block"> {/* Sadece masaüstünde göster */}
                <Input 
                  type="search" 
                  placeholder="Sitede ara..." 
                  className="h-9 pr-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button type="submit" variant="ghost" size="icon" className="absolute right-0 top-1/2 -translate-y-1/2 h-9 w-9" title="Ara">
                  <SearchIcon className="h-4 w-4" />
                  <span className="sr-only">Ara</span>
                </Button>
            </form>

            <Popover open={isNotificationPopoverOpen} onOpenChange={handleNotificationPopoverOpenChange}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" title="Bildirimler" className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-2.5 w-2.5 items-center justify-center">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                    </span>
                  )}
                  <span className="sr-only">Bildirimler</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <AnnouncementPopoverContent 
                  announcements={announcements} 
                  onClose={() => setIsNotificationPopoverOpen(false)} 
                />
              </PopoverContent>
            </Popover>

            <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)} title="Ayarlar" className="hidden md:inline-flex"> {/* Sadece masaüstünde */}
              <Settings className="h-5 w-5" />
              <span className="sr-only">Ayarlar</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleAdminPanelAccess} title="Yönetici Paneli" className="text-destructive hover:bg-destructive/10 hover:text-destructive hidden md:inline-flex"> {/* Sadece masaüstünde */}
              <Lock className="h-5 w-5" />
              <span className="sr-only">Yönetici Paneli</span>
            </Button>
          </div>


          <div className="md:hidden ml-2"> {/* Mobil menü için trigger'ı sağa yasla */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Menüyü Aç</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px] bg-background p-0">
                <SheetHeader className="p-4 border-b">
                  <div className="flex items-center justify-between">
                    <SheetClose asChild>
                      <Link href="/" className="flex items-center space-x-2" onClick={() => setIsSheetOpen(false)}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-primary">
                          <path d="M12 2L1 9l3 11h16l3-11L12 2zm0 2.36L17.64 9H6.36L12 4.36zM4.58 10h14.84l-2.4 8H6.98l-2.4-8z"/>
                          <path d="M10 11h4v6h-4z"/>
                        </svg>
                        <SheetTitle className="p-0 text-lg font-bold">{VILLAGE_NAME} Menüsü</SheetTitle>
                      </Link>
                    </SheetClose>
                  </div>
                </SheetHeader>
                <div className="flex flex-col h-full">
                  <nav className="flex-grow flex flex-col space-y-2 p-4">
                    {NAVIGATION_LINKS.map((link) => (
                      <SheetClose asChild key={link.href}>
                        <Link href={link.href}>
                          <Button variant={pathname === link.href ? "secondary" : "ghost"} className="w-full justify-start">
                            {link.label}
                          </Button>
                        </Link>
                      </SheetClose>
                    ))}
                     <Button variant="ghost" className="w-full justify-start" onClick={() => { setIsSheetOpen(false); setIsSettingsOpen(true); }}>
                      <Settings className="mr-2 h-5 w-5" />
                      Ayarlar
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { setIsSheetOpen(false); handleAdminPanelAccess(); }}>
                      <Lock className="mr-2 h-5 w-5" />
                      Yönetici Paneli
                    </Button>
                  </nav>
                   <div className="p-4 border-t">
                     <form onSubmit={handleSearch} className="relative">
                        <Input 
                          type="search" 
                          placeholder="Sitede ara..." 
                          className="h-9 pr-8"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Button type="submit" variant="ghost" size="icon" className="absolute right-0 top-1/2 -translate-y-1/2 h-9 w-9" title="Ara">
                          <SearchIcon className="h-4 w-4" />
                           <span className="sr-only">Ara</span>
                        </Button>
                      </form>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <SettingsDialog isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <AdminPasswordDialog 
        isOpen={isAdminPasswordDialogOpen} 
        onOpenChange={setIsAdminPasswordDialogOpen}
        onVerified={onAdminVerifiedForPanel}
      />
    </>
  );
}
