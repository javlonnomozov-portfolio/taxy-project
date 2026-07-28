import { apiClient, type GeoSearchResult } from './api';

/**
 * Manzil qidiruvi UCH HOLATNI farqlashi kerak. Avval hammasi `catch { return [] }`
 * bilan bo'sh ro'yxatga aylanardi, ya'ni "topilmadi" va "xizmat o'chiq" bir xil
 * ko'rinardi — natijada mijozga hech qachon hech narsa aytilmasdi.
 */
describe('searchPlace — natija turlari', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  const mockFetch = (status: number, body: unknown) => {
    global.fetch = jest.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
    })) as unknown as typeof fetch;
  };

  it('natija bo\'lsa → found (mijoz tanlaydi)', async () => {
    mockFetch(200, [
      { label: 'Registon maydoni, Samarqand', lat: 39.6547, lng: 66.9758 },
      { label: 'Registon ko‘chasi', lat: 39.66, lng: 66.98 },
    ]);
    const r = await apiClient.searchPlace('Registon');
    expect(r.kind).toBe('found');
    if (r.kind === 'found') expect(r.places).toHaveLength(2);
  });

  it('bo\'sh ro\'yxat → not_found (mijozga aytamiz)', async () => {
    mockFetch(200, []);
    const r = await apiClient.searchPlace('zzzqqq');
    expect(r.kind).toBe('not_found');
  });

  it('xizmat sozlanmagan (503) → error (jimgina davom etamiz)', async () => {
    mockFetch(503, { message: 'Geokodlash sozlanmagan' });
    const r = await apiClient.searchPlace('Registon');
    expect(r.kind).toBe('error');
  });

  it('tarmoq xatosi → error (bot yiqilmaydi)', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const r = await apiClient.searchPlace('Registon');
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.message).toContain('ECONNREFUSED');
  });

  it('uchala holat ham bir-biridan farq qiladi', async () => {
    const kinds: GeoSearchResult['kind'][] = [];
    mockFetch(200, [{ label: 'X', lat: 1, lng: 2 }]);
    kinds.push((await apiClient.searchPlace('a')).kind);
    mockFetch(200, []);
    kinds.push((await apiClient.searchPlace('b')).kind);
    mockFetch(503, {});
    kinds.push((await apiClient.searchPlace('c')).kind);
    expect(new Set(kinds).size).toBe(3);
  });
});
