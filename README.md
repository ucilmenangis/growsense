# GrowSense

Deteksi dini growth faltering balita untuk Posyandu dan Puskesmas. Satu repo, dua aplikasi, satu inti logika.

```
apps/pwa        PWA kader Posyandu (HP Android, offline first)
apps/web        Dashboard bidan Puskesmas dan Pemdes/Dinkes (laptop)
packages/core   z-score WHO, klasifikasi Permenkes 2/2020, validasi data, peringatan dini, rekap bulanan, data contoh
packages/ui     komponen React bersama (kurva pertumbuhan, badge) dan token desain Stitch
supabase        migrasi SQL, RLS, seed, test migrasi (PGlite)
```

Kedua aplikasi memakai `@growsense/core`, jadi status gizi yang dilihat kader dan bidan selalu dihitung dengan kode yang sama.

## Mulai

```bash
npm install
npm run dev:pwa      # http://localhost:5173
npm run dev:web
npm test             # semua test: core, pwa, web, migrasi SQL
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

| Rute                  | Layar                                                                     | Desain Stitch |
| --------------------- | ------------------------------------------------------------------------- | ------------- |
| (terkunci)            | Masuk dengan nomor HP dan kata sandi, lalu buat PIN; berikutnya cukup PIN | m07           |
| `/`                   | Beranda: progres timbang bulan ini, status kirim data                     | m01           |
| `/balita`, `/timbang` | Cari dan saring balita                                                    | m02           |
| `/balita/baru`        | Daftar balita baru, wajib persetujuan orang tua                           | baru          |
| `/balita/:id/timbang` | Form timbang 3 langkah, status dihitung langsung                          | m03           |
| `/balita/:id`         | Status gizi, peringatan dini, kurva WHO, saran untuk ibu                  | m04           |
| `/pantauan`           | Balita perlu dipantau, urut paling mendesak                               | m04 (tab)     |
| `/notifikasi`         | Pemberitahuan dari data di HP                                             | m05           |
| `/profil`             | Profil, rekap CSV bulanan, kunci, keluar                                  | m06           |

Aplikasi selalu terkunci saat dibuka. Masuk pertama kali di sebuah HP memakai nomor HP dan kata sandi dari bidan, dan perlu internet. Setelah itu kader membuat PIN 6 angka yang hanya tersimpan di HP (hash PBKDF2) dan tidak pernah dikirim ke server, jadi menebak PIN dari HP curian tidak membuka akun server. Salah PIN 5 kali menghapus PIN dan meminta kata sandi lagi; data di HP tetap ada. Sinkron hanya jalan kalau sesi Supabase milik kader yang sedang membuka aplikasi.

Batasan yang perlu diketahui: data balita di IndexedDB belum dienkripsi di HP. Siapa pun yang bisa membuka profil browser HP itu bisa membaca datanya. Kalau laporan menyebut data terenkripsi, itu berlaku untuk server (Supabase) dan koneksi (HTTPS), belum untuk HP.

Tanpa `.env.local` aplikasi berjalan dalam **mode demo**: nomor HP dan kata sandi apa saja diterima, data hanya di HP, dan tombol "Isi data contoh" di Beranda membuat 8 balita dengan riwayat timbang. Nilai contoh diletakkan pada jalur z-score WHO, jadi status dan peringatannya adalah hasil hitungan core yang sebenarnya.

Peringatan dini saat ini memakai aturan sementara di `packages/core/src/warning.ts` (penurunan z-score TB/U dalam 3 bulan terakhir). Ambang batasnya perlu disepakati dengan bidan dan nanti diganti model AI.

Font Poppins dan icon (lucide) ikut di-bundle, jadi tampilan tetap utuh saat offline.

## Dashboard web (apps/web)

| Rute                     | Layar                                                            | Peran         | Desain Stitch |
| ------------------------ | ---------------------------------------------------------------- | ------------- | ------------- |
| (belum masuk)            | Masuk sebagai Bidan / Nakes atau Pemdes dan Dinkes               | semua         | d00           |
| `/prioritas`             | Antrean kunjungan rumah dari peringatan dini, progres timbang    | bidan         | d05           |
| `/balita`, `/balita/:id` | Daftar balita dengan filter, profil lengkap dengan kurva WHO     | bidan         | d06           |
| `/tindak-lanjut`         | Papan rujukan, intervensi, kunjungan, evaluasi, dan form catatan | bidan         | d07           |
| `/posyandu`              | Cakupan D/S per Posyandu, data tidak wajar, NIK kosong           | bidan         | d08           |
| `/ekspor`                | CSV rekap e-PPGBM dan bundle FHIR per bulan                      | bidan         | d12           |
| `/laporan`               | Laporan bulanan 15 Posyandu, siap cetak                          | bidan         | d13           |
| `/tren`                  | Tren bulanan seluruh desa                                        | bidan, pemdes | d09           |
| `/peta`                  | Peta skematis risiko per dusun                                   | bidan, pemdes | d10           |
| `/ringkasan`             | Ringkasan perencanaan Musrenbangdes, siap cetak                  | bidan, pemdes | d11           |

Tanpa `.env.local` dashboard berjalan dalam **mode demo**: NIP dan kata sandi apa saja diterima, dan data berasal dari `demoDataset()` di core (15 Posyandu, sekitar 165 balita, 12 bulan riwayat, posisi dan nama dusun karangan). Catatan tindak lanjut di mode demo disimpan di `localStorage` browser. Sesi login disimpan per tab (`sessionStorage`), jadi menutup tab di komputer Puskesmas berarti keluar.

Peringatan dini, status gizi, dan angka rekap dihitung dengan fungsi core yang sama dengan PWA (`summarize`, `monthlyStats`). Aturan rekap: sasaran adalah balita di bawah 5 tahun pada akhir bulan, status gizi dari pengukuran terakhir dalam bulan itu, nilai yang ditandai tidak wajar oleh aturan WHO tidak dihitung.

### Data untuk Pemdes dan Dinkes

Akun `pemdes` tidak bisa membaca tabel `children` maupun `measurements`. Mereka hanya mendapat angka gabungan lewat dua fungsi SQL, dan angka kecil disamarkan supaya tidak menunjuk satu keluarga:

- `village_monthly`: total seluruh desa per bulan. Hitungan kesehatan 1 atau 2 kasus disamarkan untuk semua bulan dalam triwulan yang sama. Triwulan yang masih berjalan tidak ditampilkan.
- `dusun_quarterly`: angka per dusun untuk satu triwulan yang sudah selesai, dihitung per anak per bulan. Bila satu dusun kecil, hitungan itu disamarkan untuk semua dusun.

Triwulan tidak tumpang tindih dan tidak berubah lagi, jadi dua panggilan tidak bisa dikurangkan untuk membuka angka yang disamarkan. Fungsi JS dengan aturan yang sama (`villageMonthly`, `dusunQuarter`) dipakai di mode demo, dan `supabase/test/dashboard.test.ts` memastikan hasil SQL dan JS sama persis.

Sisa risiko yang diketahui: bila kader mengoreksi data triwulan lama, orang yang menyimpan salinan angka sebelum dan sesudah koreksi bisa melihat selisihnya. Puskesmas dengan satu dusun saja tidak terlindungi oleh aturan per dusun. Jumlah sasaran dan jumlah ditimbang tidak disamarkan.

### Batasan dashboard

- Format kolom CSV e-PPGBM belum dicocokkan dengan templat impor resmi, dan bundle FHIR belum diuji ke validator SATUSEHAT. Kirim langsung ke API SATUSEHAT belum ada karena butuh izin resmi.
- Batas saran program (20% jawaban "tidak", cakupan 80%) di `apps/web/src/lib/programs.ts` adalah nilai awal yang perlu disepakati dengan bidan dan Pemdes.
- Peta adalah peta skematis dari rata-rata koordinat Posyandu (`posyandu.lat`, `posyandu.lng`), bukan peta wilayah. Koordinat asli belum dikumpulkan.
- Anggaran di ringkasan perencanaan diisi manual dan hanya tersimpan di browser.

## Data dan sinkronisasi (apps/pwa/src/data)

- `db.ts`: IndexedDB lewat Dexie. Tabel `children`, `measurements`, `meta`.
- `repo.ts`: tulis data lokal. `recordMeasurement` menghitung z-score dan flag dengan core sebelum menyimpan.
- `sync.ts`: kirim perubahan lokal dulu, lalu tarik perubahan server. Id dibuat di HP (UUID), jadi data offline langsung punya id tetap. Perubahan lokal yang belum terkirim tidak ditimpa server. Tarik data memakai kursor `(updated_at, id)` dan selalu mundur 2 menit supaya transaksi yang telat commit tidak terlewat.
- `supabase.ts`: implementasi `Remote` untuk Supabase. Isi `apps/pwa/.env.local` dari `.env.example`.

## Supabase

Project tim: `growsense` (ref `vmjncwiwijtckfdnqras`, region Singapore). Supabase CLI ikut sebagai paket npm, jadi cukup `npx supabase`.

Menyiapkan project baru dengan CLI:

```bash
npx supabase login
npx supabase projects create growsense --org-id <org> --region ap-southeast-1 --db-password <password>
npx supabase link --project-ref <ref>
npx supabase db push                          # semua migrasi, tanpa seed.sql
npx supabase projects api-keys --reveal -o json
```

Rahasia disimpan di `supabase/.secrets/` (masuk `.gitignore`, jangan pernah di-commit):

- `db.env`: `DB_PASSWORD` database.
- `service.env`: `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` (key `secret`). Key ini melewati RLS, jadi hanya untuk skrip di laptop, tidak pernah masuk aplikasi.
- `accounts.tsv`: login dan kata sandi akun tes.

`apps/pwa/.env.local` dan `apps/web/.env.local` memakai key `publishable`.

`npm run seed:demo -w @growsense/db` mengisi project dengan data contoh dashboard (`demoDataset`, tanggal relatif ke hari ini) dan membuat 4 akun tes: bidan NIP `198001012010012001`, pemdes NIP `198501012015011001`, kader `081100000001` (Posyandu 01), kader `081100000002` (Posyandu 02). Kata sandi acak ditulis ke `accounts.tsv`. Skrip boleh dijalankan ulang: baris di-upsert per id dan akun yang sudah ada tidak diubah. Untuk project kosong tanpa data contoh, jalankan `seed.sql` saja.

Cara manual lewat dashboard Supabase:

1. Buat project di supabase.com.
2. Jalankan `supabase/migrations/*.sql` lalu `supabase/seed.sql` di SQL Editor.
3. Buat user di menu Authentication, lalu isi tabel `profiles` (contoh ada di `seed.sql`).
   - Kader (`role` kader): email `62<nomor HP tanpa 0>@kader.growsense.id` dan kata sandi minimal 8 karakter yang diberikan bidan ke kader, misalnya `6281234567890@kader.growsense.id`. Kata sandi ini berbeda dari PIN.
   - Bidan (`role` bidan) dan Pemdes atau Dinkes (`role` pemdes): email `<NIP>@staf.growsense.id`, atau email biasa. Di halaman masuk dashboard cukup ketik NIP.
4. Isi `apps/web/.env.local` dengan URL dan key yang sama seperti PWA.

Aturan akses: kader hanya melihat Posyandu sendiri, bidan melihat semua Posyandu di Puskesmasnya, Pemdes hanya daftar Posyandu dan angka gabungan. Catatan tindak lanjut (`follow_ups`) hanya ditulis bidan dan bisa dibaca kader Posyandu terkait. Data tidak dihapus permanen, cukup isi `deleted_at`. `npm test -w @growsense/db` menjalankan migrasi di PGlite dan menguji aturan ini.

## Deploy

Tiap aplikasi adalah project Vercel terpisah dari repo yang sama. Root Directory: `apps/pwa` untuk PWA, `apps/web` untuk dashboard. Framework Vite, perintah build dan rewrite SPA ada di `vercel.json` masing-masing.
