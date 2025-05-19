
"use client"; // Required for modal interaction

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GALLERY_IMAGES, VILLAGE_NAME } from '@/lib/constants';
import Image from 'next/image';
import { Camera, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';

interface GalleryImage {
  src: string;
  alt: string;
  caption: string;
  hint: string;
}

export default function GalleryPage() {
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {GALLERY_IMAGES.map((image, index) => (
              <div
                key={index}
                className="gallery-item"
                onClick={() => setSelectedImage(image)}
                data-ai-hint={image.hint}
              >
                <Image src={image.src} alt={image.alt} layout="fill" objectFit="cover" />
                <div className="gallery-caption">
                  <h4 className="font-semibold text-sm truncate">{image.caption}</h4>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-3xl p-2 sm:p-4">
            {/* DialogContent already provides a close button in the top right.
                The explicit DialogClose here was causing a duplicate X. */}
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
