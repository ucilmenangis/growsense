# GrowSense

Deteksi dini growth faltering balita untuk Posyandu dan Puskesmas. Satu repo, dua aplikasi, satu inti logika.

```
apps/pwa        PWA kader Posyandu (HP Android, offline first)
apps/web        Dashboard bidan Puskesmas (laptop)
packages/core   z-score WHO, klasifikasi Permenkes 2/2020, validasi data, tipe baris data
supabase        migrasi SQL, RLS, seed, test migrasi (PGlite)
```

Kedua aplikasi memakai `@growsense/core`, jadi status gizi yang dilihat kader dan bidan selalu dihitung dengan kode yang sama.

## Mulai

```bash
npm install
npm run dev:pwa      # http://localhost:5173
npm run dev:web
npm test             # test packages/core
npm run typecheck
npm run build
```

`npm run format` merapikan kode dengan Prettier.

Service worker hanya aktif di hasil build. Untuk mencoba mode offline: `npm run build -w @growsense/pwa`, lalu `npx vite preview` di `apps/pwa`.

## packages/core

- `assess(input)` menghitung usia, koreksi posisi ukur 0,7 cm, z-score TB/U, BB/U, BB/TB, kategori, dan flag nilai tidak wajar.
- `checkAgainstPrevious(current, previous)` menandai tinggi turun dan tanggal mundur.
- Tabel LMS diambil dari paket resmi WHO anthro (lihat `data/who/SOURCE.md`). File `src/who/tables.ts` dibuat ulang dengan `npm run gen:who -w @growsense/core`.
- Metode z-score mengikuti WHO anthro, termasuk restricted z-score untuk indikator berbasis berat di luar 3 SD.

Batas toleransi tinggi turun (`HEIGHT_DROP_TOLERANCE_CM`) masih nilai awal dan perlu dikonfirmasi ke bidan.

## Layar PWA kader

| Rute | Layar | Desain Stitch |
|---|---|---|
| (terkunci) | Masuk dengan nomor HP dan kata sandi, lalu buat PIN; berikutnya cukup PIN | m07 |
| `/` | Beranda: progres timbang bulan ini, status kirim data | m01 |
| `/balita`, `/timbang` | Cari dan saring balita | m02 |
| `/balita/baru` | Daftar balita baru, wajib persetujuan orang tua | baru |
| `/balita/:id/timbang` | Form timbang 3 langkah, status dihitung langsung | m03 |
| `/balita/:id` | Status gizi, peringatan dini, kurva WHO, saran untuk ibu | m04 |
| `/pantauan` | Balita perlu dipantau, urut paling mendesak | m04 (tab) |
| `/notifikasi` | Pemberitahuan dari data di HP | m05 |
| `/profil` | Profil, rekap CSV bulanan, kunci, keluar | m06 |

Aplikasi selalu terkunci saat dibuka. Masuk pertama kali di sebuah HP memakai nomor HP dan kata sandi dari bidan, dan perlu internet. Setelah itu kader membuat PIN 6 angka yang hanya tersimpan di HP (hash PBKDF2) dan tidak pernah dikirim ke server, jadi menebak PIN dari HP curian tidak membuka akun server. Salah PIN 5 kali menghapus PIN dan meminta kata sandi lagi; data di HP tetap ada. Sinkron hanya jalan kalau sesi Supabase milik kader yang sedang membuka aplikasi.

Batasan yang perlu diketahui: data balita di IndexedDB belum dienkripsi di HP. Siapa pun yang bisa membuka profil browser HP itu bisa membaca datanya. Kalau laporan menyebut data terenkripsi, itu berlaku untuk server (Supabase) dan koneksi (HTTPS), belum untuk HP.

Tanpa `.env.local` aplikasi berjalan dalam **mode demo**: nomor HP dan kata sandi apa saja diterima, data hanya di HP, dan tombol "Isi data contoh" di Beranda membuat 8 balita dengan riwayat timbang. Nilai contoh diletakkan pada jalur z-score WHO, jadi status dan peringatannya adalah hasil hitungan core yang sebenarnya.

Peringatan dini saat ini memakai aturan sementara di `packages/core/src/warning.ts` (penurunan z-score TB/U dalam 3 bulan terakhir). Ambang batasnya perlu disepakati dengan bidan dan nanti diganti model AI.

Font Poppins dan icon (lucide) ikut di-bundle, jadi tampilan tetap utuh saat offline.

## Data dan sinkronisasi (apps/pwa/src/data)

- `db.ts`: IndexedDB lewat Dexie. Tabel `children`, `measurements`, `meta`.
- `repo.ts`: tulis data lokal. `recordMeasurement` menghitung z-score dan flag dengan core sebelum menyimpan.
- `sync.ts`: kirim perubahan lokal dulu, lalu tarik perubahan server. Id dibuat di HP (UUID), jadi data offline langsung punya id tetap. Perubahan lokal yang belum terkirim tidak ditimpa server. Tarik data memakai kursor `(updated_at, id)` dan selalu mundur 2 menit supaya transaksi yang telat commit tidak terlewat.
- `supabase.ts`: implementasi `Remote` untuk Supabase. Isi `apps/pwa/.env.local` dari `.env.example`.

## Supabase

1. Buat project di supabase.com.
2. Jalankan `supabase/migrations/*.sql` lalu `supabase/seed.sql` di SQL Editor (atau `supabase link` lalu `supabase db push` kalau memakai CLI).
3. Buat user kader dan bidan di menu Authentication, lalu isi tabel `profiles` (contoh ada di `seed.sql`). Akun kader memakai email `62<nomor HP tanpa 0>@kader.growsense.id` dan kata sandi minimal 8 karakter yang diberikan bidan ke kader, misalnya `6281234567890@kader.growsense.id`. Kata sandi ini berbeda dari PIN.

Aturan akses: kader hanya melihat Posyandu sendiri, bidan melihat semua Posyandu di Puskesmasnya. Data tidak dihapus permanen, cukup isi `deleted_at`. `npm test -w @growsense/db` menjalankan migrasi di PGlite dan menguji aturan ini.
