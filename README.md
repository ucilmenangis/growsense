# GrowSense

Deteksi dini growth faltering balita untuk Posyandu dan Puskesmas. Satu repo, dua aplikasi, satu inti logika.

```
apps/pwa        PWA kader Posyandu (HP Android, offline first)
apps/web        Dashboard bidan Puskesmas (laptop)
packages/core   z-score WHO, klasifikasi Permenkes 2/2020, validasi data
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
