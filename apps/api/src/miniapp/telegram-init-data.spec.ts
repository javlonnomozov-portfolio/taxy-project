import { createHmac } from 'node:crypto';
import { verifyInitData } from './telegram-init-data';

const TOKEN = '123456:TEST-BOT-TOKEN';

/** Telegram yuboradigan imzolangan initData'ni yasaydi (test uchun). */
function signInitData(fields: Record<string, string>): string {
  const dataCheck = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  const hash = createHmac('sha256', secret).update(dataCheck).digest('hex');
  const p = new URLSearchParams(fields);
  p.set('hash', hash);
  return p.toString();
}

const now = () => Math.floor(Date.now() / 1000);
const validFields = (over: Record<string, string> = {}) => ({
  auth_date: String(now()),
  query_id: 'AAH123',
  user: JSON.stringify({ id: 555000111, first_name: 'Javohir', language_code: 'uz' }),
  ...over,
});

describe('verifyInitData', () => {
  it('to‘g‘ri imzolangan initData‘ni qabul qiladi va foydalanuvchini qaytaradi', () => {
    const user = verifyInitData(signInitData(validFields()), TOKEN);
    expect(user).toEqual({ id: '555000111', firstName: 'Javohir', languageCode: 'uz' });
  });

  it('telegram id STRING bo‘lib qaytadi (customers.telegram_id — bigint)', () => {
    const user = verifyInitData(signInitData(validFields()), TOKEN);
    expect(typeof user!.id).toBe('string');
  });

  it('boshqa bot tokeni bilan imzolangan bo‘lsa rad etadi', () => {
    expect(verifyInitData(signInitData(validFields()), 'boshqa:token')).toBeNull();
  });

  it('ma’lumot o‘zgartirilgan bo‘lsa rad etadi (hash eski qoladi)', () => {
    const signed = signInitData(validFields());
    const p = new URLSearchParams(signed);
    p.set('user', JSON.stringify({ id: 999, first_name: 'Buzg‘unchi' }));
    expect(verifyInitData(p.toString(), TOKEN)).toBeNull();
  });

  it('hash umuman bo‘lmasa rad etadi', () => {
    const p = new URLSearchParams(signInitData(validFields()));
    p.delete('hash');
    expect(verifyInitData(p.toString(), TOKEN)).toBeNull();
  });

  it('eskirgan initData‘ni rad etadi', () => {
    const old = String(now() - 48 * 3600);
    expect(verifyInitData(signInitData(validFields({ auth_date: old })), TOKEN)).toBeNull();
  });

  it('bot tokeni sozlanmagan bo‘lsa rad etadi', () => {
    expect(verifyInitData(signInitData(validFields()), '')).toBeNull();
  });

  it('bo‘sh initData‘da yiqilmaydi', () => {
    expect(verifyInitData('', TOKEN)).toBeNull();
    expect(verifyInitData('hash=zzz', TOKEN)).toBeNull();
  });
});
