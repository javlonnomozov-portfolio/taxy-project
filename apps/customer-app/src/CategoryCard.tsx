import { Image, ImageSourcePropType, Text, TouchableOpacity, View } from 'react-native';
import { C, F, L, SP, elev } from './theme';

/**
 * Toifa kartasi — rasm + nom + boshlang'ich narx (maket: Group 3/9/11).
 *
 * Tanlangan holat UCH belgi bilan ko'rsatiladi: och yashil fon, yashil
 * chegara va ko'tarilish. Faqat chegara qoldirilsa quyoshda ko'rinmay
 * qolardi, faqat fon esa yonidagi tanlanmagan kartadan zo'rg'a farq qilardi.
 */
export function CategoryCard({
  image,
  title,
  price,
  selected,
  onPress,
}: {
  image: ImageSourcePropType;
  title: string;
  price: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        selected ? elev.raised : elev.card,
        {
          flex: 1,
          height: L.card.height,
          borderRadius: L.card.radius,
          borderWidth: 1,
          borderColor: selected ? C.primary : C.border,
          backgroundColor: selected ? C.primarySoft : C.bg,
          paddingTop: 6,
          paddingHorizontal: 4,
          alignItems: 'center',
          // Tanlangan karta bir oz ko'tariladi — soya bilan birga u
          // "bosilgan" emas, "faol" ekanini bildiradi.
          transform: [{ translateY: selected ? -1 : 0 }],
        },
      ]}
    >
      {/* Rasm QAT'IY o'lchamda: `auto` bo'lsa u o'z tabiiy o'lchamiga yoyilib
          kartani buzadi (maketda 218x126 px = 73x42 dp). */}
      <View
        style={{
          height: L.card.image.h,
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={image}
          style={{ height: L.card.image.h, width: L.card.image.w }}
          resizeMode="contain"
        />
      </View>
      <Text
        numberOfLines={1}
        style={{ color: C.text, fontSize: F.body, fontWeight: '700', marginTop: SP.xs / 2 }}
      >
        {title}
      </Text>
      <Text numberOfLines={1} style={{ color: C.muted, fontSize: F.tiny, marginTop: 1 }}>
        {price}
      </Text>
    </TouchableOpacity>
  );
}
