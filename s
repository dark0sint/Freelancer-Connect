# Salin file ini menjadi ".env" lalu sesuaikan nilainya sebelum menjalankan server

# Port server berjalan
PORT=3000

# Kunci rahasia untuk menandatangani JWT (WAJIB diganti di produksi!)
JWT_SECRET=ganti-dengan-string-acak-yang-sangat-rahasia

# Berapa lama sesi login bertahan
JWT_EXPIRES_IN=7d

# Persentase komisi platform dari setiap transaksi yang selesai (contoh: 0.1 = 10%)
PLATFORM_FEE_PERCENT=0.1

# --- Catatan integrasi pembayaran ---
# Modul escrow di app ini adalah SIMULASI alur kerja (menahan & mencairkan status dana).
# Untuk memproses uang sungguhan, hubungkan payment gateway berlisensi di
# src/routes/orders.js (lihat komentar "INTEGRASI PEMBAYARAN"), misalnya:
# Midtrans, Xendit, atau payment gateway lain yang mendukung escrow/virtual account.
