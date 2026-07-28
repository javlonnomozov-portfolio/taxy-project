import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { GeocodingService } from './geocoding.service';

function fakeRedis() {
  const data = new Map<string, string>();
  return {
    data,
    client: {
      get: jest.fn(async (k: string) => data.get(k) ?? null),
      set: jest.fn(async (k: string, v: string) => {
        data.set(k, v);
        return 'OK';
      }),
    } as unknown as Redis,
  };
}

function makeConfig(env: Record<string, string | undefined>): ConfigService {
  return { get: (k: string) => env[k] } as unknown as ConfigService;
}

const CONFIGURED = {
  NOMINATIM_URL: 'https://nominatim.test',
  OSRM_URL: 'https://osrm.test',
  GEO_USER_AGENT: 'ToyTaxY/test',
};

describe('GeocodingService — sozlanmagan holat', () => {
  const svc = new GeocodingService(fakeRedis().client, makeConfig({}));

  it('status() ikkalasini ham o\'chiq deb ko\'rsatadi', () => {
    expect(svc.status()).toEqual({ geocoding: false, routing: false });
  });

  it('search 503 beradi (klient manzilsiz davom etadi)', async () => {
    await expect(svc.search('Registon')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('route 503 beradi', async () => {
    await expect(svc.route({ lat: 39.7, lng: 67.2 }, { lat: 39.8, lng: 67.3 })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

describe('GeocodingService — qidiruv', () => {
  afterEach(() => jest.restoreAllMocks());

  it('3 belgidan qisqa so\'rovda tashqi xizmatga BORMAYDI', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const svc = new GeocodingService(fakeRedis().client, makeConfig(CONFIGURED));
    expect(await svc.search('ab')).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('natijani Place shakliga o\'giradi', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [{ display_name: 'Registon, Samarqand', lat: '39.6547', lon: '66.9758' }],
    } as Response);
    const svc = new GeocodingService(fakeRedis().client, makeConfig(CONFIGURED));
    expect(await svc.search('Registon')).toEqual([
      { label: 'Registon, Samarqand', lat: 39.6547, lng: 66.9758 },
    ]);
  });

  it('ikkinchi bir xil so\'rovda KESHDAN o\'qiydi (tashqi limitni tejaydi)', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [{ display_name: 'Registon', lat: '39.65', lon: '66.97' }],
    } as Response);
    const { client } = fakeRedis();
    const svc = new GeocodingService(client, makeConfig(CONFIGURED));
    await svc.search('Registon');
    await svc.search('Registon');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('kesh registrga bog\'liq emas', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [{ display_name: 'Registon', lat: '39.65', lon: '66.97' }],
    } as Response);
    const { client } = fakeRedis();
    const svc = new GeocodingService(client, makeConfig(CONFIGURED));
    await svc.search('Registon');
    await svc.search('REGISTON');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('Nominatim yiqilsa 503 beradi (ichki xato oshkor qilinmaydi)', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 429 } as Response);
    const svc = new GeocodingService(fakeRedis().client, makeConfig(CONFIGURED));
    await expect(svc.search('Registon')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('so\'rovda Nominatim talab qilgan User-Agent yuboriladi', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as unknown as Response);
    const svc = new GeocodingService(fakeRedis().client, makeConfig(CONFIGURED));
    await svc.search('Registon');
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('ToyTaxY/test');
  });
});

describe('GeocodingService — marshrut', () => {
  afterEach(() => jest.restoreAllMocks());

  it('OSRM javobini masofa/vaqtga o\'giradi', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [{ distance: 5432.7, duration: 611.2 }] }),
    } as Response);
    const svc = new GeocodingService(fakeRedis().client, makeConfig(CONFIGURED));
    expect(await svc.route({ lat: 39.7, lng: 67.2 }, { lat: 39.8, lng: 67.3 })).toEqual({
      distanceM: 5433,
      durationSec: 611,
    });
  });

  it('marshrut topilmasa 503', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [] }),
    } as Response);
    const svc = new GeocodingService(fakeRedis().client, makeConfig(CONFIGURED));
    await expect(svc.route({ lat: 39.7, lng: 67.2 }, { lat: 39.8, lng: 67.3 })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
