// Kichik umumiy UI yordamchilar.
import { useI18n } from './i18n';

const OK = ['COMPLETED', 'ACCEPTED', 'CONFIRMED', 'IN_PROGRESS', 'ARRIVED', 'ARRIVING'];
const BAD = ['NO_DRIVER', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_DRIVER', 'CUSTOMER_NO_SHOW', 'CLOSED_BY_OPERATOR'];

/**
 * Sahifa karkasi: chegara bilan ajratilgan sarlavha + kontent.
 * `actions` — sarlavhaning o'ng tomonidagi tugma(lar).
 */
export function Page({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="pagehead">
        <h1>{title}</h1>
        <div className="spacer" />
        {actions}
      </div>
      <div className="content">{children}</div>
    </>
  );
}

/**
 * Zakaz holati yorlig'i — TARJIMA bilan.
 * Avval xom `NO_DRIVER` ko'rinardi; dispatcher uchun o'zbekcha aniqroq.
 * Tarjima topilmasa xom qiymat qoladi (yangi status qo'shilsa ham buzilmaydi).
 */
export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const cls = BAD.includes(status) ? 'danger' : OK.includes(status) ? 'ok' : 'warn';
  const label = t('st_' + status);
  return <span className={`badge ${cls}`}>{label === 'st_' + status ? status : label}</span>;
}

/** Billing rejimi — xom `per_order` o'rniga o'qiladigan nom. */
export function BillingLabel({ mode }: { mode: string }) {
  const { t } = useI18n();
  const label = t('bm_' + mode);
  return <>{label === 'bm_' + mode ? mode : label}</>;
}

/** Toifa nomi (bot bilan bir xil atamalar). */
export function CategoryLabel({ category }: { category: string }) {
  const { t } = useI18n();
  const label = t('cat_' + category);
  return <>{label === 'cat_' + category ? category : label}</>;
}

/**
 * UUID'ning qisqa ko'rinishi. Dispatcher zakazni loglar bilan solishtirishi
 * uchun kerak — to'liq UUID jadvalda joy egallaydi.
 */
export function shortId(id: string): string {
  return id ? id.slice(0, 8) : '—';
}

export function money(v: number | null | undefined): string {
  if (v == null) return '—';
  return Number(v).toLocaleString('ru-RU') + " so'm";
}

export function time(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('uz-UZ', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}
