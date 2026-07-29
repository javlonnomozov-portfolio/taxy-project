import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { api } from '../api';
import { S, C, R, F, SP } from '../theme';
import { Lang, makeT } from '../i18n';

type Tab = 'balance' | 'trips' | 'stats';

interface BalanceInfo {
  balance: number;
  billingMode: string;
  billingConfig: { percent?: number };
}
interface Txn {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
}
interface Trip {
  id: string;
  status: string;
  vehicleCategory: string;
  finalPrice: number | null;
  distanceM: number | null;
  commissionAmount: number | null;
  completedAt: string | null;
  createdAt: string;
}
interface Stats {
  ratingAvg: number;
  acceptanceRate: number;
  cancelRate: number;
  completionRate: number;
  totalTrips: number;
  earnedTotal: number;
}

const som = (v: number | null | undefined) =>
  v == null ? '—' : Number(v).toLocaleString('ru-RU') + ' ';

const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

export function CabinetScreen({
  lang,
  token,
  onClose,
}: {
  lang: Lang;
  token: string;
  onClose: () => void;
}) {
  const t = makeT(lang);
  const [tab, setTab] = useState<Tab>('balance');
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, tx, tr, st] = await Promise.all([
        api<BalanceInfo>('GET', '/drivers/me/balance', undefined, token),
        api<Txn[]>('GET', '/drivers/me/transactions', undefined, token),
        api<Trip[]>('GET', '/drivers/me/trips', undefined, token),
        api<Stats>('GET', '/drivers/me/stats', undefined, token),
      ]);
      setBalance(b);
      setTxns(tx);
      setTrips(tr);
      setStats(st);
    } catch (e) {
      Alert.alert(t('error'), (e as Error).message || t('error_generic'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const TabBtn = ({ id, label }: { id: Tab; label: string }) => {
    const active = tab === id;
    return (
      <TouchableOpacity
        style={{
          flex: 1,
          borderRadius: R.pill,
          paddingVertical: SP.md,
          alignItems: 'center',
          backgroundColor: active ? C.accent : 'transparent',
        }}
        onPress={() => setTab(id)}
      >
        <Text
          style={{
            color: active ? '#FFFFFF' : C.muted,
            fontWeight: '700',
            fontSize: 14,
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const Row = ({
    left,
    right,
    sub,
    rightColor,
  }: {
    left: string;
    right: string;
    sub?: string;
    rightColor?: string;
  }) => (
    <View
      style={{
        paddingVertical: SP.md,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SP.md }}>
        <Text style={{ color: C.text, flex: 1, fontSize: 15 }}>{left}</Text>
        <Text style={{ color: rightColor ?? C.text, fontWeight: '700', fontSize: 15 }}>
          {right}
        </Text>
      </View>
      {sub ? (
        <Text style={{ color: C.muted, fontSize: F.tiny, marginTop: 3 }}>{sub}</Text>
      ) : null}
    </View>
  );

  /** Foiz ko'rsatkichi — chiziq bilan (raqamni o'qimasdan ham tushunarli). */
  const Meter = ({ label, value }: { label: string; value: number }) => (
    <View style={{ marginBottom: SP.lg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: C.muted, fontSize: F.label }}>{label}</Text>
        <Text style={{ color: C.text, fontSize: F.label, fontWeight: '700' }}>
          {value.toFixed(0)}%
        </Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: C.panel2,
          marginTop: 6,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            height: '100%',
            backgroundColor: value >= 70 ? C.online : value >= 40 ? C.warn : C.danger,
          }}
        />
      </View>
    </View>
  );

  const negative = !!balance && balance.balance < 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={S.topBar}>
        <View style={[S.row, { gap: SP.sm }]}>
          <MaterialIcons name="account-circle" size={22} color={C.accent} />
          <Text style={S.brand}>{t('cabinet')}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Text style={{ color: C.accent, fontSize: 15, fontWeight: '700' }}>{t('close')}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ padding: SP.xl, paddingBottom: 0 }}>
        <View
          style={{
            flexDirection: 'row',
            gap: SP.xs,
            backgroundColor: C.panel,
            borderRadius: R.pill,
            padding: SP.xs,
            borderWidth: 1,
            borderColor: C.border,
          }}
        >
          <TabBtn id="balance" label={t('tab_balance')} />
          <TabBtn id="trips" label={t('tab_trips')} />
          <TabBtn id="stats" label={t('tab_stats')} />
        </View>
      </View>

      {loading ? (
        <View style={[S.center, { flex: 1 }]}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: SP.xl, paddingBottom: SP.xxl }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.accent} />}
        >
          {tab === 'balance' && balance && (
            <>
              {/* Manfiy balansda karta butunlay qizil rejimga o'tadi — bu holatda
                  haydovchiga buyurtma kelmasligi mumkin, ya'ni u darhol ko'rinsin. */}
              <View
                style={[
                  S.card,
                  {
                    alignItems: 'center',
                    paddingVertical: SP.xxl,
                    borderColor: negative ? C.danger : C.border,
                    backgroundColor: negative ? C.dangerSoft : C.panel,
                  },
                ]}
              >
                <Text style={{ color: C.muted, fontSize: F.tiny, letterSpacing: 1 }}>
                  {t('balance').toUpperCase()}
                </Text>
                <Text
                  style={{
                    color: negative ? C.danger : C.online,
                    fontSize: F.hero - 6,
                    fontWeight: '800',
                    marginTop: SP.xs,
                  }}
                >
                  {som(balance.balance)}
                  <Text style={{ fontSize: F.h3 }}>{t('som')}</Text>
                </Text>
                <View
                  style={{
                    backgroundColor: C.panel2,
                    borderRadius: R.pill,
                    paddingHorizontal: SP.md,
                    paddingVertical: 5,
                    marginTop: SP.md,
                  }}
                >
                  <Text style={{ color: C.muted, fontSize: F.label }}>
                    {t('billing_mode')}: {balance.billingMode}
                    {balance.billingConfig?.percent ? ` (${balance.billingConfig.percent}%)` : ''}
                  </Text>
                </View>
                {negative && (
                  <View style={[S.row, { gap: SP.sm, marginTop: SP.lg, paddingHorizontal: SP.lg }]}>
                    <MaterialIcons name="warning-amber" size={18} color={C.danger} />
                    <Text style={{ color: C.danger, fontSize: F.label, flex: 1 }}>
                      {t('balance_negative')}
                    </Text>
                  </View>
                )}
              </View>

              <Text
                style={{
                  color: C.text,
                  fontSize: F.h3,
                  fontWeight: '700',
                  marginTop: SP.xxl,
                  marginBottom: SP.sm,
                }}
              >
                {t('transactions')}
              </Text>
              {txns.length === 0 && (
                <Text style={{ color: C.muted, fontSize: F.label }}>{t('no_transactions')}</Text>
              )}
              {txns.map((x) => (
                <Row
                  key={x.id}
                  left={t('txn_' + x.type) || x.type}
                  right={`${x.amount > 0 ? '+' : ''}${som(x.amount)}`}
                  rightColor={x.amount > 0 ? C.online : C.danger}
                  sub={`${shortDate(x.createdAt)} · ${t('balance')}: ${som(x.balanceAfter)}`}
                />
              ))}
            </>
          )}

          {tab === 'trips' && (
            <>
              {trips.length === 0 && (
                <Text style={{ color: C.muted, fontSize: F.label }}>{t('no_trips')}</Text>
              )}
              {trips.map((tr) => (
                <Row
                  key={tr.id}
                  left={`${t('status_' + tr.status) || tr.status}`}
                  right={som(tr.finalPrice) + t('som')}
                  rightColor={tr.status === 'COMPLETED' ? C.online : C.muted}
                  sub={
                    `${shortDate(tr.completedAt ?? tr.createdAt)}` +
                    (tr.distanceM != null ? ` · ${(tr.distanceM / 1000).toFixed(1)} km` : '') +
                    (tr.commissionAmount ? ` · ${t('commission')}: ${som(tr.commissionAmount)}` : '')
                  }
                />
              ))}
            </>
          )}

          {tab === 'stats' && stats && (
            <>
              <View style={[S.card, { alignItems: 'center', paddingVertical: SP.xxl }]}>
                <Text style={{ color: C.muted, fontSize: F.tiny, letterSpacing: 1 }}>
                  {t('rating').toUpperCase()}
                </Text>
                <View style={[S.row, { gap: SP.sm, marginTop: SP.xs }]}>
                  <MaterialIcons name="star" size={32} color={C.gold} />
                  <Text style={{ color: C.gold, fontSize: F.hero - 6, fontWeight: '800' }}>
                    {stats.ratingAvg ? stats.ratingAvg.toFixed(2) : '—'}
                  </Text>
                </View>
              </View>

              <View style={[S.row, { gap: SP.md, marginTop: SP.md }]}>
                <View style={[S.card, { flex: 1, padding: SP.lg }]}>
                  <Text style={{ color: C.muted, fontSize: F.tiny, letterSpacing: 0.6 }}>
                    {t('total_trips').toUpperCase()}
                  </Text>
                  <Text
                    style={{ color: C.text, fontSize: F.title, fontWeight: '800', marginTop: 2 }}
                  >
                    {stats.totalTrips}
                  </Text>
                </View>
                <View style={[S.card, { flex: 1, padding: SP.lg }]}>
                  <Text style={{ color: C.muted, fontSize: F.tiny, letterSpacing: 0.6 }}>
                    {t('earned_total').toUpperCase()}
                  </Text>
                  <Text
                    style={{ color: C.online, fontSize: F.h2, fontWeight: '800', marginTop: 2 }}
                  >
                    {som(stats.earnedTotal)}
                  </Text>
                </View>
              </View>

              <View style={[S.card, { marginTop: SP.md, padding: SP.lg }]}>
                <Meter label={t('acceptance_rate')} value={Number(stats.acceptanceRate)} />
                <Meter label={t('completion_rate')} value={Number(stats.completionRate)} />
                <Meter label={t('cancel_rate')} value={Number(stats.cancelRate)} />
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
