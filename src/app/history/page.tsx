
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TIMELINE_EVENTS, VILLAGE_NAME, STATIC_GALLERY_IMAGES_FOR_SEEDING } from '@/lib/constants';
import Image from 'next/image';
import { ScrollText } from 'lucide-react';

export default function HistoryPage() {
  return (
    <div className="space-y-8 content-page">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center">
            <ScrollText className="mr-3 h-8 w-8" /> {VILLAGE_NAME} Tarihi
          </CardTitle>
          <CardDescription className="text-lg">
            Köyümüzün geçmişten günümüze uzanan yolculuğu ve önemli olaylar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-3 gap-8 items-start">
            <div className="md:col-span-1 space-y-4">
              <div className="relative aspect-[4/3] rounded-lg overflow-hidden shadow-md">
                <Image
                  src={STATIC_GALLERY_IMAGES_FOR_SEEDING[0].src}
                  alt={STATIC_GALLERY_IMAGES_FOR_SEEDING[0].alt}
                  layout="fill"
                  objectFit="cover"
                  data-ai-hint={STATIC_GALLERY_IMAGES_FOR_SEEDING[0].hint || "mosque historic"}
                />
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 text-white text-sm text-center">
                  {STATIC_GALLERY_IMAGES_FOR_SEEDING[0].caption} (Tarihi Çamlıca Camii)
                </div>
              </div>
              <div className="relative aspect-[4/3] rounded-lg overflow-hidden shadow-md">
                <Image
                  src={STATIC_GALLERY_IMAGES_FOR_SEEDING[4].src}
                  alt={STATIC_GALLERY_IMAGES_FOR_SEEDING[4].alt}
                  layout="fill"
                  objectFit="cover"
                  data-ai-hint={STATIC_GALLERY_IMAGES_FOR_SEEDING[4].hint || "traditional building"}
                />
                 <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 text-white text-sm text-center">
                  {STATIC_GALLERY_IMAGES_FOR_SEEDING[4].caption} (Geleneksel Köy Mimarisi)
                </div>
              </div>
            </div>
            <div className="md:col-span-2 space-y-4">
              <p className="text-foreground/90 leading-relaxed">
                Çamlıca Köyü'nün kökleri, Osmanlı İmparatorluğu'nun erken dönemlerine kadar uzanmaktadır. 16. ve 17. yüzyıllarda, Osmanlıların bölgedeki hakimiyetini pekiştirmesiyle birlikte, Yörük göçebelerinden oluşan 8-9 aile bu topraklara yerleşmiştir. Bu ailelerden bir kısmı su kaynaklarına yakınlığı nedeniyle bugünkü Yeşilköy civarına, bir kısmı çam ağaçlarıyla kaplı olan Çamlıca'ya, bir kısmı da ormanlık Kozluca bölgesine yerleşmiştir.
              </p>
              <p className="text-foreground/90 leading-relaxed">
                Köyün eski adı "Göçebe" olup, bu isim göçebe yaşam tarzını yansıtmaktadır. 1928 yılına kadar (bazı kaynaklara göre 1955'e kadar) bu isimle anılan köy, o tarihlerde görev yapan bir öğretmen tarafından, etrafını saran çam ağaçlarından esinlenilerek "Çamlıca" olarak değiştirilmiştir.
              </p>
              <p className="text-foreground/90 leading-relaxed">
                Zamanla büyüyüp gelişen Çamlıca, Domaniç ilçesinin merkezi köyü konumuna gelmiştir. Köyümüzün tarihinde önemli bir yere sahip olan ve yaklaşık 1000 yaşında olduğu tahmin edilen "Hasan Çamı" adında anıt bir çam ağacı da bulunmaktadır. Bu zengin tarih, çoğunlukla yazılı kaynaklardan ziyade nesilden nesile aktarılan sözlü geleneklerle günümüze ulaşmıştır.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zaman Tüneli</CardTitle>
          <CardDescription>Köyümüzün tarihindeki önemli dönüm noktaları.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="timeline">
            {TIMELINE_EVENTS.map((event, index) => (
              <div key={index} className="timeline-item">
                <div className="timeline-marker"></div>
                <div className="timeline-content">
                  <h4 className="font-semibold text-primary">{event.year}</h4>
                  <p className="text-sm text-foreground/80">{event.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
