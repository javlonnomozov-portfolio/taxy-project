// Testlar uchun soxta Nominatim — tashqi xizmatga tegmaslik uchun.
// `pnpm sim:geo` shu serverga qarshi ishlaydi (API `NOMINATIM_URL=http://localhost:8099`).
import { createServer } from 'node:http';

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  res.setHeader('content-type', 'application/json');
  if (url.pathname === '/search') {
    const q = (url.searchParams.get('q') || '').toLowerCase();
    // 'zzz' — ataylab "topilmadi" holatini qaytaradi.
    if (q.includes('zzz')) return res.end('[]');
    return res.end(
      JSON.stringify([
        { display_name: 'Registon maydoni, Samarqand', lat: '39.6547', lon: '66.9758' },
        { display_name: 'Registon ko‘chasi, Samarqand', lat: '39.6600', lon: '66.9800' },
      ]),
    );
  }
  res.statusCode = 404;
  res.end('{}');
}).listen(8099, () => console.log('mock nominatim :8099'));
