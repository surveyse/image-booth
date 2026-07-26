/**
 * تنظیمات Cloudinary — اکانت جدید را اینجا پر کنید.
 * API Secret را هرگز اینجا نگذارید.
 */
window.CLOUDINARY_CONFIG = {
  cloudName: '',           // از Dashboard کپی کنید
  uploadPreset: '',        // Unsigned preset — مثال: image-capture
  folder: 'IMAGE',         // فولدر داخل Media Library
  countdownSeconds: 2,     // تأخیر قبل از عکس (ثانیه)
  jpegQuality: 0.92,
  // بعد از آپلود این ویدیو پخش می‌شود (الزامی برای تجربهٔ کامل)
  playbackVideoUrl: ''
};
