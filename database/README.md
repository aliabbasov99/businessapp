# Lokal PostgreSQL və API

PostgreSQL 17, `dashboard` bazası, `127.0.0.1:5432`.
Konteyner: `dashboard-postgres`; daimi volume: `dashboard-postgres-data`.
Konteynerin dayandırılması məlumatları silmir.

## İşə salmaq

Node.js 22+, npm və Podman tələb olunur (`CONTAINER_RUNTIME=docker` alternativdir).

```bash
npm run db:setup
npm start
```

`db:setup` bu ardıcıllıqla işləyir:

1. `db:start`: ayrıca PostgreSQL konteyneri və təsadüfi lokal şifrələr yaradır.
2. `db:migrate`: SQL miqrasiyalarını tranzaksiyada tətbiq edir.
3. `db:seed`: köhnə JSON məlumatlarını bir dəfə SQL cədvəllərinə köçürür.

Təkrar `db:setup` mövcud məlumatları sıfırlamır və bazada etdiyiniz dəyişikliklərin
üzərinə seed yazmır. Tətbiq edilmiş miqrasiya faylını dəyişmək əvəzinə yeni nömrəli
SQL faylı əlavə edin. Bütün ilkin import bir tranzaksiyada tamamlanır.

```bash
npm run db:stop
npm run db:start
npm run db:psql
npm run db:psql -- -c 'SELECT id, receipt_number, amount_minor, occurred_at FROM sales LIMIT 10;'
```

Host sistemdə ayrıca `psql` tələb olunmur; skript konteynerdəki rəsmi `psql`-i açır.
Hostda `psql` və ya pgAdmin varsa bağlantı: `localhost:5432`, baza `dashboard`,
istifadəçi `dashboard_owner`; şifrə `.local/postgres.env` faylındadır.

## Bağlantı və mobil tətbiq

`.env.local` və `.local/postgres.env` avtomatik yaradılır, Git-ə daxil edilmir və
fayl icazələri `0600` olur. Şablon: [../.env.example](../.env.example).

- `DATABASE_ADMIN_URL`: yalnız miqrasiya və seed skriptləri.
- `DATABASE_URL`: API üçün ayrıca `dashboard_app` rolu. Oxuya bilər; yalnız profil
  sahələrini və bildirişin `read_at` sütununu yeniləyə bilər. Satışları silə/dəyişə bilməz.
- `LOCAL_DEMO_API=true`: mövcud demo istifadəçisinin lokal API-sini açır.
- `EXPO_PUBLIC_API_URL`: yalnız ehtiyac olduqda açıq HTTP server ünvanı; şifrə deyil.

Expo Router dev rejimində `/api/*` çağırışlarını avtomatik Metro serverinə yönəldir.
Telefonla kompüter eyni şəbəkədə olmalıdır. PostgreSQL-in 5432 portu yalnız
kompüterə açıqdır; telefon bazaya birbaşa bağlanmır, Expo-nun 8081 portuna bağlanır.
`.env.local` dəyişəndə Expo serverini yenidən başladın.

Müstəqil release APK üçün ayrıca işləyən API serveri və build zamanı
`EXPO_PUBLIC_API_URL` (yaxud Expo Router `origin`) lazımdır. Telefonda `localhost`
kompüteri göstərmir. Release tətbiqlərində HTTPS server ünvanı istifadə edin;
PostgreSQL və API serveri APK-nın içinə daxil edilmir.

Bu lokal inteqrasiya mövcud demo login axınını saxlayır. Real istifadəçi girişini
yoxlamır: aktiv istifadəçi `app_metadata`-dan götürülür. İctimai serverə çıxarmazdan
əvvəl autentifikasiya və istifadəçiyə görə icazə yoxlaması əlavə edilməlidir.
`LOCAL_DEMO_API` açıq təyin edilmədikdə API `503` qaytarır.

## SQL modeli

- `users`, `businesses`, `memberships`, `branches`, `systems`
- `sales`, `products`, `stock_balances`, `suppliers`, `cash_transactions`
- `events`, `notifications`, `app_metadata`
- `overview_snapshots`, `report_periods`, `report_buckets`
- `sales_datasets`/`sales_points`, `inventory_datasets`/`inventory_points`,
  `cash_datasets`/`cash_points`, `company_datasets`/`company_points`

