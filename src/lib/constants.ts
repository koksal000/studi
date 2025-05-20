
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

// This STATIC_GALLERY_IMAGES_FOR_SEEDING can be used for initial seeding of the dynamic gallery if it's empty on server start.
// The live gallery will be managed via the admin panel and API.
// IMPORTANT: Google Drive links like /view?usp=drivesdk are PREVIEW links, not direct image links.
// They may not work correctly with next/image. Ensure files are publicly shared ("Anyone with the link can view")
// and ideally, use direct image URLs if possible.
export const STATIC_GALLERY_IMAGES_FOR_SEEDING = [
  { id: "seed_1", src: "https://drive.google.com/file/d/1Ojojg63aIqyxCB5y0pI4Szyw_vywnyjH/view?usp=drivesdk", alt: "Galeri Resmi 1", caption: "Çamlıca Köyü Manzarası 1", hint: "village scenery" },
  { id: "seed_2", src: "https://drive.google.com/file/d/1OTQz9II0Zk2pWF177hHEaw6CwYOh-jpu/view?usp=drivesdk", alt: "Galeri Resmi 2", caption: "Köyden Bir Kare", hint: "village life" },
  { id: "seed_3", src: "https://drive.google.com/file/d/1OPNvpkMPmIOq_OcJF8HyORffKleOr4JS/view?usp=drivesdk", alt: "Galeri Resmi 3", caption: "Doğal Güzellikler", hint: "nature beauty" },
  { id: "seed_4", src: "https://drive.google.com/file/d/1ORqUKW1Lfnwif4orQGEkNXWAB4hZgDm7/view?usp=drivesdk", alt: "Galeri Resmi 4", caption: "Tarihi Dokular", hint: "historic texture" },
  { id: "seed_5", src: "https://drive.google.com/file/d/1O6wVftV8cWFpboCCsjnczcye_souYzjp/view?usp=drivesdk", alt: "Galeri Resmi 5", caption: "Köy Meydanı", hint: "village square" },
  { id: "seed_6", src: "https://drive.google.com/file/d/1OLE205kapWiEed2HTK8dleO3krjy6-iZ/view?usp=drivesdk", alt: "Galeri Resmi 6", caption: "Yeşil Alanlar", hint: "green areas" },
  { id: "seed_7", src: "https://drive.google.com/file/d/1O_wpjc0yUuU04uQpgmiz1fClpmrnzJ62/view?usp=drivesdk", alt: "Galeri Resmi 7", caption: "Geleneksel Yapılar", hint: "traditional architecture" },
  { id: "seed_8", src: "https://drive.google.com/file/d/1OqhPnMqrmS4ol_BCQuoclOF6YuidvOR0/view?usp=drivesdk", alt: "Galeri Resmi 8", caption: "Köy Hayatından Kesitler", hint: "village life scene" },
  { id: "seed_9", src: "https://drive.google.com/file/d/1OorKCNUMQXyzD7mYTkcX9lavgZcLESto/view?usp=drivesdk", alt: "Galeri Resmi 9", caption: "Gün Batımı Manzarası", hint: "sunset view" },
  { id: "seed_10",src: "https://drive.google.com/file/d/1O5XP3bR7s-cCc_2Td5EPb3nieAjUmnNn/view?usp=drivesdk", alt: "Galeri Resmi 10", caption: "Köy Yolları", hint: "village roads" },
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

export const ADMIN_PANEL_PATH = "/admin";
export const DEFAULT_CONTACT_PEER_ID = "camlica-village-default-contact-peer";
