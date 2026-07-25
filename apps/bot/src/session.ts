import { Lang } from './i18n';

export type Step = 'idle' | 'category' | 'pickup' | 'dest' | 'note' | 'confirm';

export interface Draft {
  category?: string;
  pickup?: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
  destAddress?: string;
  note?: string;
}

export interface Session {
  lang: Lang;
  customerId?: string;
  phone?: string;
  step: Step;
  draft: Draft;
  activeOrderId?: string;
  ratingOrderId?: string;
}

const store = new Map<number, Session>();

export function getSession(chatId: number): Session {
  let s = store.get(chatId);
  if (!s) {
    s = { lang: 'uz', step: 'idle', draft: {} };
    store.set(chatId, s);
  }
  return s;
}

export function resetDraft(s: Session): void {
  s.step = 'idle';
  s.draft = {};
}
