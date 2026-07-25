# @tty/driver-app — Haydovchi ilovasi (React Native)

> **Placeholder.** React Native ilovasi alohida native toolchain (Android SDK / Xcode)
> talab qilgani uchun bu jild Sprint 0'da bo'sh qoldirildi. Skeletni init qilish qadami
> quyida. To'liq tasklar: [../../docs/tasks/03-driver-app.md](../../docs/tasks/03-driver-app.md).

## Init qilish (keyinroq)

```bash
# 1) RN loyihasini shu jildga init qilish (yoki Expo)
npx @react-native-community/cli init driverApp --directory apps/driver-app --skip-git-init
# yoki Expo:
# npx create-expo-app@latest apps/driver-app

# 2) package name'ni @tty/driver-app ga o'zgartirish va workspace'ga ulash
# 3) Kutubxonalar: MapLibre GL Native, socket.io-client, react-native-geolocation
#    (background), @tty/shared (umumiy turlar/kontraktlar), i18n
```

## Sprint 0'dagi vazifa
- [ ] RN skeletni init qilish, bo'sh login ekrani
- [ ] `@tty/shared` ni ulash (Socket kontraktlari)
- [ ] Dev muhitni hujjatlash

Batafsil: [03-driver-app.md](../../docs/tasks/03-driver-app.md).
