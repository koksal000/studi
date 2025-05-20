
"use client"; 

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VILLAGE_NAME } from '@/lib/constants';
import Image from 'next/image';
import { Camera, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useGallery, type GalleryImage } from '@/hooks/use-gallery';

export default function GalleryPage() {
  const { galleryImages, isLoading } = useGallery();
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

  return (
    <div className="space-y-8 content-page">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary flex items-center">
            <Camera className="mr-3 h-8 w-8" /> {VILLAGE_NAME} Galerisi
          </CardTitle>
          <CardDescription className="text-lg">
            Köyümüzün güzelliklerini yansıtan fotoğraf kareleri.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Galeri yükleniyor...</p>
            </div>
          )}
          {!isLoading && galleryImages.length === 0 && (
            <p className="text-center py-10 text-muted-foreground">Galeride gösterilecek resim bulunmamaktadır.</p>
          )}
          {!isLoading && galleryImages.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {galleryImages.map((image) => (
                <div
                  key={image.id}
                  className="gallery-item"
                  onClick={() => setSelectedImage(image)}
                >
                  <Image src={image.src} alt={image.alt} layout="fill" objectFit="cover" data-ai-hint={image.hint} />
                  <div className="gallery-caption">
                    <h4 className="font-semibold text-sm truncate">{image.caption}</h4>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-3xl p-2 sm:p-4">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">{selectedImage.caption}</DialogTitle>
            </DialogHeader>
            <div className="mt-2 aspect-[16/10] w-full relative rounded-md overflow-hidden bg-muted">
              <Image src={selectedImage.src} alt={selectedImage.alt} layout="fill" objectFit="contain" data-ai-hint={selectedImage.hint}/>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
