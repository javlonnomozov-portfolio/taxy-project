import { MAX_MEDIA_BYTES, checkMedia, sniffMime } from './chat.media';

/** Berilgan bosh baytlar + to'ldiruvchi — haqiqiy fayl boshini taqlid qiladi. */
const file = (head: number[] | string, total = 64): Buffer => {
  const start = typeof head === 'string' ? Buffer.from(head, 'ascii') : Buffer.from(head);
  return Buffer.concat([start, Buffer.alloc(Math.max(0, total - start.length))]);
};

const JPEG = file([0xff, 0xd8, 0xff, 0xe0]);
const PNG = file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(52)]);
const M4A = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypM4A '), Buffer.alloc(52)]);

describe('sniffMime — tur baytlardan aniqlanadi', () => {
  it('rasm formatlarini taniydi', () => {
    expect(sniffMime(JPEG)).toBe('image/jpeg');
    expect(sniffMime(PNG)).toBe('image/png');
    expect(sniffMime(WEBP)).toBe('image/webp');
  });

  it('expo-av yozgan m4a ni ovoz deb taniydi', () => {
    expect(sniffMime(M4A)).toBe('audio/mp4');
  });

  it('juda qisqa yoki notanish fayl — null', () => {
    expect(sniffMime(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(sniffMime(file('hello world, just text'))).toBeNull();
  });
});

describe('checkMedia — yuklashdan oldingi tekshiruv', () => {
  it('to‘g‘ri rasm va ovoz o‘tadi', () => {
    expect(checkMedia(JPEG, 'image')).toEqual({ ok: true, mime: 'image/jpeg' });
    expect(checkMedia(M4A, 'voice')).toEqual({ ok: true, mime: 'audio/mp4' });
  });

  it('rasm deb yuborilgan SVG/HTML rad etiladi (panelda skript bo‘lib ochilmasin)', () => {
    expect(checkMedia(file('<svg xmlns="http://www.w3.org/2000/svg" onload="x()">'), 'image').ok).toBe(false);
    expect(checkMedia(file('<!DOCTYPE html><script>alert(1)</script>'), 'image').ok).toBe(false);
  });

  it('tur mos kelmasa rad etiladi: ovoz rasm deb, rasm ovoz deb', () => {
    expect(checkMedia(M4A, 'image').ok).toBe(false);
    expect(checkMedia(JPEG, 'voice').ok).toBe(false);
  });

  it('bo‘sh va chegaradan katta fayl rad etiladi', () => {
    expect(checkMedia(Buffer.alloc(0), 'image').ok).toBe(false);
    expect(checkMedia(undefined, 'image').ok).toBe(false);
    const big = Buffer.concat([JPEG, Buffer.alloc(MAX_MEDIA_BYTES)]);
    expect(checkMedia(big, 'image').ok).toBe(false);
  });
});
