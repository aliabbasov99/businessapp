# LOGIN YOLLARI

1. Biz admin panelinde istifadeci yaradariq ve istifadeciye teqdim edirik istifadecinin hansi bazaya qosulcagini da ozumuz teyin edirik.

2. Istifadeci google ve ya apple login ile daxil olur. Waitliste elave olunur biz admin panelinden onun hansi bazaya daxil olacagini secib tesdiqleyirik ve daxil olub statistikalari gore bilir. Apple ID Ni apple developer hesabi alanda elave edecem telesme.

3. Telefon ile giris (https://1sms.az/api-keys) 100 sms- 10 MANAT
   X-API-Key: <SIZIN_API_ACARINIZ>
   Content-Type: application/json
   Body
   {
   "to": "+994501234567",
   "text": "Sizin OTP kodunuz: 123456",
   "senderName": "OTP 1SMS"
   }
   Cavab
   {
   "success": true,
   "messageId": "...",
   "cost": 1,
   "balance": 4999
   }

// ILERI MERHELE. HELE HECBIR EMELIYYAT APARILMASIN

# 1C VE MOREX PROGRAMLARINDAN VERILENLERI ALMAQ VE GOSTERMEK

Her defe mueyyen muddetden bir bizim backende sorgu gelecek ve onu qeyd edecek bazaya

# DATABASE

USER
email | password | status -> "a" for accepted, "r" rejected, "p" for pending

# BIR PANEL OLACAQ BIZ ORDAN YENI ISTIFADECI REGISTRASIYA OLMAQ ISTEDIYINDE QEBUL VE YA REDD EDECIYIK.

databse deki melumatlari gorunecek sade material ui ile hazirlanmis

backend: businessappapi.promar.workers.dev
frontend: businessapp.promar.workers.dev

businessappapi.promar.workers.dev

login olmaga calisdiqda react app im istek gonderib istifadeciyi yoxlayacaq eger istifadeci approved dusa daxil olmaga icaze versin.
bidene de api de route yaradilsin yeni istifadeci daxil ede bilim.



# API - NECE ISTIFADE OLUNACAQ
Dokumentasiyanıza birbaşa kopyalayıb əlavə edə biləcəyiniz **API-lərin siyahısı və istifadə qaydası** aşağıdakı kimidir:

---

## 🚀 API Dokumentasiyası (`businessappapi.promar.workers.dev`)

### Base URL

`[https://businessappapi.promar.workers.dev](https://businessappapi.promar.workers.dev)`

---

### 1. İstifadəçi Girişi (Login)

İstifadəçinin sistemə daxil olmasını və statusunu yoxlayır.

* **Endpoint:** `POST /api/login`
* **Content-Type:** `application/json`
* **Request Body:**

```json
{
  "email": "user@example.com",
  "password": "user_password"
}

```

* **Cavablar (Response):**
* **Uğurlu (Təsdiqlənmiş - `status: "a"`):** `200 OK`
```json
{
  "success": true,
  "status": "a",
  "message": "Uğurla daxil oldunuz.",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "database_target": "db_branch_1"
  }
}

```


* **Admin Təsdiqi Gözləyən (`status: "p"`):** `403 Forbidden`
```json
{
  "success": false,
  "status": "p",
  "message": "Hesabınız admin təsdiqini gözləyir."
}

```


* **Rədd Edilmiş (`status: "r"`):** `403 Forbidden`
```json
{
  "success": false,
  "status": "r",
  "message": "Hesabınız rədd edilib."
}

```





---

### 2. Yeni İstifadəçi Qeydiyyatı (Register / Create User)

Yeni istifadəçinin registrasiyası və ya admin panelindən əlavə edilməsi üçün.

* **Endpoint:** `POST /api/users`
* **Content-Type:** `application/json`
* **Request Body:**

```json
{
  "email": "user@example.com",
  "password": "optional_password",
  "phone": "+994501234567",
  "auth_provider": "custom", 
  "status": "p", 
  "database_target": "db_baku"
}

```

> **Qeyd:** `auth_provider` dəyərləri: `'custom'`, `'google'`, `'apple'`, `'phone'`. Status verilmədikdə susmaya görə `'p'` (pending) təyin edilir.

* **Cavab (Response):** `201 Created`

```json
{
  "success": true,
  "message": "İstifadəçi yaradıldı.",
  "id": 1
}

```

---

### 3. Bütün İstifadəçilərin Siyahısı (Admin Get Users)

Admin paneldə bütün istifadəçiləri siyahılamaq üçün istifadə olunur.

* **Endpoint:** `GET /api/admin/users`
* **Cavab (Response):** `200 OK`

```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "email": "user@example.com",
      "phone": null,
      "auth_provider": "custom",
      "status": "a",
      "database_target": "db_baku",
      "created_at": "2026-03-01 12:00:00"
    }
  ]
}

```

---

### 4. İstifadəçi Statusunu və Bazanı Yeniləmək (Admin Update User)

İstifadəçini təsdiqləmək (`a`), rədd etmək (`r`) və ya qoşulacağı bazanı təyin etmək üçün.

* **Endpoint:** `PUT /api/admin/users/:id`
* **Content-Type:** `application/json`
* **Request Body:**

```json
{
  "status": "a",
  "database_target": "db_branch_2"
}

```

* **Cavab (Response):** `200 OK`

```json
{
  "success": true,
  "message": "İstifadəçi məlumatları yeniləndi."
}

```

---

### 5. OTP SMS Göndərilməsi (1SMS Integration)

Telefon nömrəsi ilə giriş zamanı OTP kod göndərmək üçün.

* **Endpoint:** `POST /api/send-otp`
* **Content-Type:** `application/json`
* **Request Body:**

```json
{
  "phone": "+994501234567",
  "code": "123456"
}

```

* **Cavab (Response):** `200 OK`

```json
{
  "success": true,
  "messageId": "...",
  "cost": 1,
  "balance": 4999
}

```