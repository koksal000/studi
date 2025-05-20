
"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAnnouncements, type Announcement } from '@/hooks/use-announcements';
import { NAVIGATION_LINKS, VILLAGE_NAME, CONTACT_INFO, TIMELINE_EVENTS, ECONOMY_DATA, POPULATION_DATA, GALLERY_IMAGES } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SearchX, FileText, Newspaper, Landmark, History, Phone, Image as ImageIcon, Users, BarChart3, Sparkles, Loader2 } from 'lucide-react';
import Image from 'next/image'; // For gallery images in results

interface SearchResultItem {
  type: 'Duyuru' | 'Sayfa' | 'Tarihi Olay' | 'Galeri Öğesi' | 'Genel Bilgi';
  title: string;
  contentSnippet?: string;
  link: string;
  source: string;
  imageUrl?: string; // For gallery items
  originalData?: any;
}

export default function SearchResultsPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q');
  const { announcements } = useAnnouncements();
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTermDisplay, setSearchTermDisplay] = useState('');

  useEffect(() => {
    if (query) {
      setSearchTermDisplay(query);
      setIsLoading(true);
      const searchTerm = query.toLowerCase().trim();
      const foundResults: SearchResultItem[] = [];

      // Search Announcements
      announcements.forEach(ann => {
        if (ann.title.toLowerCase().includes(searchTerm) || ann.content.toLowerCase().includes(searchTerm) || ann.author.toLowerCase().includes(searchTerm)) {
          foundResults.push({
            type: 'Duyuru',
            title: ann.title,
            contentSnippet: ann.content.substring(0, 150) + (ann.content.length > 150 ? '...' : ''),
            link: `/announcements`, // Link to announcements page
            source: `Duyurular - ${ann.author}`,
            originalData: ann
          });
        }
      });

      // Search Navigation Links (Pages) and their content keywords
      NAVIGATION_LINKS.forEach(page => {
        let pageContentKeywords = page.label.toLowerCase();
        let match = false;

        if (page.href === '/about') {
            pageContentKeywords += ` köy hakkında nüfus ekonomi coğrafi konum ${POPULATION_DATA.labels.join(' ')} ${ECONOMY_DATA.labels.join(' ')}`;
        } else if (page.href === '/history') {
            pageContentKeywords += ` tarih geçmiş osmanlı göçebe ${TIMELINE_EVENTS.map(e => `${e.year} ${e.description}`).join(' ').toLowerCase()}`;
        } else if (page.href === '/gallery') {
            pageContentKeywords += ` galeri fotoğraf resim ${GALLERY_IMAGES.map(img => img.caption.toLowerCase() + ' ' + img.alt.toLowerCase()).join(' ')}`;
        } else if (page.href === '/contact') {
            pageContentKeywords += ` iletişim adres muhtar e-posta ${CONTACT_INFO.address.toLowerCase()} ${CONTACT_INFO.muhtar.toLowerCase()} ${CONTACT_INFO.email.toLowerCase()}`;
        } else if (page.href === '/ai-assistant') {
            pageContentKeywords += ` yapay zeka asistan sohbet soru sorma ${VILLAGE_NAME.toLowerCase()}`;
        }
        
        if (pageContentKeywords.includes(searchTerm)) {
            match = true;
        }


        if (match) {
          if (!foundResults.some(r => r.link === page.href && r.type === 'Sayfa')) {
            foundResults.push({
              type: 'Sayfa',
              title: page.label,
              link: page.href,
              source: 'Site Sayfası',
              originalData: page
            });
          }
        }
      });
      
      // Search Timeline Events directly
      TIMELINE_EVENTS.forEach(event => {
        if (event.year.toLowerCase().includes(searchTerm) || event.description.toLowerCase().includes(searchTerm)) {
          if (!foundResults.some(r => r.type === 'Tarihi Olay' && r.title.includes(event.year))) {
            foundResults.push({
              type: 'Tarihi Olay',
              title: `${event.year}: ${event.description.substring(0,100)}...`,
              contentSnippet: event.description,
              link: '/history',
              source: 'Tarihçe',
              originalData: event
            });
          }
        }
      });

      // Search Gallery Images captions/alt text
      GALLERY_IMAGES.forEach(image => {
        if (image.caption.toLowerCase().includes(searchTerm) || image.alt.toLowerCase().includes(searchTerm) || image.hint.toLowerCase().includes(searchTerm)) {
           if (!foundResults.some(r => r.type === 'Galeri Öğesi' && r.title === image.caption)) {
            foundResults.push({
                type: 'Galeri Öğesi',
                title: image.caption,
                link: '/gallery', // Could link to gallery and open modal with this image
                source: 'Galeri',
                imageUrl: image.src,
                originalData: image
            });
           }
        }
      });

      // Search General Info
      const generalInfoChecks = [
        { term: VILLAGE_NAME.toLowerCase(), title: VILLAGE_NAME, source: 'Genel Bilgi', link: '/about' },
        { term: CONTACT_INFO.muhtar.toLowerCase(), title: `Muhtar: ${CONTACT_INFO.muhtar}`, source: 'İletişim', link: '/contact' },
        { term: CONTACT_INFO.address.toLowerCase(), title: `Adres: ${CONTACT_INFO.address}`, source: 'İletişim', link: '/contact' },
        { term: CONTACT_INFO.email.toLowerCase(), title: `E-posta: ${CONTACT_INFO.email}`, source: 'İletişim', link: '/contact' },
        { term: "nüfus", title: `Nüfus Bilgileri (${POPULATION_DATA.labels[POPULATION_DATA.labels.length-1]}: ${POPULATION_DATA.datasets[0].data[POPULATION_DATA.datasets[0].data.length-1]})`, source: `Hakkında Sayfası`, link: '/about' },
        { term: "ekonomi", title: `Ekonomik Yapı (Tarım, Hayvancılık vb.)`, source: `Hakkında Sayfası`, link: '/about' },
      ];

      generalInfoChecks.forEach(info => {
        if (searchTerm.includes(info.term) || info.term.includes(searchTerm)) { // Check both ways for broader matching
           if (!foundResults.some(r => r.type === 'Genel Bilgi' && r.title === info.title)) {
            foundResults.push({
                type: 'Genel Bilgi',
                title: info.title,
                link: info.link,
                source: info.source
            });
           }
        }
      });
      
      // Remove strict duplicates (e.g. a page found via label and then again via general info keyword)
      const uniqueResults = foundResults.reduce((acc, current) => {
        const x = acc.find(item => item.link === current.link && item.title === current.title && item.type === current.type && item.source === current.source);
        if (!x) {
          return acc.concat([current]);
        } else {
          return acc;
        }
      }, [] as SearchResultItem[]);


      setResults(uniqueResults);
      setIsLoading(false);
    } else {
      setResults([]);
      setIsLoading(false);
      setSearchTermDisplay('');
    }
  }, [query, announcements]);

  const getIconForType = (type: SearchResultItem['type']) => {
    switch (type) {
      case 'Duyuru': return <Newspaper className="h-5 w-5 text-primary" />;
      case 'Sayfa': return <FileText className="h-5 w-5 text-accent" />;
      case 'Tarihi Olay': return <History className="h-5 w-5 text-blue-500" />;
      case 'Galeri Öğesi': return <ImageIcon className="h-5 w-5 text-green-500" />;
      case 'Genel Bilgi': 
        if(results.find(r => r.title.includes("Muhtar")) || results.find(r => r.title.includes("Adres")) || results.find(r => r.title.includes("E-posta"))) return <Phone className="h-5 w-5 text-purple-500" />;
        if(results.find(r => r.title.includes("Nüfus"))) return <Users className="h-5 w-5 text-red-500" />;
        if(results.find(r => r.title.includes("Ekonomi"))) return <BarChart3 className="h-5 w-5 text-orange-500" />;
        return <Landmark className="h-5 w-5 text-indigo-500" />;
      default: return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };


  return (
    <div className="space-y-8 content-page">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary">
            Arama Sonuçları
          </CardTitle>
          {query && (
            <CardDescription className="text-lg">
              <span className="font-semibold">&quot;{searchTermDisplay}&quot;</span> için bulunan sonuçlar:
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Arama yapılıyor...</p>
            </div>
          )}
          {!isLoading && !query && (
            <div className="text-center py-10">
              <SearchX className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-xl text-muted-foreground">Lütfen aramak için bir terim girin.</p>
            </div>
          )}
          {!isLoading && query && results.length === 0 && (
            <div className="text-center py-10">
              <SearchX className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-xl text-muted-foreground">Aradığınız kriterlere uygun sonuç bulunamadı.</p>
              <p className="text-muted-foreground mt-2">Lütfen farklı anahtar kelimelerle tekrar deneyin.</p>
            </div>
          )}
          {!isLoading && results.length > 0 && (
            <div className="space-y-6">
              {results.map((item, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                           {getIconForType(item.type)}
                           <CardTitle className="text-xl">{item.title}</CardTitle>
                        </div>
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">{item.type}</span>
                    </div>
                    <CardDescription>Kaynak: {item.source}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {item.imageUrl && item.type === 'Galeri Öğesi' && (
                        <div className="my-2 w-full aspect-video relative rounded-md overflow-hidden bg-muted max-w-xs mx-auto sm:mx-0">
                            <Image src={item.imageUrl} alt={item.title} layout="fill" objectFit="cover" data-ai-hint={item.originalData?.hint || "gallery image"}/>
                        </div>
                    )}
                    {item.contentSnippet && (
                      <p className="text-foreground/80 mb-3">{item.contentSnippet}</p>
                    )}
                     <Button asChild variant="link" className="p-0 h-auto">
                        <Link href={item.link}>
                            {item.type === 'Duyuru' ? 'Duyurulara Git' : item.type === 'Galeri Öğesi' ? 'Galeriye Git' : 'Sayfaya Git'}
                        </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
