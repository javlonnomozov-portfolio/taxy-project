import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { api } from '../api';
import { C, F, L, S, SP, elev } from '../theme';
import { Lang, makeT } from '../i18n';

type Category = 'standard' | 'comfort' | 'cargo';

interface HistoryItem {
  orderId: string;
  category: Category;
  status: string;
  finalPrice: number | null;
  at: string;
}

const som = (v: number) => Math.round(v).toLocaleString('ru-RU');

const STATUS_KEY: Record<string, string> = {
  COMPLETED: 'hist_completed',
  CANCELLED_BY_CUSTOMER: 'hist_cancelled',
  CANCELLED_BY_DRIVER: 'hist_cancelled',
  CUSTOMER_NO_SHOW: 'hist_no_show',
  NO_DRIVER: 'hist_no_driver',
  CLOSED_BY_OPERATOR: 'hist_closed',
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Buyurtmalar tarixi — sarlavha `AccountScreen` da (maketda ham umumiy).
 *
 * Narx FAQAT yakunlangan safarda ko'rsatiladi: maketda bekor qilingan
 * buyurtmaning "0 so'm" yozuvi OQ rangda, ya'ni ataylab ko'rinmaydi.
 * Uni kulrang qilib chiqarish mijozni "0 so'm to'ladim" deb chalg'itardi.
 */
export function HistoryScreen({ lang, token }: { lang: Lang; token: string }) {
  const t = makeT(lang);
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<HistoryItem[]>('GET', '/customer/history', undefined, token);
      setItems(r);
    } catch {
      setItems((prev) => prev ?? []);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (items === null) {
    return (
      <View style={[S.center, { alignItems: 'center' }]}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.orderId}
      contentContainerStyle={{ paddingHorizontal: SP.lg, paddingBottom: SP.xl, flexGrow: 1 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
      }
      ListEmptyComponent={
        <View style={[S.center, { alignItems: 'center' }]}>
          <MaterialIcons name="receipt-long" size={40} color={C.muted} />
          <Text style={{ color: C.muted, marginTop: SP.md }}>{t('hist_empty')}</Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item }) => {
        const done = item.status === 'COMPLETED';
        return (
          <View
            style={[
              elev.card,
              {
                height: L.histCard.height,
                borderRadius: L.histCard.radius,
                backgroundColor: C.bg,
                borderColor: C.hairline,
                borderWidth: 1,
                paddingHorizontal: SP.lg,
                justifyContent: 'center',
              },
            ]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#000000', fontWeight: '600', fontSize: F.h3 }}>
                {t('cat_' + item.category)}
              </Text>
              <Text style={{ color: C.dateMuted, fontSize: F.small }}>{fmtDate(item.at)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text
                style={{
                  color: done ? C.primary : C.statusMuted,
                  fontWeight: '500',
                  fontSize: F.small,
                }}
              >
                {t(STATUS_KEY[item.status] ?? 'hist_closed')}
              </Text>
              {done && item.finalPrice != null ? (
                <Text style={{ color: C.text, fontWeight: '700', fontSize: F.small }}>
                  {som(item.finalPrice)} {t('som')}
                </Text>
              ) : null}
            </View>
          </View>
        );
      }}
    />
  );
}
