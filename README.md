# Freelancer Connect

Platform sosial + marketplace freelance: profil profesional & portofolio digital, gig/paket layanan, pembayaran aman lewat escrow, ulasan & rating, dan pesan langsung untuk negosiasi proyek. Backend REST API (Node.js/Express) + frontend web responsif (mobile & desktop) dalam satu aplikasi yang bisa langsung dijalankan di server Anda sendiri.

## Fitur

- **Akun & Profil** — daftar/masuk (JWT), profil profesional dengan judul, bio, keahlian.
- **Portofolio Digital** — tambah/hapus karya (judul, deskripsi, tautan, gambar) dan sertifikasi.
- **Gig / Paket Layanan** — buat, kelola, cari, dan filter jasa berdasarkan kategori/harga.
- **Sistem Escrow (simulasi alur kerja)** — dana pembeli "ditahan" oleh platform saat pembayaran, baru "dicairkan" ke freelancer setelah pembeli menyetujui hasil. Ada alur revisi dan sengketa.
- **Ulasan & Rating** — pembeli memberi rating 1–5 dan komentar setelah pesanan selesai.
- **Pesan Langsung** — obrolan per-pesanan untuk membahas kebutuhan, tenggat, dan revisi.
- **Feed Sosial** — pengguna membagikan progres/cerita singkat dan saling menyukai postingan.
- Frontend satu halaman (SPA), responsif untuk **mobile maupun desktop**, tanpa perlu proses build (`fetch`, hash-router, vanilla JS).

## Batasan penting (baca sebelum digunakan sungguhan)

1. **Escrow di sini adalah simulasi status/alur kerja, bukan pemroses pembayaran sungguhan.** Tidak ada uang asli yang berpindah. Untuk transaksi nyata, Anda **wajib** mengintegrasikan payment gateway berlisensi (mis. Midtrans, Xendit, atau bank/e-wallet lain yang mendukung penahanan dana/virtual account) di `src/routes/orders.js` pada endpoint `/pay` dan `/release` — sudah ada komentar `INTEGRASI PEMBAYARAN` di titik yang perlu diubah. Jangan pernah menganggap konfirmasi dari sisi browser sebagai bukti pembayaran; selalu verifikasi lewat webhook resmi dari gateway.
2. **Penyimpanan data memakai file JSON** di folder `data/` (dipilih agar aplikasi bisa langsung `npm install && npm start` di server mana pun tanpa instalasi database eksternal). Ini cocok untuk demo, MVP, atau trafik kecil-menengah. Untuk skala produksi/trafik tinggi, ganti `src/db.js` dengan database sungguhan (PostgreSQL/MySQL/MongoDB) — struktur pemanggilannya sudah dibuat mirip supaya migrasi mudah.
3. Lingkungan yang membuat kode ini **tidak memiliki akses internet**, sehingga `npm install` dan pengujian langsung belum bisa dijalankan di sini. Setiap file sudah diperiksa validitas sintaksnya (`node --check`), tetapi Anda perlu menjalankan dan mengujinya sendiri di server/komputer dengan akses internet sebelum go-live.
4. Belum ada halaman admin untuk menyelesaikan sengketa (dana tetap aman tertahan di escrow saat status `disputed`, menunggu keputusan manual) — tambahkan sesuai kebutuhan.
5. Unggah gambar portofolio/gig saat ini memakai **URL gambar**, bukan unggah file langsung. Untuk unggah file, tambahkan endpoint dengan `multer` (atau layanan penyimpanan seperti S3/Cloudinary).

## Menjalankan di komputer/server sendiri

Prasyarat: Node.js versi 18 ke atas.

```bash
# 1. Masuk ke folder proyek
cd freelancer-connect

# 2. Install dependency
npm install

# 3. Salin file environment lalu sesuaikan (WAJIB ganti JWT_SECRET)
cp .env.example .env

# 4. Jalankan server
npm start
```

Buka `http://localhost:3000` di browser (bisa diakses dari HP di jaringan yang sama lewat `http://<IP-server-Anda>:3000`).

## Menjalankan di server publik (VPS, dsb.)

1. Upload seluruh folder proyek ke server (mis. lewat `git clone` atau `scp`).
2. Jalankan langkah **npm install** dan siapkan `.env` seperti di atas.
3. Gunakan process manager agar server tetap hidup, contoh dengan **PM2**:
   ```bash
   npm install -g pm2
   pm2 start server.js --name freelancer-connect
   pm2 save
   pm2 startup
   ```
4. Pasang **reverse proxy** (Nginx/Caddy) di depan aplikasi supaya bisa diakses lewat domain dan HTTPS, contoh konfigurasi Nginx minimal:
   ```nginx
   server {
     listen 80;
     server_name freelancerconnect.contoh.com;
     location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $remote_addr;
     }
   }
   ```
   Lalu aktifkan HTTPS gratis dengan **Certbot** (`certbot --nginx`).
5. Setelah domain aktif, aplikasi otomatis bisa diakses publik lewat browser mobile maupun desktop — frontend-nya adalah satu halaman responsif yang sama untuk keduanya.

## Struktur proyek

```
freelancer-connect/
├── server.js                 # Bootstrap Express + routing utama
├── src/
│   ├── db.js                 # Datastore JSON sederhana (ganti dgn DB sungguhan utk produksi)
│   ├── middleware/auth.js    # Middleware JWT
│   ├── utils/helpers.js
│   └── routes/
│       ├── auth.js           # Register/login
│       ├── profiles.js       # Profil, portofolio, sertifikasi
│       ├── gigs.js           # Gig/paket layanan
│       ├── orders.js         # Alur pesanan & escrow
│       ├── messages.js       # Chat per-pesanan
│       ├── reviews.js        # Ulasan & rating
│       └── posts.js          # Feed sosial
├── public/                   # Frontend statis (SPA)
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
└── data/                      # File JSON data (dibuat otomatis saat pertama jalan)
```

## Ringkasan API

Semua respons berupa JSON. Endpoint yang butuh login mengirim header `Authorization: Bearer <token>`.

| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/api/auth/register` | Daftar akun baru |
| POST | `/api/auth/login` | Masuk |
| GET | `/api/auth/me` | Data akun yang sedang login |
| GET | `/api/profiles/:id` | Profil publik |
| PUT | `/api/profiles/me` | Perbarui profil sendiri |
| POST/DELETE | `/api/profiles/me/portfolio(/:id)` | Kelola portofolio |
| POST/DELETE | `/api/profiles/me/certifications(/:id)` | Kelola sertifikasi |
| GET | `/api/gigs` | Jelajahi/cari gig |
| POST/PUT/DELETE | `/api/gigs(/:id)` | Kelola gig sendiri |
| POST | `/api/orders` | Buat pesanan baru |
| POST | `/api/orders/:id/pay` | Bayar → dana ditahan escrow |
| POST | `/api/orders/:id/deliver` | Freelancer kirim hasil |
| POST | `/api/orders/:id/release` | Klien setujui → dana dicairkan |
| POST | `/api/orders/:id/request-revision` | Minta revisi |
| POST | `/api/orders/:id/dispute` | Ajukan sengketa |
| POST | `/api/orders/:id/cancel` | Batalkan (sebelum dibayar) |
| GET/POST | `/api/messages/order/:orderId` | Chat per-pesanan |
| POST | `/api/reviews/order/:orderId` | Beri ulasan |
| GET | `/api/posts` | Feed sosial |
