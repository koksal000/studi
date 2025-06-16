
"use client";

import { useUser } from '@/contexts/user-context';
import Script from 'next/script'; // next/script kullanımı daha iyi
import { useEffect, useState } from 'react';

export function GoogleAdScript() {
  const { user, showEntryForm, isUserLoading } = useUser();
  const [canLoadAds, setCanLoadAds] = useState(false);

  useEffect(() => {
    // Sadece kullanıcı yüklendikten ve giriş formu gösterilmiyorsa
    // ve bir kullanıcı varsa reklamları yüklemeyi düşün.
    if (!isUserLoading && !showEntryForm && user) {
      setCanLoadAds(true);
    } else {
      setCanLoadAds(false);
    }
  }, [user, showEntryForm, isUserLoading]);

  if (!canLoadAds) {
    return null;
  }

  // next/script ile AdSense script'ini yükle
  // process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID gibi bir çevre değişkeni kullanmak daha iyi olurdu.
  // Şimdilik sabit değeri kullanıyoruz.
  return (
    <Script
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6542591429414591"
      crossOrigin="anonymous"
      strategy="afterInteractive" // Sayfa etkileşimli hale geldikten sonra yükle
      onError={(e) => {
        console.error('AdSense Script failed to load', e);
      }}
    />
  );
}
