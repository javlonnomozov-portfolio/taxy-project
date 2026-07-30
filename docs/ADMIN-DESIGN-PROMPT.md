# Admin panel — Google Stitch uchun dizayn promptlari

> Maqsad: `apps/admin` (React + Vite, **desktop brauzer**) uchun yangi vizual dizayn.
> Ishlatish: har blokni Stitch'ga ALOHIDA prompt sifatida bering — avval "0. Kontekst
> va CHEKLOVLAR", keyin ekranlar. Natijani (PNG / ranglar / HTML) menga tashlang.
>
> **Bu hujjat mavjud paneldan o'qib yozilgan.** Har bir jadval ustuni, tugma va
> ko'rsatkich haqiqatan ishlaydi. Driver-app dizaynida Stitch mavjud bo'lmagan
> ma'lumotlarni o'ylab topgan edi (mijoz surati, reytingi, to'lov turi) — vaqt
> yo'qotdik. Shuning uchun quyida cheklovlar QAT'IY yozilgan.

---

## 0. Kontekst va CHEKLOVLAR (birinchi bo'lib bering)

```
I am redesigning an internal admin/dispatcher web panel for a small taxi company
in Uzbekistan. Product name: "Toy TaxY". Desktop browser only (1280–1920 px wide),
used on a laptop by a dispatcher who works a full shift.

=== HARD CONSTRAINTS — READ FIRST ===

This is a REDESIGN of an existing tool, not a new product. Your job is to make
the EXISTING screens look better. Do NOT design anything I have not listed.

Specifically, DO NOT ADD:
- no new pages, tabs, menu items or navigation sections
- no charts, graphs, sparklines, trend arrows, "vs last week" comparisons
- no KPI cards other than the exact ones I list
- no notification bell, no search bar, no user avatar/profile menu
- no dark/light theme toggle, no settings gear beyond the page I describe
- no export/print/download buttons, no bulk-select checkboxes
- no filters or sort controls other than the ones I list
- no "recent activity" feeds, no onboarding banners, no empty-state illustrations
  beyond a single line of muted text
- no company logo other than the text "Toy TaxY"
- no data I did not name (if a column is not in my list, it does not exist)

If a screen looks sparse, LEAVE IT SPARSE. Sparse is correct here — this is a
working tool, not a marketing dashboard. Every element you invent costs me
development time and will be deleted.

=== WHO USES IT ===

A dispatcher watching orders come in, and an admin managing drivers and prices.
They keep this panel open all day. Priorities, in order:
1. Density — they need to see many rows at once without scrolling.
2. Scanability — an order that needs attention must stand out instantly.
3. Calm — no animation, no bright decoration; the only strong colour is a problem.

Text is Uzbek (Latin) with a Russian option. Keep the exact labels I give you.
Uzbek strings run ~30% longer than English — do not design labels that only fit
on one line at narrow widths.

=== STYLE ===

Dark, dense, professional. Deep navy background, flat cards with 1px borders,
12px radius, small type (13–14 px body), tables as the primary element.
Think an internal ops console: Linear or Grafana, not a SaaS landing page.

Current palette (refine if you like, keep the semantic roles, stay dark):
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

Produce a small design system first: type scale, table row, status pill, card,
button variants (primary / danger / success / plain), input, and the sidebar.
Then apply it to the screens below.
```

---

## 1. Umumiy karkas (layout)

```
Screen: the application shell, present on every page.

LEFT SIDEBAR, fixed ~210 px wide:
- At the top: the text "Toy TaxY", and directly under it in small muted text the
  logged-in role — literally one of: "operator", "admin", "super_admin".
- Navigation links, in this exact order and no others:
    "Panel"        (dashboard)
    "Buyurtmalar"  (orders)
    "Mijozlar"     (customers)
    "Rejalashtirilgan" (scheduled orders)
    "Haydovchilar"  (admin only — hidden for the operator role)
    "Sozlamalar"    (admin only — hidden for the operator role)
- Pushed to the bottom: two plain buttons, "Ru / Uz" (language switch) and
  "Chiqish" (logout).
- Show the active link state clearly.

MAIN AREA: page title at top-left, then page content. Nothing else in the header
— no breadcrumbs, no search, no bell, no avatar.

Design both states of the sidebar: with the admin links visible, and with them
hidden (operator role).
```

---

## 2. Panel (dispatcher dashboard) — eng muhim ekran

```
Screen: the dispatcher dashboard. This is where the dispatcher spends the whole
shift. It has exactly four blocks, top to bottom.

BLOCK 1 — three stat cards in a row. Label under a big number:
    number of active orders   → "Faol buyurtmalar"
    number of online taxis    → "Onlayn taksilar"
    number of alerts          → "Ogohlantirishlar"  (turns RED when > 0)

BLOCK 2 — five smaller stat cards, last-24-hours metrics:
    "Jami (24s)"          e.g. 48
    "Haydovchi topilmadi"  a percentage, e.g. 12%  (turns RED above 15%)
    "Yakunlangan"          a percentage, e.g. 81%
    "Qabul vaqti"          seconds, e.g. 34s
    "O'rtacha narx"        money, e.g. 18 400 so'm
  These are plain numbers. NO charts, NO trend arrows, NO comparisons.

BLOCK 3 — two columns side by side, roughly 2:1 width.
  LEFT: a live map (~400 px tall), rounded corners, dark map tiles. On it, simple
  round dots — not photo pins:
      green dot  = free taxi
      grey dot   = taxi on a trip
      red dot    = order nobody accepted
      amber dot  = order being offered right now
      blue dot   = order already assigned
    Clicking a dot opens a small popup. Show the map with ~8 dots and one popup open.
  RIGHT, stacked:
      a card "Ogohlantirishlar" — a scrollable list of short one-line messages,
      each with a coloured left border (red for a serious one, amber otherwise).
      Show 4 items and the empty state ("Ogohlantirish yo'q").
      a card "Taksi paneli" — details of the selected taxi: name, plate, category,
      rating, and a button "Taklif yuborish". Also design its idle state, which
      shows one muted line: "Avval buyurtmani tanlang".

BLOCK 4 — the active-orders table, columns exactly:
    "Holat" (a status pill), "Toifa", "Narx", "Yaratildi", "Amallar"
  In the actions column: a plain button "Yopish".
  Rows for orders nobody accepted must be tinted red across the whole row.
  Include the empty state: one muted row, "Faol buyurtma yo'q".

DISPATCH MODE — an important state. When the dispatcher clicks an unassigned
order, a thin amber-bordered bar appears above the map: an instruction sentence
plus a "Bekor qilish" button. Design this bar.
```

---

## 3. Buyurtmalar (orders history)

```
Screen: order history. One card containing a filter row and a table.

FILTER ROW — four plain buttons acting as tabs (the active one filled):
    "Hammasi"  "Faol"  "Yakunlangan"  "Bekor qilingan"
  On the right end of the same row, muted text: "Ko'rsatilyapti: 143".
  Nothing else — no date picker, no search box, no sort dropdown.

TABLE — columns exactly:
    "Holat" (status pill), "Toifa", "Narx", "Yaratildi", "Tugadi"
  Roughly 20 rows visible without scrolling. Include the empty state.
```

---

## 4. Haydovchilar (drivers — admin only)

```
Screen: driver management. Title "Haydovchilar" with a primary button
"Haydovchi qo'shish" on the right, which toggles a form open.

ADD FORM (collapsed by default) — a card with these inputs and nothing more:
    "Telefon", "Ism", "Familiya",
    "Toifa" (a select: standard / comfort / cargo),
    "Rusum", "Rangi", "Davlat raqami"
  and a primary button "Qo'shish".

AFTER ADDING — a success card showing the driver's phone and a ONE-TIME temporary
password in large monospace text, with a muted warning that it is shown only once.

TABLE — columns exactly:
    "Ism", "Telefon", "Holat", "KYC", "Billing", "Reyting",
    "Bekor qilish %", "Balans", "Amallar"
  - "Holat" and "KYC" are status pills.
  - "Balans" must be RED when negative (drivers may go into debt — this is normal
    and the dispatcher needs to spot it).
  - "Amallar" holds small plain buttons: "Tasdiqlash", "Bloklash", "Billing",
    "To'ldirish".
  Design one row with a negative balance and one blocked driver.
```

---

## 5. Mijozlar (customers)

```
Screen: customer list. One card, one table, no filters, no actions column.

Columns exactly: "Ism", "Telefon", "Til", "Reyting", "Kelmagan", "Holat", "Ro'yxatdan"
  "Holat" is a pill: "Faol" or "Bloklangan".
Include the empty state. This screen is READ-ONLY — do not add buttons.
```

---

## 6. Rejalashtirilgan buyurtmalar

```
Screen: scheduled orders awaiting the dispatcher's confirmation.
One card, one table. Columns exactly:
    "Toifa", "Rejalashtirilgan vaqt", "Izoh", "Yaratildi", and an actions column
    holding a single primary button "Tasdiqlash".
Include the empty state. This screen is usually EMPTY — make the empty state
look intentional, not broken.
```

---

## 7. Sozlamalar (settings — admin only)

```
Screen: settings. Three stacked cards, in this order.

CARD 1 "Surge va bekor qilish":
    a checkbox "Surge faol"
    a number input "Surge koeffitsienti"  (e.g. 1.2)
    a number input "Jarimasiz bekor (sek)" (e.g. 120)
    a primary button "Saqlash"

CARD 2 "Har zakaz uchun to'lov":
    a number input "Zakaz narxi (so'm)" (e.g. 1000)
    a primary button "Saqlash"
    below it one muted explanatory line

CARD 3 "Tariflar" — an EDITABLE table, one row per vehicle category
(standard / comfort / cargo). Every cell except the first is a number input:
    "Toifa", "Bazaviy", "Km narxi", "Kutish/daq", "Bepul kutish",
    "Tungi koeff.", and a "Saqlash" button per row.

Show the "saved" confirmation as a small green pill next to the page title.
No tabs, no accordion, no reset button.
```

---

## 8. Kirish ekrani (login)

```
Screen: login. A single centred card ~320 px wide on the dark background.
    the text "Toy TaxY"
    input "Login"
    input "Parol" (password)
    a full-width primary button "Kirish"
    a plain full-width button "Ru / Uz"
    an inline red error line for "Login yoki parol noto'g'ri"
No "forgot password", no "remember me", no registration link — accounts are
created manually in the database.
```

---

## 9. Menga nima kerak (Stitch natijasi)

1. **Har ekran uchun PNG** — ayniqsa Panel (dispatch rejimi bilan) va
   Haydovchilar (manfiy balans qatori bilan).
2. **Ranglar va tipografika tokenlari** — aniq HEX, shrift o'lchamlari, radiuslar,
   jadval qatori balandligi. Bu `apps/admin/src/styles.css` ga ko'chiriladi.
3. **HTML/CSS eksport** bo'lsa — o'shani ham yuboring, o'lchamlar aniq bo'ladi.

### Diqqat — dizaynda yo'qolmasligi shart

- Yopilmagan zakaz qatorining **qizil fon**i (dispatcher shuni izlaydi).
- Manfiy balansning **qizil** ko'rinishi.
- Ogohlantirishlarning chap chegara rangi (qizil / sariq farqi).
- Dispatch rejimidagi sariq chizig'i.
- Jadval **zichligi** — bir ekranda ~20 qator ko'rinishi kerak.
- Operator roli uchun "Haydovchilar" va "Sozlamalar" havolalari **yashiriladi**.
