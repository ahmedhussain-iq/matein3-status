# Matein3Store Status Pages

هذا المستودع يحتوي على الصفحات الثابتة (Static Pages) الخاصة بمتجر matein3store.com، والتي تُعرض من خلال Cloudflare Edge لتقليل الضغط على السيرفر.

## الصفحات المتاحة:
1. `blocked.html`: صفحة حظر IP (تظهر عندما يقوم نظام الحماية بحظر IP الزائر).
2. `index.html`: صفحة الصيانة (تظهر عندما يكون السيرفر قيد إعادة التشغيل 502/503).
3. `404.html`: صفحة غير موجودة.

## طريقة العمل:
1. هذا المستودع يُنشر تلقائياً على **Cloudflare Pages** (مجاني).
2. يوجد **Cloudflare Worker** يعمل كـ Middleware على الدومين الرئيسي.
3. الـ Worker يفحص الـ IP ضد **KV Storage**.
4. إذا كان الـ IP محظوراً، يجلب صفحة `blocked.html` من Cloudflare Pages ويعرضها للزائر (بدون الوصول للسيرفر).
5. إذا كان السيرفر متوقفاً (502/503)، يجلب صفحة `index.html` ويعرضها للزائر.

## خطوات الإعداد في Cloudflare:

### 1. إنشاء KV Namespace
1. اذهب إلى Cloudflare Dashboard > Workers & Pages > KV
2. اضغط `Create a namespace`
3. سمه `blocked-ips`
4. انسخ الـ `ID` الخاص به (ستحتاجه في لوحة تحكم المتجر).

### 2. نشر الصفحات على Cloudflare Pages
1. اذهب إلى Workers & Pages > Create > Pages > Connect to Git
2. اختر هذا المستودع `matein3-status`
3. اترك الإعدادات الافتراضية واضغط `Save and Deploy`
4. انسخ رابط الـ Pages (مثلاً `matein3-status.pages.dev`).

### 3. إنشاء الـ Worker
1. اذهب إلى Workers & Pages > Create > Worker
2. سمه `matein3-middleware`
3. اضغط `Deploy` ثم `Edit code`
4. انسخ محتوى ملف `worker.js` من هذا المستودع والصقه هناك، ثم `Save and deploy`.

### 4. ربط الـ Worker بـ KV و Pages
1. في صفحة إعدادات الـ Worker، اذهب إلى تبويب `Settings` > `Variables`
2. أضف Environment Variable:
   - Variable name: `PAGES_URL`
   - Value: رابط الـ Pages الذي نسخته في الخطوة 2 (بدون `/` في النهاية).
3. انزل إلى قسم `KV Namespace Bindings` وأضف:
   - Variable name: `BLOCKED_IPS`
   - KV namespace: اختر `blocked-ips` الذي أنشأته في الخطوة 1.

### 5. تفعيل الـ Worker على الدومين
1. في صفحة إعدادات الـ Worker، اذهب إلى تبويب `Triggers`
2. في قسم `Routes`، اضغط `Add route`
3. أدخل: `matein3store.com/*`
4. اختر الـ Zone الخاصة بك.

### 6. إعداد لوحة تحكم المتجر
1. اذهب إلى لوحة تحكم المتجر > الإعدادات > الأمان > Cloudflare
2. أدخل الـ `Account ID` والـ `KV Namespace ID` ورابط الـ `Pages URL`.
3. تأكد من أن الـ API Token لديه صلاحيات: `Workers KV Storage: Edit` و `Workers Scripts: Edit`.