ID-lər `INTEGER IDENTITY`; pul `BIGINT` əsaslı `money_minor` domenidir (qəpik).
Məbləğlər JavaScript-də dəqiqlik itirməməsi üçün təhlükəsiz tam ədəd diapazonu ilə
məhdudlaşdırılıb. Tarixlər `TIMESTAMPTZ`, miqdar/faiz `NUMERIC`, kod/telefon/VÖEN
`TEXT`-dir. PK, FK, unikal açarlar və CHECK məhdudiyyətləri SQL-də tətbiq olunur.
Qalıqların filialı və məhsulu eyni biznesə, qrafik nöqtəsi dataset-in dövrünə bağlıdır.
Satış qaytarmaları mənfi məbləğlə saxlanır. İndekslər filial/tarix və
istifadəçi/bildiriş sorğularını dəstəkləyir.

`GET /api/bootstrap` ardıcıl SQL sorğularını vahid `REPEATABLE READ` tranzaksiyasında
oxuyur. Timestamp və BIGINT nəticələri API-də rəqəmə çevrilir. PostgreSQL yalnız kompüterdə işləyir. Telefonda SQL serveri yaradılmır.

Proqram açılarkən cihazda saxlanmış son uğurlu cavab dərhal göstərilir, sonra
kompüterdəki serverdən yeni məlumat alınır. Yeni cavab və serverin təsdiqlədiyi
profil/bildiriş dəyişiklikləri AsyncStorage keşinə yazılır. Keş tətbiq tam
bağlanıb açıldıqdan sonra da qalır; bu, server bazasının əvəzi deyil.

Bağlantı olmayanda son məlumatlar göstərilir və icmalda “Oflayn” qeydi görünür.
İstifadəçi bütün məlumat ekranlarına baxa bilər; serverə yazılan dəyişikliklər
bağlantı tələb edir, oflayn əməliyyat növbəsi yaradılmır. İlk dəfə heç məlumat
alınmayıbsa, ilkin yükləmə üçün bağlantı tələb olunur. Uyğunsuz və ya xarab keş
nəzərə alınmır; uğursuz sorğu əvvəlki düzgün keşi silmir.

Tətbiq ön plana qayıdanda yeniləmə yoxlanır. Oflayn halda tətbiq görünərkən
30 saniyəlik fasilələrlə yenidən cəhd edilir; arxa planda sorğu göndərilmir.
İcmaldakı “Yenilə” düyməsi ilə də təkrar cəhd etmək olar. API ünvanı dəyişərsə,
yeni ünvan ayrıca keş açarı istifadə edir. Bu demo bir aktiv hesab üçündür;
real çoxistifadəçili giriş əlavə olunanda keş açarı da sessiyanın istifadəçisinə
bağlanmalı və hesab dəyişəndə müvafiq keş təmizlənməlidir.

`PATCH /api/profile` və `PATCH /api/notifications` parametrli SQL istifadə edir.
Dəyişikliklər bazada qalır və növbəti açılışda yenidən oxunur. Mövzu, dil,
bildiriş seçimləri və digər cihaz parametrləri lokal olaraq qalır.

`seed/` yalnız import üçündür; runtime onu oxumur. Analitika mövcud nümunə
snapshot-larıdır, son 49 satış tam mühasibat jurnalı deyil. Daha ətraflı məlumat
semantikası: [../src/data/README.md](../src/data/README.md).

## Yoxlamalar

```bash
npm run test:data
npm run test:carousel
npm run test:offline
# PostgreSQL və npm start işləyərkən:
npm run test:db
npx expo lint
npx tsc --noEmit
```

`test:db` API-nin canlı bazadan oxumasını, məbləğ/tarix tiplərini, FK/CHECK
məhdudiyyətlərini, API rolunun icazələrini, profil və bildiriş yazılarını yoxlayır.
Test profil/bildiriş dəyərlərini müvəqqəti dəyişir və `finally` blokunda bərpa edir;
inkişaf bazasında işlədin. Başqa lokal port üçün `TEST_API_URL` təyin edilə bilər.

Texniki sənədlər: [Expo API routes](https://docs.expo.dev/router/web/api-routes/),
[PostgreSQL 17 constraints](https://www.postgresql.org/docs/17/ddl-constraints.html),
[node-postgres parametrli sorğular](https://node-postgres.com/features/queries).
