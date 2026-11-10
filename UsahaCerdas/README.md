# UsahaCerdas

Aplikasi kasir (POS) dan manajemen keuangan untuk UMKM.
Frontend HTML, CSS, dan JavaScript; backend Node.js; database PostgreSQL.

## Yang perlu di-install

- [Node.js](https://nodejs.org) versi 22 atau lebih baru
- [PostgreSQL](https://www.postgresql.org/download/) versi 17

## Cara menjalankan

1. Buat database kosong bernama `usahacerdas`, lalu jalankan isi `database/schema.sql` di database itu.
2. Salin `.env.example` menjadi `.env`, lalu isi kata sandi PostgreSQL kamu.
3. Buka terminal di folder ini, lalu jalankan:

   ```
   npm.cmd install
   npm.cmd start
   ```

4. Buka `http://localhost:3000`. Saat pertama dibuka, buat akun Pemilik.

Data contoh (opsional, hanya untuk database yang masih kosong):

```
npm.cmd run demo
```

Agar bisa dibuka dari HP di Wi-Fi yang sama: `npm.cmd run start:wifi`.
