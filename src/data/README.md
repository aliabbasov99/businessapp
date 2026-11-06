# Məlumat modeli

Tətbiqin işlək məlumat mənbəyi **lokal PostgreSQL** bazasıdır. Quraşdırma və
`psql` əmrləri: [database/README.md](../../database/README.md).

- `schema.ts`: API cavablarının TypeScript tipləri.
- `api.ts`: Expo Router API çağırışları, profil və bildiriş yeniləmələri.
- `database.ts`: serverdən/keşdən alınan snapshot və dəyişiklik abunəlikləri.
- `sync.ts`: son uğurlu snapshot-ın saxlanması, oflayn açılış və serverlə yenilənmə.
- `snapshot-validation.ts`: API və keş strukturunun ekranlar açılmadan yoxlanması.
- `queries.ts`: yüklənmiş snapshot üzərində filtr, sıralama və əlaqələr.
- `overview.ts`, `reports.ts`: xam rəqəmlərdən ekran modellərinin hazırlanması.
- `../server/`: yalnız API serverinin istifadə etdiyi PostgreSQL bağlantısı və SQL sorğuları.
- `../../database/migrations/`: SQL sxemi, açarlar, indekslər və məhdudiyyətlər.
- `../../database/seed/`: əvvəlki JSON-lar, yalnız ilkin import və test fixture-ləri.

Başlanğıcda `DataProvider` son uğurlu snapshot-ı AsyncStorage keşindən göstərir,
sonra `/api/bootstrap` vasitəsilə kompüterdəki PostgreSQL-dən yeniləyir. Bağlantı
olmasa keşdəki məlumatlar qalır. İlk açılışda keş yoxdursa bağlantı tələb olunur.
Profil və bildiriş dəyişiklikləri yalnız server təsdiqindən sonra snapshot-a
və keşə yazılır. Mövzu, dil və cihaz seçimləri əvvəlki kimi cihazda saxlanır.
Statik seed JSON-ları oflayn fallback kimi istifadə edilmir.

## Saxlama qaydaları

- Bütün əsas və xarici açarlar müsbət tam `number`-dır. Seçimdə `null` bütün
  filialları bildirir; bunun üçün saxta `id: 0` filialı yoxdur.
- `*Minor` sahələri **qəpiklə tam ədəddir**: `12850` → `128.50 AZN`.
  Mənfi məbləğlər rəqəmdir; geri qaytarma ayrıca `type` ilə göstərilir.
- Faizlər `number`-dır: `-8.2` → `−8.2%`. Məbləğlərə valyuta, minlik ayırıcısı,
  faiz və ya istiqamət işarəsi yazılmır.
- `occurredAt`, `createdAt`, `readAt`, `startsAt`, `endsAt`, `asOf` bazada
  **TIMESTAMPTZ**, API-də Unix **millisaniyəsidir**. `endsAt` intervala daxil deyil. Formatlama və günə görə
  qruplaşdırma cihazın saat qurşağından asılı olmayaraq `Asia/Baku` ilə aparılır.
- Telefon, VÖEN və məhsul kodu mətn olaraq qalır: bunlar hesablama üçün deyil,
  əvvəlindəki sıfırları və `+` işarəsini itirməməlidir. Boş telefon `null`-dır.
- Məhsulun miqdarı və ölçü vahidi ayrıdır. Qalığın dəyəri miqdar × maya qiyməti,
  mənfəət satış − maya, aylıq xalis pul axını daxilolma − ödəniş ilə hesablanır.
- Bildiriş yalnız istifadəçi və hadisəyə istinad edir. Başlıq, çek məbləği, filial,
  endirim və səbəb hadisədən hazırlanır; `readAt: null` oxunmamış deməkdir.
- Ad, tarix, məbləğ və saylar UI/AI cavablarında ayrıca təkrarlanmır.
  Görünüş rəngləri və ikonlar entity JSON-larına daxil edilmir.

## Əlaqələr və analitika

`users → memberships → businesses → branches`; satış və pul əməliyyatları
filiala bağlıdır. `stock-balances` məhsulla filialı əlaqələndirir. Sistem və
təchizatçılar biznesə, bildirişlər istifadəçi və hadisəyə bağlıdır.

İcmal aylıq aqreqat snapshot-dır. Son satış/məhsul siyahıları tam mühasibat jurnalı
deyil, nümunə çıxarışıdır; onların cəmi biznes snapshot-ının yerinə istifadə edilmir.
Pul axını hesabatındakı balans tarixi hesab qalığıdır; icmaldakı aylıq xalis
pul axını ilə eyni ölçü deyil. İllik qrafikdə müqayisə üçün əlavə əvvəlki ay var;
illik dövriyyə cəmi yalnız son 12 ayı əhatə edir. Son ay qismən tamamlanmış ola bilər.

Hər qrafik nöqtəsi mövqeyə və çevrilmiş mətn etiketinə deyil, `bucketId`-yə bağlıdır.
Filial satış seriyaları əvvəlki demo filial məbləğlərinin nisbəti ilə ayrılmış
nümunələrdir; real filial ölçmələri deyil. Qəpik yuvarlaqlaşdırma fərqi ikinci
filiala ayrılır, beləliklə filiallar üzrə cəm ümumi göstəriciyə bərabərdir.
Digər hesabatlar biznes səviyyəsindədir və filial seçiləndə bu əhatə UI-da göstərilir.
Əvvəlki çəkilər/jitter ilə həftəlik və aylıq qrafik yaratmaq tətbiqdən çıxarılıb.

Əvvəl təkrarlanan çeklər fərqlənəndə icmalın son çekləri əsas götürülüb. Köhnə
qısa saatlarda tarix və AM/PM olmadığı üçün nümunə vaxtları aşağıdakı tarixə
uyğunlaşdırılıb: **3 noyabr 2026, Asia/Baku**. Bunlar real əməliyyat tarixçəsi deyil.

Yeni cədvəl/sahə əlavə edəndə tipi və əlaqəni də əlavə edin. Yoxlamalar:

```sh
npm run test:data
npm run test:offline
npx expo lint
npx tsc --noEmit
```
