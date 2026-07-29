# Haydovchi ilovasi — Google Stitch uchun dizayn promptlari

> Maqsad: `apps/driver-app` (Expo/React Native, Android) uchun yangi vizual dizayn.
> Ishlatish: har bir blokni Stitch'ga ALOHIDA prompt sifatida bering (avval "Global uslub",
> keyin ekranlar). Natijani (PNG/Figma/HTML) menga tashlang — men React Native'ga ko'chiraman.
>
> **Muhim:** quyidagi promptlarda sanab o'tilgan har bir element ilovada HAQIQATDAN ishlaydi.
> Elementni olib tashlamang — dizaynni o'zgartiring, funksiyani emas.

---

## 0. Kontekst (Stitch'ga birinchi bo'lib bering)

```
I am designing a mobile app for taxi DRIVERS in Uzbekistan. Android, portrait only.
Product name: "Toy TaxY".

Who uses it: a taxi driver, phone mounted on the dashboard, often driving, often in
bright sunlight, often one-handed. So:
- Very large tap targets (minimum 56dp height for primary actions).
- High contrast, readable at a glance. No thin light-weight text for key numbers.
- The most important number on each screen must be the biggest thing on it.
- Never put two destructive/opposite actions next to each other with equal weight.

UI language is Uzbek (Latin script) with a Russian option. Keep all labels I give you
exactly as written — they are the real strings from the app. Uzbek text can be ~30%
longer than English, so never design labels that only fit on one line at small width.

Style direction: modern dark-first interface, deep navy background, soft rounded cards
(16px radius), generous spacing, one clear accent color. Feels calm and professional,
not playful, not "gamer". Think a premium fleet tool, not a consumer ride-hailing app.

Current palette (you may refine it, but keep the semantic roles and keep it dark-first):
  background      #0F1420
  card / panel    #182031
  panel raised    #1F2940
  border          #2A3550
  primary text    #E6EBF5
  muted text      #8A96B0
  accent (blue)   #4C8DFF
  success (green) #3DDC84
  danger (red)    #FF5A5F
  warning (amber) #FFB020

Produce a coherent design system first: type scale, spacing scale, button variants
(primary / success / danger / ghost), card, list row, status pill, and an input field.
Then apply it to the screens I describe next.
```

---

## 1. Kirish ekrani (Login)

```
Screen: driver login.

Contents:
- App name "Toy TaxY" as a header with a short subtitle "Haydovchi ilovasi".
- Language switcher for Uzbek / Russian, visible but secondary (top right).
- Phone number input, label "Telefon", placeholder "+998 90 123 45 67", numeric keypad.
- Password input, label "Parol", with a show/hide toggle.
- Primary full-width button "Kirish".
- An inline error area under the button for messages like "Telefon yoki parol noto'g'ri"
  — designed as a red-tinted block, not a popup.
- Small muted footnote: "Hisob ofisdan beriladi" (accounts are created by the office —
  there is NO self sign-up, so do not add a "Register" link).

Empty state, loading state (button with spinner, label "Kirilmoqda…"), and error state.
```

---

## 2. Parolni almashtirish

```
Screen: forced password change on first login.

- Title "Parolni almashtiring", subtitle "Birinchi kirishda vaqtinchalik parolni
  o'zgartirish shart".
- One input: "Yangi parol" (show/hide toggle), minimum 6 characters hint.
- Primary button "Saqlash".
- No "skip" option — this step is mandatory.
```

---

## 3. Asosiy ekran — ISH BOSHLANMAGAN / ULANMOQDA / ONLAYN

Bu ilovaning eng muhim ekrani. Uch holatni ham chizib bering.

```
Screen: driver home / availability. Design ALL THREE states as separate frames.

Top bar: app name "Toy TaxY" on the left; on the right two text actions —
"Kabinet" (accent color) and "Chiqish" (muted).

Center: a large status card. It has a colored dot + a status word + optional sub-line:
  State A — OFFLINE:   grey dot, text "Oflayn"
  State B — CONNECTING: amber dot, text "Ulanmoqda…", and BELOW it a small red
            diagnostic line showing a raw technical error string, e.g.
            "websocket error" or "transport close". This red line is important —
            it is how the driver reports problems to support. Design it as readable
            but clearly secondary. Do not hide it behind a tap.
  State C — ONLINE:    green dot, text "Onlayn", sub-line "Buyurtma kutilmoqda…"

Below the status card: ONE full-width primary action button, 56dp+:
  when offline → green button "Ishni boshlash"
  when online  → red button "Ishni tugatish"

Design consideration: the driver must be able to tell online vs offline from 1 meter
away while driving. Consider making the whole status card carry the state color, not
just a small dot.

Also show a variant with a subtle "GPS izlanmoqda…" indicator, for when the app is
online but has not got a location fix yet.
```

---

## 4. Yangi buyurtma taklifi (eng muhim komponent)

```
Component + screen: incoming order offers.

The driver can have SEVERAL pending offers at once — design a scrollable LIST of offer
cards, with a section header "Yangi buyurtmalar (2)" where the number is the count.

Each offer card contains:
- Distance to the pickup, large and bold, e.g. "🚕 1.4 km" — this is the primary number.
- A live countdown in seconds, e.g. "97s", top right. It turns RED when 20 seconds or
  fewer remain. Consider a thin progress bar that drains as time runs out.
- Pickup address line "📍 Registon ko'chasi 12" (may be missing — design without it too).
- Optional note from the customer, prefixed "Izoh:" (may be missing).
- A collapsed map: a ghost button "📍 Xaritada ko'rsatish" that expands into a 180dp
  static map with two pins — red pin = customer, green pin = driver — plus a
  "🧭 Yo'l ko'rsatish" button under the map. Design both collapsed and expanded states.
- Bottom action row: a narrow ghost "Rad etish" (red text) and a WIDE green "Qabul qilish".
  The accept button must be roughly twice the width of decline, and be the one the
  thumb reaches naturally. They must never be confusable.

Design the card so it is obvious even at a glance which offer is closest and which is
about to expire. Show a frame with 1 offer and a frame with 3 offers.
```

