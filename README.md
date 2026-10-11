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

Service worker hanya aktif di hasil build. Untuk mencoba mode offline: `npm run build -w @growsense/pwa`, lalu `npx vite preview` di `apps/pwa`.

## packages/core

- `assess(input)` menghitung usia, koreksi posisi ukur 0,7 cm, z-score TB/U, BB/U, BB/TB, kategori, dan flag nilai tidak wajar.
- `checkAgainstPrevious(current, previous)` menandai tinggi turun dan tanggal mundur.
- Tabel LMS diambil dari paket resmi WHO anthro (lihat `data/who/SOURCE.md`). File `src/who/tables.ts` dibuat ulang dengan `npm run gen:who -w @growsense/core`.
- Metode z-score mengikuti WHO anthro, termasuk restricted z-score untuk indikator berbasis berat di luar 3 SD.

Batas toleransi tinggi turun (`HEIGHT_DROP_TOLERANCE_CM`) masih nilai awal dan perlu dikonfirmasi ke bidan.

## Data dan sinkronisasi (apps/pwa/src/data)

- `db.ts`: IndexedDB lewat Dexie. Tabel `children`, `measurements`, `meta`.
- `repo.ts`: tulis data lokal. `recordMeasurement` menghitung z-score dan flag dengan core sebelum menyimpan.
- `sync.ts`: kirim perubahan lokal dulu, lalu tarik perubahan server. Id dibuat di HP (UUID), jadi data offline langsung punya id tetap. Perubahan lokal yang belum terkirim tidak ditimpa server. Tarik data memakai kursor `(updated_at, id)` dan selalu mundur 2 menit supaya transaksi yang telat commit tidak terlewat.
- `supabase.ts`: implementasi `Remote` untuk Supabase. Isi `apps/pwa/.env.local` dari `.env.example`.

## Supabase

1. Buat project di supabase.com.
2. Jalankan `supabase/migrations/*.sql` lalu `supabase/seed.sql` di SQL Editor (atau `supabase link` lalu `supabase db push` kalau memakai CLI).
3. Buat user kader dan bidan di menu Authentication, lalu isi tabel `profiles` (contoh ada di `seed.sql`).

Aturan akses: kader hanya melihat Posyandu sendiri, bidan melihat semua Posyandu di Puskesmasnya. Data tidak dihapus permanen, cukup isi `deleted_at`. `npm test -w @growsense/db` menjalankan migrasi di PGlite dan menguji aturan ini.
