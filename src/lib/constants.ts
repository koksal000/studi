
export const ADMIN_PASSWORD = "dck.2025"; // As per prototype

export const VILLAGE_NAME = "Çamlıca Köyü";
export const DISTRICT_NAME = "Domaniç";

// This ID can be used by peers to try and find an initial contact point in the network.
// Any peer can choose to initialize itself with this ID.
export const DEFAULT_CONTACT_PEER_ID = "camlica-village-default-contact-peer";

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
  { src: "https://lh5.googleusercontent.com/9mLtcSKAg2v__8tdl5TJ_RYWmzl35iI0DeNavhiDbSLyVLSOZb2eHiYJn4DhBmekrTpstCZKBqAhMxdFWOIvQvY=w1280", alt: "Çamlıca Köyü Camii", caption: "Çamlıca Köyü Camii", hint: "village mosque" },
  { src: "https://lh6.googleusercontent.com/cHhjZzfhp25nD564Jz4_ZQ7HVHVbQGq8GlQbME4ygZLlof2ET8deHidzOZccs10pSVRRdxF73Ok35XwqApCFx88=w1280", alt: "Çamlıca Uydu Görüntüsü", caption: "Çamlıca Uydu Görüntüsü", hint: "satellite view" },
  { src: "https://lh5.googleusercontent.com/KSyTSeKp5F9uin-4x5VsAy1AWjAb4ETorMFqqdaiBbjfEGvpuzQYCACT9X17_5IyhOT7Rs9yij3-S7szFbvrJL4=w1280", alt: "Çamlıca Tarım Kredi Kooperatifi", caption: "Çamlıca Tarım Kredi Kooperatifi", hint: "agricultural cooperative" },
  { src: "https://lh6.googleusercontent.com/FbFW1DyPgWj7w-Ax1UxDoALx1uhsh-VrnfJsA2deylAOmTIwkdNEsssZWP0ywSSw7Dk3B9XLLW7o0IukYY5rwWo=w1280", alt: "Çamlıca Köyü Ortaokulu", caption: "Çamlıca Köyü Ortaokulu", hint: "village school" },
  { src: "https://lh5.googleusercontent.com/c5HfqgdyjH3dozKw3OQsZd5XyI1nbztMShkIuwHFpwYx6UiuSa0kvi1l67C_zOAboHnnJejAARi96O920xQI16E=w1280", alt: "Çamlıca Köyü Çay Konağı", caption: "Çamlıca Köyü Çay Konağı", hint: "tea house" },
  { src: "https://lh4.googleusercontent.com/v9CXbxlXjmL3NlLC8eGuPhD_xHw0lbXZGz54NTtUDsnl1r2KqN6HglTr8s2rBhXPcCsGM8aWpujTgAPXnFCQUK4=w1280", alt: "Çamlıca Köyü Mezarlığı Girişi", caption: "Çamlıca Köyü Mezarlığı Girişi", hint: "cemetery entrance" },
  { src: "https://lh3.googleusercontent.com/qSOmnI5FgGl6AnwFT4TBCXSRWyLubcbpreC-_nt_X1PVRAybdor-EG4t-iW-pcGQ1i6LBO42QT1FPeaxk3T_YAk=w1280", alt: "Çamlıca Köyü Girişi", caption: "Çamlıca Köyü Girişi", hint: "village entrance" },
  { src: "https://lh4.googleusercontent.com/V7D88bX6meWcgXf4Wt3YqEbxjQda61IXmVCARvsbu_uOIp6oyLdgDaLGUu-GSUF4rcNpIhtIVZ_ifBsZNF0_4fo=w1280", alt: "Çamlıca Köyü Göleti", caption: "Çamlıca Köyü Göleti", hint: "village pond" },
  { src: "https://lh4.googleusercontent.com/2cNSoPBbFrMFCUqQFWIJa9zD4Iuln5TSBCChFVHeA2uVLpjhtbxg3MBZtPyqnkUgGqEGwg02DeHutdYt3b02gVc=w1280", alt: "Çamlıca Köyü Girişi 2", caption: "Çamlıca Köyü Girişi 2", hint: "village entrance" },
  { src: "https://lh3.googleusercontent.com/imNe6-krsmsVvCwSa3cy3uv12bBXtRTtO-Fd0XVXg-f_3ZdTr5rlslpylgHB2HNifCi3ClJdD-ZkvxGA3oHEV1g=w1280", alt: "Yaşar Gıda Market", caption: "Yaşar Gıda Market", hint: "local market" },
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
