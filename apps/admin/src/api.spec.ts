import { describe, expect, it } from 'vitest';
import { errorMessage } from './api';

describe('errorMessage', () => {
  it('API ning standart xato shaklidan matnni oladi', () => {
    const body = JSON.stringify({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Sizda allaqachon faol buyurtma bor',
      requestId: 'abc',
    });
    expect(errorMessage(body, 409)).toBe('Sizda allaqachon faol buyurtma bor');
  });

  it('validatsiya xatolari massivini birlashtiradi', () => {
    const body = JSON.stringify({ message: ['phone bo‘sh', 'category noto‘g‘ri'] });
    expect(errorMessage(body, 400)).toBe('phone bo‘sh, category noto‘g‘ri');
  });

  it('bo\'sh javobda status bilan tushunarli matn beradi', () => {
    expect(errorMessage('', 500)).toBe('Xatolik (500)');
  });

  it('JSON bo\'lmagan javobni shundayligicha ko\'rsatadi', () => {
    expect(errorMessage('Bad Gateway', 502)).toBe('Bad Gateway');
  });

  it('message bo\'sh bo\'lsa statusga qaytadi (xom JSON ko\'rsatmaydi)', () => {
    expect(errorMessage(JSON.stringify({ statusCode: 418 }), 418)).toBe('Xatolik (418)');
  });

  it('429 (rate limit) xabarini ko\'rsatadi', () => {
    const body = JSON.stringify({
      statusCode: 429,
      code: 'TOO_MANY_REQUESTS',
      message: 'Juda ko‘p urinish. 1 daqiqadan so‘ng qayta urinib ko‘ring.',
    });
    expect(errorMessage(body, 429)).toContain('Juda ko‘p urinish');
  });
});
