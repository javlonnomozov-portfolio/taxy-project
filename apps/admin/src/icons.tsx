// Navigatsiya ikonkalari — INLINE SVG, yangi bog'liqliksiz.
//
// Nega kutubxona emas: panel ichki vosita, 8 ta ikonka uchun paket qo'shish
// (va CDN'ga bog'lanish) ortiqcha. Stitch maketida Material Symbols ishlatilgan
// edi, lekin bitta ekranda ikonka NOMLARI matn bo'lib chiqib ketgan
// ("dashboard Panel") — shrift yuklanmagani uchun. Inline SVG'da bunday
// muammo bo'lmaydi.

type P = { size?: number };
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const IconPanel = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export const IconOrders = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);

export const IconCustomers = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    <path d="M16 11a3 3 0 100-6M18 20c0-2.4-1-4.2-2.5-5.2" />
  </svg>
);

export const IconScheduled = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

export const IconDrivers = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M5 16.5V12l1.6-4.2A2 2 0 018.5 6.5h7a2 2 0 011.9 1.3L19 12v4.5" />
    <path d="M4 16.5h16M7.5 19.5h2M14.5 19.5h2" />
  </svg>
);

export const IconSettings = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1" />
  </svg>
);

export const IconLang = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
  </svg>
);

export const IconLogout = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M15 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8" />
    <path d="M18 15l3-3-3-3M21 12h-9" />
  </svg>
);

export const IconTaxi = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M5 16.5V12l1.6-4.2A2 2 0 018.5 6.5h7a2 2 0 011.9 1.3L19 12v4.5" />
    <path d="M4 16.5h16M7.5 19.5h2M14.5 19.5h2M9.5 6.5V4h5v2.5" />
  </svg>
);

export const IconWarn = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M12 4l9 16H3l9-16z" />
    <path d="M12 10v4M12 17h.01" />
  </svg>
);
