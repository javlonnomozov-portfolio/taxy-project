import { useEffect } from 'react';

/**
 * Oddiy modal oyna.
 *
 * NEGA: panel brauzerning `prompt()` / `confirm()` / `alert()` oynalarini
 * ishlatardi. Ular (a) dizayndan butunlay chetda ko'rinadi, (b) faqat matn
 * qabul qiladi — billing rejimini yozib kiritish kerak edi (`per_order` deb
 * qo'lda terish, xato yozilsa server 500 beradi), (c) brauzer ularni bloklashi
 * mumkin. Ro'yxatdan tanlash ancha ishonchli.
 *
 * Escape va fon bosilganda yopiladi.
 */
export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Keng oyna — haydovchi oynasi (ma'lumot + chat + tahrir) tor oynaga sig'masdi. */
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal card${wide ? ' wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <div className="spacer" />
          <button className="modal-x" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
