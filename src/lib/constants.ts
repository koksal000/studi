
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
export const STATIC_GALLERY_IMAGES_FOR_SEEDING = [
  { id: "seed_1", src: "https://static.daktilo.com/sites/1410/uploads/2024/07/16/amlica-ilgenel3-1721118756.webp", alt: "Çamlıca Köyü Camii", caption: "Çamlıca Köyü Camii", hint: "mosque historic" },
  { id: "seed_2", src: "https://photos.google.com/share/AF1QipMkyiC-BHAXOLcBMZ8Sdl9w0lcB9DowF_WONj56wqNpODiRzR3QpMzC8cL8erU66g/photo/AF1QipPJ5hgB1tuDKK6UVsHRnYE6e-EcRqBmvqWdHUjC?key=REFVSmdwTEFtUDlLamd1Mm1Ob01VdlUxb2ttREpR", alt: "Çamlıca Uydu Görüntüsü", caption: "Çamlıca Uydu Görüntüsü", hint: "village satellite" },
  { id: "seed_3", src: "https://photos.google.com/share/AF1QipMkyiC-BHAXOLcBMZ8Sdl9w0lcB9DowF_WONj56wqNpODiRzR3QpMzC8cL8erU66g/photo/AF1QipMpReHJDZoNV40QBH3wIRU0A04hI6_eUXPW3l9-?key=REFVSmdwTEFtUDlLamd1Mm1Ob01VdlUxb2ttREpR", alt: "Çamlıca Tarım Kredi Kooperatifi", caption: "Çamlıca Tarım Kredi Kooperatifi", hint: "village cooperative" },
  { id: "seed_4", src: "https://photos.google.com/share/AF1QipMkyiC-BHAXOLcBMZ8Sdl9w0lcB9DowF_WONj56wqNpODiRzR3QpMzC8cL8erU66g/photo/AF1QipOnUoEFOL0XlaxosMIsY98w9SoGt1hA6AUiQiLt?key=REFVSmdwTEFtUDlLamd1Mm1Ob01VdlUxb2ttREpR", alt: "Çamlıca Köyü Ortaokulu", caption: "Çamlıca Köyü Ortaokulu", hint: "village school" },
  { id: "seed_5", src: "https://photos.google.com/share/AF1QipMkyiC-BHAXOLcBMZ8Sdl9w0lcB9DowF_WONj56wqNpODiRzR3QpMzC8cL8erU66g/photo/AF1QipOVsghavZsDDUxyNlS58N-jd5FuNFZLlZQh9dP7?key=REFVSmdwTEFtUDlLamd1Mm1Ob01VdlUxb2ttREpR", alt: "Çamlıca Köyü Çay Konağı", caption: "Çamlıca Köyü Çay Konağı", hint: "tea house" },
  { id: "seed_6", src: "https://photos.google.com/share/AF1QipMkyiC-BHAXOLcBMZ8Sdl9w0lcB9DowF_WONj56wqNpODiRzR3QpMzC8cL8erU66g/photo/AF1QipPufZCSlDU--R70I4ecOeOisZEPgnxfhrM-idsg?key=REFVSmdwTEFtUDlLamd1Mm1Ob01VdlUxb2ttREpR", alt: "Çamlıca Köyü Mezarlığı Girişi", caption: "Çamlıca Köyü Mezarlığı Girişi", hint: "cemetery entrance" },
  { id: "seed_7", src: "https://photos.google.com/share/AF1QipMkyiC-BHAXOLcBMZ8Sdl9w0lcB9DowF_WONj56wqNpODiRzR3QpMzC8cL8erU66g/photo/AF1QipPl4TGCXT6xGyGBbz6SMnBOnu2Mpm8_nsb2wHCj?key=REFVSmdwTEFtUDlLamd1Mm1Ob01VdlUxb2ttREpR", alt: "Çamlıca Köyü Girişi", caption: "Çamlıca Köyü Girişi", hint: "village entrance" },
  { id: "seed_8", src: "https://photos.google.com/share/AF1QipMkyiC-BHAXOLcBMZ8Sdl9w0lcB9DowF_WONj56wqNpODiRzR3QpMzC8cL8erU66g/photo/AF1QipM6C8We9b9VDCeYH4lWC0n-jOCxQXSFYDawGFsS?key=REFVSmdwTEFtUDlLamd1Mm1Ob01VdlUxb2ttREpR", alt: "Çamlıca Köyü Göleti", caption: "Çamlıca Köyü Göleti", hint: "village pond" },
  { id: "seed_9", src: "https://photos.google.com/share/AF1QipMkyiC-BHAXOLcBMZ8Sdl9w0lcB9DowF_WONj56wqNpODiRzR3QpMzC8cL8erU66g/photo/AF1QipMBRchJ-_Q6DdSSyYHvW7qOGeWmbbEAsoV9qwaj?key=REFVSmdwTEFtUDlLamd1Mm1Ob01VdlUxb2ttREpR", alt: "Çamlıca Köyü Girişi 2", caption: "Çamlıca Köyü Girişi 2", hint: "village entrance" },
  { id: "seed_10",src: "https://i.ibb.co/NnYV58Gg/1739026216056.jpg", alt: "Yaşar Gıda Market", caption: "Yaşar Gıda Market", hint: "village market" },
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
