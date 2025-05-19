"use client";

import { useUser } from '@/contexts/user-context';
import { EntryForm } from '@/components/specific/entry-form';
import { WeatherCard } from '@/components/specific/weather-card';
import { AnnouncementCard } from '@/components/specific/announcement-card';
import { useAnnouncements } from '@/hooks/use-announcements';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GOOGLE_MAPS_EMBED_URL, POPULATION_DATA, VILLAGE_NAME } from '@/lib/constants';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const populationHistory = [
  { year: 1950, population: 650 },
  { year: 1970, population: 800 },
  { year: 1990, population: 1100 },
  { year: 2000, population: 900 },
  { year: 2010, population: 750 },
  { year: "Günümüz", population: 425 },
];

export default function HomePage() {
  const { user, showEntryForm } = useUser();
  const { announcements } = useAnnouncements();

  const recentAnnouncements = announcements.slice(0, 3);

  if (showEntryForm || !user) {
    return <EntryForm />;
  }

  return (
    <div className="space-y-8 content-page">
      <Card className="bg-secondary/20 dark:bg-secondary/10 border-primary/30 shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl md:text-4xl font-bold text-primary">
            {VILLAGE_NAME} Hoş Geldiniz!
          </CardTitle>
          <CardDescription className="text-lg text-foreground/80">
            Merhaba {user.name} {user.surname}, köyümüzün resmi web sitesine hoş geldiniz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-foreground/90">
            Domaniç'in merkez köyü olan Çamlıca, zengin tarihi ve kültürü ile sizi bekliyor.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Son Duyurular</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentAnnouncements.length > 0 ? (
                recentAnnouncements.map(ann => (
                  <AnnouncementCard key={ann.id} announcement={ann} isCompact={true} />
                ))
              ) : (
                <p className="text-muted-foreground">Henüz duyuru bulunmamaktadır.</p>
              )}
              {announcements.length > 3 && (
                <div className="text-center mt-4">
                  <Button asChild variant="link">
                    <Link href="/announcements">Tüm Duyuruları Gör</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Köy Haritası</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video rounded-md overflow-hidden">
                <iframe
                  src={GOOGLE_MAPS_EMBED_URL}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen={false}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
              </div>
              <p className="text-center mt-3">
                <a
                  href="https://maps.app.goo.gl/TdNCaaRwhZ61oA5QA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Google Maps'te görüntüle
                </a>
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>{VILLAGE_NAME} Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p><strong>Nüfus:</strong> 425 kişi (199 erkek, 226 kadın)</p>
              <p><strong>Muhtar:</strong> Numan YAŞAR</p>
              <p><strong>Konum:</strong> Domaniç ilçe merkezine 8 km, Kütahya il merkezine 85 km</p>
              <p><strong>Rakım:</strong> 800 m</p>
              
              <h4 className="font-semibold mt-4 pt-3 border-t">Tarihsel Nüfus Gelişimi</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Yıl</TableHead>
                    <TableHead className="text-right">Nüfus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {populationHistory.map(item => (
                    <TableRow key={item.year}>
                      <TableCell>{item.year}</TableCell>
                      <TableCell className="text-right">{item.population}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <WeatherCard />
        </div>
      </div>
    </div>
  );
}