// Kichik umumiy UI yordamchilar.
const OK = ['COMPLETED', 'ACCEPTED', 'CONFIRMED', 'IN_PROGRESS', 'ARRIVED', 'ARRIVING'];
const BAD = ['NO_DRIVER', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_DRIVER', 'CUSTOMER_NO_SHOW', 'CLOSED_BY_OPERATOR'];

export function StatusBadge({ status }: { status: string }) {
  const cls = BAD.includes(status) ? 'danger' : OK.includes(status) ? 'ok' : 'warn';
  return <span className={`badge ${cls}`}>{status}</span>;
}

export function money(v: number | null | undefined): string {
  if (v == null) return '—';
  return Number(v).toLocaleString('ru-RU') + " so'm";
}

export function time(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('uz-UZ', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}
