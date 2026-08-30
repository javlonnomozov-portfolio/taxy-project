import { Image, ImageSourcePropType, Text, TouchableOpacity, View } from 'react-native';
import { C, F, R, SP } from './theme';

/** Toifa kartasi — rasm + nom + boshlang'ich narx (maket: Group 3/9/11). */
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
      style={{
        flex: 1,
        borderRadius: R.card,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? C.primary : C.border,
        backgroundColor: selected ? C.primarySoft : C.bg,
        paddingVertical: SP.sm,
        paddingHorizontal: 4,
        alignItems: 'center',
      }}
    >
      {/* Rasm QAT'IY o'lchamda: `auto` bo'lsa u o'z tabiiy o'lchamiga yoyilib
          kartani buzadi. */}
      <View style={{ height: 46, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <Image source={image} style={{ height: 46, width: 78 }} resizeMode="contain" />
      </View>
      <Text
        numberOfLines={1}
        style={{ color: C.text, fontSize: F.label, fontWeight: '800', marginTop: 2 }}
      >
        {title}
      </Text>
      <Text numberOfLines={1} style={{ color: C.muted, fontSize: F.tiny, marginTop: 1 }}>
        {price}
      </Text>
    </TouchableOpacity>
  );
}
