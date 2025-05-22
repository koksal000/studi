
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Settings, X, Search as SearchIcon, Lock, Bell, TreePine } from 'lucide-react'; // Added TreePine
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'; // Removed SheetClose from here
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/user-context';
import { SettingsDialog } from '@/components/specific/settings-dialog';
import { AdminPasswordDialog } from '@/components/specific/admin-password-dialog';
import { NAVIGATION_LINKS, VILLAGE_NAME, ADMIN_PANEL_PATH } from '@/lib/constants';
import { Input } from '@/components/ui/input';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useAnnouncementStatus } from '@/contexts/announcement-status-context';
import { AnnouncementPopoverContent } from '@/components/specific/announcement-popover-content';


export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminPasswordDialogOpen, setIsAdminPasswordDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNotificationPopoverOpen, setIsNotificationPopoverOpen] = useState(false);

  const { announcements, unreadCount } = useAnnouncements();
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
            <TreePine className="h-6 w-6 text-primary" /> {/* Replaced SVG with TreePine icon */}
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
         
          <div className="flex items-center ml-auto md:ml-4 gap-1">
            <form onSubmit={handleSearch} className="relative hidden md:block">
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

            <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)} title="Ayarlar" className="hidden md:inline-flex">
              <Settings className="h-5 w-5" />
              <span className="sr-only">Ayarlar</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleAdminPanelAccess} title="Yönetici Paneli" className="text-destructive hover:bg-destructive/10 hover:text-destructive hidden md:inline-flex">
              <Lock className="h-5 w-5" />
              <span className="sr-only">Yönetici Paneli</span>
            </Button>
          </div>


          <div className="md:hidden ml-2">
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Menüyü Aç</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px] bg-background p-0">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle className="text-lg font-bold">{VILLAGE_NAME} Menüsü</SheetTitle>
                  {/* Removed the explicit SheetClose here as SheetContent provides its own */}
                </SheetHeader>
                <div className="flex flex-col h-[calc(100%-var(--sheet-header-height,65px))]">
                  <div className="p-4 border-b"> {/* Search bar container */}
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
                  <nav className="flex-grow flex flex-col space-y-2 p-4 overflow-y-auto">
                    {NAVIGATION_LINKS.map((link) => (
                      <Button 
                        variant={pathname === link.href ? "secondary" : "ghost"} 
                        className="w-full justify-start" 
                        asChild 
                        key={link.href}
                        onClick={() => setIsSheetOpen(false)} // Close sheet on link click
                      >
                        <Link href={link.href}>
                          {link.label}
                        </Link>
                      </Button>
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
