export const ADMIN_PASSWORD = "dck.2025"; // As per prototype

export const VILLAGE_NAME = "Çamlıca Köyü";
export const DISTRICT_NAME = "Domaniç";

export const CONTACT_INFO = {
  email: "domaniccamlicakoyu@gmail.com",
  address: "Çamlıca Köyü, Domaniç, Kütahya",
  muhtar: "Numan YAŞAR",
};

export const POPULATION_DATA = {
  labels: ['1950', '1970', '1990', '2000', '2010', '2024'],
  datasets: [
    {
      label: 'Nüfus',
      data: [650, 800, 1100, 900, 750, 425],
      borderColor: 'hsl(var(--chart-1))',
      backgroundColor: 'hsla(var(--chart-1), 0.2)',
      fill: true,
      tension: 0.1,
    },
  ],
};

export const ECONOMY_DATA = {
  labels: ['Tarım', 'Hayvancılık', 'Esnaf', 'Diğer'],
  datasets: [
    {
      label: 'Geçim Kaynakları',
      data: [45, 30, 15, 10],
      backgroundColor: [
        'hsla(var(--chart-1), 0.7)',
        'hsla(var(--chart-2), 0.7)',
        'hsla(var(--chart-3), 0.7)',
        'hsla(var(--chart-4), 0.7)',
      ],
      borderColor: [
        'hsl(var(--chart-1))',
        'hsl(var(--chart-2))',
        'hsl(var(--chart-3))',
        'hsl(var(--chart-4))',
      ],
      borderWidth: 1,
    },
  ],
};

export const TIMELINE_EVENTS = [
  { year: "16-17. Yüzyıl", description: "Osmanlı İmparatorluğu döneminde ilk yerleşim." },
  { year: "Erken 1900'ler", description: "\"Göçebe\" adıyla bilinen köy." },
  { year: "1955", description: "Köyün ismi \"Çamlıca\" olarak değiştirildi." },
  { year: "2024", description: "425 kişilik nüfusa ulaşılması ve Domaniç'in merkez köyü olması." },
];

export const GALLERY_IMAGES = [
  { src: "https://placehold.co/600x600.png", alt: "Köy Manzarası 1", caption: "Köy Merkezi", hint: "village center" },
  { src: "https://placehold.co/600x600.png", alt: "Köy Manzarası 2", caption: "Çam Ormanları", hint: "pine forest" },
  { src: "https://placehold.co/600x600.png", alt: "Köy Manzarası 3", caption: "Tarım Alanları", hint: "farmland agriculture" },
  { src: "https://placehold.co/600x600.png", alt: "Köy Manzarası 4", caption: "Dağ Manzarası", hint: "mountain view" },
  { src: "https://placehold.co/600x600.png", alt: "Köy Manzarası 5", caption: "Köy Yolu", hint: "village road" },
  { src: "https://placehold.co/600x600.png", alt: "Köy Manzarası 6", caption: "Meyve Bahçeleri", hint: "fruit orchard" },
  { src: "https://placehold.co/600x600.png", alt: "Köy Manzarası 7", caption: "Buğday Tarlaları", hint: "wheat fields" },
  { src: "https://placehold.co/600x600.png", alt: "Köy Manzarası 8", caption: "Çamlık Tepeler", hint: "pine hills" },
  { src: "https://placehold.co/600x600.png", alt: "Köy Manzarası 9", caption: "Günbatımı", hint: "sunset landscape" },
  { src: "https://placehold.co/600x600.png", alt: "Köy Manzarası 10", caption: "Köy Evleri", hint: "village houses" },
  { src: "https://placehold.co/600x600.png", alt: "Köy Manzarası 11", caption: "Dağ Patikası", hint: "mountain trail" },
  { src: "https://placehold.co/600x600.png", alt: "Köy Manzarası 12", caption: "Yaylalar", hint: "plateau pasture" },
  { src: "https://placehold.co/600x600.png", alt: "Köy Manzarası 13", caption: "Çiçekli Vadiler", hint: "flowery valley" },
  { src: "https://placehold.co/600x600.png", alt: "Köy Manzarası 14", caption: "Sis Kaplı Tepeler", hint: "foggy hills" },
  { src: "https://placehold.co/600x600.png", alt: "Köy Manzarası 15", caption: "Hasan Çamı", hint: "old tree" },
];

export const GOOGLE_MAPS_EMBED_URL = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d12289.676071227615!2d29.530861694955267!3d39.7903376789198!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14cf3b31772cd39f%3A0x34c10fbd2fe372a9!2s%C3%87aml%C4%B1ca%2C%2043580%20Domani%C3%A7%2FK%C3%BCtahya!5e0!3m2!1str!2str!4v1744723761582!5m2!1str!2str";

export const NAVIGATION_LINKS = [
  { href: "/", label: "Ana Sayfa", pageId: "home" },
  { href: "/announcements", label: "Duyurular", pageId: "announcements" },
  { href: "/about", label: "Köy Hakkında", pageId: "about" },
  { href: "/history", label: "Tarih", pageId: "history" },
  { href: "/gallery", label: "Galeri", pageId: "gallery" },
  { href: "/ai-assistant", label: "Yapay Zeka", pageId: "ai" },
  { href: "/contact", label: "İletişim", pageId: "contact" },
];