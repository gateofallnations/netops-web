# NetOps Hub — نسخه وب

نسخهی وبাসিতgid بر اساس نسخهی اندروید، **بدون Service Worker و بدون PWA** — بنابراین مشکل کش قدیمی وجود ندارد و هر بار نسخهی تازه از سرور میآید.

**آدرس:** https://gateofallnations.github.io/netops-web/

## چرا این نسخه؟

- فاقد `sw.js` / manifest / Add to Home Screen است؛ صرفاً یک وب اپ ساده است.
- از همان Worker امن اندروید/PWA استفاده میکند: `netops-pwa-api` with KV binding.
- توکن کلودفلر و هش رمزها در مرورگر وجود ندارند.

## امکانات (معادل اندروید)

| صفحه | محتوا |
|---|---|
| Dashboard | هدر NetOps Hub، چیپهای سریع، KPI چهارتایی، FeatureCardها |
| Company Information | موجودی IP / vCenter / Rahkaran |
| Servers | لیست و جستجوی سرورها |
| Academy | ۸ رشته + ۱۶۵ مرجع CMD/CPL/Keywords/Quick Sheets |
| Helpdesk | دانشنامه (cheats)، تیکتها،reports، **عیبیابی شبکه (۵۳ سناریو)** |
| Phonebook | ۱۷۰ مخاطب + تماس مستقیم |
| Tools | ماشینحساب سابنت و پهنای باند |
| Users | کاربران، تغییر پسورد، حذف، لاگ ممیزی (Creator/Admin) |
| Favorites / Search | علاقهمندیها، یادداشتها، جستجوی سراسری |
| Settings | ۵ پالت،glass ۱۰–۹۵٪، زبان FA/EN، صدا، موشن |

## استقرار

مخزن `gateofallnations/netops-web` روی GitHub Pages (branch `main`) است.

## فایلها

```
index.html          رابط
styles.css          توکنهای APK + والپیپر واقعی
app.js             全部 صفحهها و منطق
reference_library.json   ۱۶۵ مطلب مرجع
diagnostics.json    ۵۳ سناریوی عیبیابی (استخراج از NetworkProblems.kt اندروید)
wallpaper.jpg       والپیپر APK
```

> نکته: Data updates through the Cloudflare Worker; the website itself is static and always fresh.