---

## 5. Safar ekrani (3 bosqich)

```
Screen: active trip. Design THREE stages as separate frames — the only difference is
the primary button and whether the meter is shown.

Header title: "Mijozga ketyapman" for stages 1–2, "Safarda" for stage 3.

Customer card:
- label "Mijoz", customer name in large bold (may be "—" if hidden),
- phone number in accent color right below it.

Meter (STAGE 3 ONLY): label "Taksometr", then the running fare as the biggest element
on the screen, green, e.g. "18 400 so'm", and under it the distance "6.2 km".
This number updates every second while driving — it must be legible at arm's length.

Map: 220dp map with pins. Stages 1–2 show driver + customer pin. Stage 3 shows driver +
destination pin.

Action area:
- A row of two equal ghost buttons: "🧭 Yo'l ko'rsatish" and "📞 Qo'ng'iroq".
- Then ONE primary stage button, full width:
    stage 1 (accepted)    → blue  "Yetib keldim"
    stage 2 (arrived)     → green "Safarni boshlash"
    stage 3 (in_progress) → green "Safarni yakunlash"
- Then a ghost button with red text "Safarni bekor qilish".
- Then an SOS button: ghost style with a red border, label "🆘 SOS". It must be reachable
  in an emergency but impossible to hit by accident — design it visually separate from
  the other actions (e.g. below a divider, or requiring hold-to-activate).
```

---

## 6. Safar yakunlandi

```
Screen: trip completed confirmation.

- Big green check, title "✅ Safar yakunlandi".
- The final price as a huge number, green, e.g. "24 000 so'm" — the hero of the screen.
- Optional muted breakdown line (distance, commission).
- One primary button "OK" that returns to the home screen.

Keep it celebratory but restrained — this screen appears 20+ times a day.
```

---

## 7. Kabinet (3 ta tab)

```
Screen: driver cabinet, with a header "Kabinet", a "Yopish" action, and three tabs:
"Balans", "Safarlar", "Statistika".

TAB 1 — Balans:
- A balance card: label "Balans", then the amount as a large number with "so'm".
- Under it a muted line "To'lov turi: subscription" (or "percent").
- WARNING STATE: when the balance is negative, the card turns red-tinted and shows
  "Balans manfiy — buyurtma kelmaydi". Design this state too, it is important.
- Below: section "Tranzaksiyalar" — a list of rows. Each row: transaction type on the
  left, signed amount on the right (green for +, red for −), and a muted sub-line with
  date and resulting balance. Include an empty state "Tranzaksiyalar yo'q".

TAB 2 — Safarlar:
- A list of finished trips. Each row: status on the left, final price on the right,
  muted sub-line with date, distance and commission. Empty state "Safarlar yo'q".

TAB 3 — Statistika:
- A rating hero at the top: label "Reyting" with a star value like "4.8".
- Then a list of label/value rows: "Jami safarlar", "Umumiy daromad",
  "Qabul qilish darajasi" (%), "Yakunlash darajasi" (%), "Bekor qilish darajasi" (%).
- Consider small sparkline or progress-ring treatments for the three percentages.
```

---

## 8. Qo'shimcha holatlar (ixtiyoriy, lekin foydali)

```
Also design these smaller states, they all exist in the app:
- A push/heads-up notification card for a new order when the app is in the background.
- A full-screen "Sizning hisobingiz bloklandi" state.
- An offline/no-internet banner that can appear above any screen.
- A confirmation dialog style (used for SOS and for cancelling a trip).
```

---

## 9. Menga nima kerak (Stitch natijasi)

Stitch'dan chiqqanidan keyin quyidagilarni tashlang:

1. **Har bir ekran uchun PNG** (yuqoridagi barcha holatlar bilan — ayniqsa asosiy
   ekranning 3 holati va taklif kartasi).
2. **Rang/tipografika tokenlari** — Stitch bergan aniq HEX'lar, shrift o'lchamlari,
   radiuslar. Bu `apps/driver-app/src/theme.ts` ga to'g'ridan-to'g'ri ko'chiriladi.
3. Agar Stitch **HTML/CSS yoki Figma** eksport bersa — o'sha ham yuboring, o'lchamlarni
   aniq olish uchun.

### Men nima qilaman

`theme.ts` ni yangilayman va ekranlarni yangi dizaynga ko'chiraman. Funksional mantiq
(socket, taklif taymerlari, taksometr, GPS) o'zgarmaydi — faqat ko'rinish.

### Diqqat — dizaynda yo'qolmasligi shart

- Ulanish xatosi matni (qizil qator) — busiz "Ulanmoqda…" muammosini topib bo'lmaydi.
- Taklif taymerining sekundlari va 20s dan keyin qizarishi.
- "Rad etish" va "Qabul qilish" tugmalarining o'lchami TENG BO'LMASLIGI.
- Balans manfiy ogohlantirishi.
- SOS tugmasi.
