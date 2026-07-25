# BUNYAN Cloud API v4

البنية الخلفية الحقيقية لمنصة بُنْيَان.

## ما تم تنفيذه

- PostgreSQL database schema.
- JWT authentication.
- Roles: admin, manager, staff, viewer.
- Public APIs for projects, news, donations and participation requests.
- Protected CRUD APIs for the administration dashboard.
- Audit log for create, update and delete operations.
- Security middleware, CORS and request validation.

## التشغيل المحلي

```bash
cd backend
cp .env.example .env
npm install
createdb bunyan
npm run db:init
npm run dev
```

ثم افتح:

```text
http://localhost:8080/health
```

## إنشاء أول مدير

بعد تشغيل قاعدة البيانات والخادم، أرسل طلباً واحداً فقط إلى:

```http
POST /api/setup
Content-Type: application/json

{
  "name": "مدير بُنْيَان",
  "email": "admin@example.com",
  "password": "a-strong-password"
}
```

يتوقف هذا المسار تلقائياً عن قبول أي طلب جديد بعد إنشاء أول مستخدم.

## النشر

يمكن نشر مجلد `backend` على Render أو Railway أو أي VPS يدعم Node.js وPostgreSQL.

متغيرات البيئة المطلوبة:

- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN=https://shumsphone96-sys.github.io`
- `NODE_ENV=production`
- `PORT` توفره خدمة الاستضافة عادةً.

## المسارات الأساسية

- `GET /health`
- `POST /api/setup`
- `POST /api/auth/login`
- `GET /api/public/projects`
- `GET /api/public/news`
- `POST /api/public/donations`
- `POST /api/public/participation-requests`
- `GET /api/dashboard`
- CRUD: `/api/projects`, `/api/beneficiaries`, `/api/volunteers`, `/api/donations`, `/api/news`, `/api/requests`

المرحلة التالية هي نشر هذا الخادم، ثم ربط `app.js` بعنوان API الفعلي بدل LocalStorage.
