import Redis from 'ioredis';
import { MemorySessionStore, RedisSessionStore, newSession, resetDraft } from './session';

/** Testlar uchun eng kichik Redis taqlidi (get/set + EX). */
function fakeRedis() {
  const data = new Map<string, string>();
  const ttl = new Map<string, number>();
  return {
    data,
    ttl,
    client: {
      get: jest.fn(async (k: string) => data.get(k) ?? null),
      set: jest.fn(async (k: string, v: string, _ex: string, sec: number) => {
        data.set(k, v);
        ttl.set(k, sec);
        return 'OK';
      }),
    } as unknown as Redis,
  };
}

describe('RedisSessionStore', () => {
  it('mavjud bo\'lmagan chat uchun toza sessiya qaytaradi', async () => {
    const { client } = fakeRedis();
    const s = await new RedisSessionStore(client).get(1);
    expect(s).toEqual(newSession());
  });

  it('saqlab, qayta o\'qiy oladi (jarayon qayta ishga tushsa ham holat qoladi)', async () => {
    const { client } = fakeRedis();
    const store = new RedisSessionStore(client);
    const s = newSession();
    s.customerId = 'c-1';
    s.step = 'confirm';
    s.draft.category = 'comfort';
    await store.set(42, s);

    // Yangi store — "boshqa instansiya / qayta ishga tushish" holati.
    const restored = await new RedisSessionStore(client).get(42);
    expect(restored.customerId).toBe('c-1');
    expect(restored.step).toBe('confirm');
    expect(restored.draft.category).toBe('comfort');
  });

  it('TTL bilan yozadi (tashlab ketilgan sessiyalar to\'planib qolmasin)', async () => {
    const { client, ttl } = fakeRedis();
    await new RedisSessionStore(client).set(7, newSession());
    expect(ttl.get('bot:session:7')).toBe(7 * 24 * 3600);
  });

  it('buzuq JSON da yiqilmaydi — toza sessiya beradi', async () => {
    const { client, data } = fakeRedis();
    data.set('bot:session:9', '{buzuq');
    const s = await new RedisSessionStore(client).get(9);
    expect(s).toEqual(newSession());
  });

  it('eski yozuvda yangi maydon bo\'lmasa default qo\'llanadi', async () => {
    const { client, data } = fakeRedis();
    data.set('bot:session:5', JSON.stringify({ customerId: 'c-9' })); // lang/step/draft yo'q
    const s = await new RedisSessionStore(client).get(5);
    expect(s.lang).toBe('uz');
    expect(s.step).toBe('idle');
    expect(s.draft).toEqual({});
    expect(s.customerId).toBe('c-9');
  });

  it('update() yuklab-o\'zgartirib-saqlaydi (socket callback uchun)', async () => {
    const { client } = fakeRedis();
    const store = new RedisSessionStore(client);
    await store.set(3, { ...newSession(), activeOrderId: 'o-1' });
    await store.update(3, (s) => {
      if (s.activeOrderId === 'o-1') s.activeOrderId = undefined;
      s.ratingOrderId = 'o-1';
    });
    const s = await store.get(3);
    expect(s.activeOrderId).toBeUndefined();
    expect(s.ratingOrderId).toBe('o-1');
  });

  it('Redis yiqilsa ham bot to\'xtamaydi (toza sessiya bilan davom etadi)', async () => {
    const broken = {
      get: jest.fn(async () => {
        throw new Error('redis o‘chgan');
      }),
      set: jest.fn(async () => {
        throw new Error('redis o‘chgan');
      }),
    } as unknown as Redis;
    const store = new RedisSessionStore(broken);
    await expect(store.get(1)).resolves.toEqual(newSession());
    await expect(store.set(1, newSession())).resolves.toBeUndefined();
  });
});

describe('MemorySessionStore', () => {
  it('Redis bilan bir xil shartnomaga amal qiladi', async () => {
    const store = new MemorySessionStore();
    expect(await store.get(1)).toEqual(newSession());
    await store.set(1, { ...newSession(), phone: '+998901234567' });
    expect((await store.get(1)).phone).toBe('+998901234567');
    await store.update(1, (s) => {
      s.step = 'pickup';
    });
    expect((await store.get(1)).step).toBe('pickup');
  });
});

describe('resetDraft', () => {
  it('qadamni idle qiladi va draftni tozalaydi, lekin hisobni saqlaydi', () => {
    const s = newSession();
    s.customerId = 'c-1';
    s.phone = '+998901234567';
    s.step = 'confirm';
    s.draft = { category: 'cargo', pickup: { lat: 39.7, lng: 67.2 } };
    resetDraft(s);
    expect(s.step).toBe('idle');
    expect(s.draft).toEqual({});
    expect(s.customerId).toBe('c-1'); // ro'yxatdan o'tish yo'qolmaydi
    expect(s.phone).toBe('+998901234567');
  });
});
