
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Settings, X, Search as SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/user-context';
import { SettingsDialog } from '@/components/specific/settings-dialog';
import { NAVIGATION_LINKS, VILLAGE_NAME }
from '@/lib/constants';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';

export function Navbar() {
  const pathname = usePathname();
  const { user } = useUser();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
      // Arama çubuğunu temizleyebiliriz veya arama sayfasında terimin görünmesi için bırakabiliriz.
      // Şimdilik temizleyelim, arama sayfası zaten terimi URL'den alacak.
      // setSearchTerm(''); 
    }
  };
  
  // Close sheet on navigation
  useEffect(() => {
    setIsSheetOpen(false);
  }, [pathname]);


  if (!user) {
    return null; // Don't render Navbar if user is not logged in (EntryForm will be shown)
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            {/* <Mountain className="h-6 w-6 text-primary" /> */}
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-primary">
              <path d="M12 2L1 9l3 11h16l3-11L12 2zm0 2.36L17.64 9H6.36L12 4.36zM4.58 10h14.84l-2.4 8H6.98l-2.4-8z"/>
              <path d="M10 11h4v6h-4z"/> {/* Represents a simple house/village structure */}
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
             <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}>
              <Settings className="h-5 w-5" />
              <span className="sr-only">Ayarlar</span>
            </Button>
          </nav>
         
          <div className="hidden md:flex items-center ml-4">
             <form onSubmit={handleSearch} className="relative">
                <Input 
                  type="search" 
                  placeholder="Sitede ara..." 
                  className="h-9 pr-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button type="submit" variant="ghost" size="icon" className="absolute right-0 top-1/2 -translate-y-1/2 h-9 w-9">
                  <SearchIcon className="h-4 w-4" />
                  <span className="sr-only">Ara</span>
                </Button>
              </form>
          </div>


          <div className="md:hidden">
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Menüyü Aç</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px] bg-background p-0">
                <div className="flex flex-col h-full">
                  <SheetHeader className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <Link href="/" className="flex items-center space-x-2" onClick={() => setIsSheetOpen(false)}>
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-primary">
                        <path d="M12 2L1 9l3 11h16l3-11L12 2zm0 2.36L17.64 9H6.36L12 4.36zM4.58 10h14.84l-2.4 8H6.98l-2.4-8z"/>
                        <path d="M10 11h4v6h-4z"/>
                      </svg>
                      <SheetTitle className="p-0 text-lg font-bold">{VILLAGE_NAME} Menüsü</SheetTitle>
                      </Link>
                    </div>
                  </SheetHeader>
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
                        <Button type="submit" variant="ghost" size="icon" className="absolute right-0 top-1/2 -translate-y-1/2 h-9 w-9">
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
    </>
  );
}
