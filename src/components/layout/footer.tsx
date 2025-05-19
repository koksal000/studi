"use client";

import { VILLAGE_NAME } from '@/lib/constants';

export function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="border-t bg-background">
      <div className="container py-6 text-center text-sm text-muted-foreground">
        <p>&copy; {currentYear} {VILLAGE_NAME} | Tüm Hakları Saklıdır.</p>
      </div>
    </footer>
  );
}