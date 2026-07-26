# IMAGE — شروع از صفر

همان تجربهٔ پروژهٔ IMAGE: دکمهٔ Play → دوربین پشت frost → عکس → آپلود Cloudinary → پخش ویدیو  
هاستینگ: GitHub Pages

---

## ۱) اکانت جدید Cloudinary

1. ثبت‌نام: https://cloudinary.com/users/register_free
2. از Dashboard مقدار **Cloud name** را کپی کن.
3. برو به **Settings → Upload → Upload presets → Add upload preset**
4. تنظیمات پیشنهادی preset:
   - **Signing mode:** Unsigned
   - **Folder:** `IMAGE` (یا هر نامی که می‌خواهی)
   - در صورت امکان محدودیت فرمت روی `jpg` / `png` و سقف حجم بگذار
5. نام preset را ذخیره کن (مثال: `image-capture`).
6. یک ویدیو در Media Library آپلود کن و **URL** امن آن را بردار (برای پخش بعد از عکس).

سپس `config.js` را پر کن:

```js
window.CLOUDINARY_CONFIG = {
  cloudName: 'YOUR_CLOUD_NAME',
  uploadPreset: 'YOUR_UNSIGNED_PRESET',
  folder: 'IMAGE',
  countdownSeconds: 2,
  jpegQuality: 0.92,
  playbackVideoUrl: 'https://res.cloudinary.com/.../video/upload/....mp4'
};
```

**هرگز API Secret را در فرانت‌اند نگذار.**

---

## ۲) ریپوی جدید GitHub

```bash
cd image-app
git init
git add .
git commit -m "Initial IMAGE-style capture app"
gh repo create image-app --public --source=. --remote=origin --push
```

نام ریپو را عوض کن اگر خواستی.

---

## ۳) فعال‌سازی GitHub Pages

1. در ریپو: **Settings → Pages**
2. Source را روی **GitHub Actions** بگذار.
3. بعد از push به `main`، workflow `Deploy to GitHub Pages` اجرا می‌شود.
4. آدرس سایت:

`https://<USERNAME>.github.io/<REPO>/`

سایت فقط روی **HTTPS** به دوربین دسترسی می‌دهد (localhost هم برای تست OK است).

---

## ۴) تست محلی

```bash
npx --yes serve .
```

1. `config.js` را پر کن
2. صفحه را باز کن
3. روی دکمهٔ Play بزن و اجازهٔ دوربین بده
4. عکس باید در فولدر Cloudinary دیده شود و ویدیو پخش شود

---

## فایل‌ها

| فایل | نقش |
|------|-----|
| `index.html` | ظاهر frost + دکمهٔ Play |
| `app.js` | دوربین مخفی، capture، آپلود، پخش ویدیو |
| `config.js` | تنظیمات Cloudinary |
| `frost.html` | ریدایرکت به index |
| `.github/workflows/pages.yml` | دیپلوی خودکار |
