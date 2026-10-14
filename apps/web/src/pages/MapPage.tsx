// d10: risk per dusun on a schematic map. Dusun are placed at the average position of their
// posyandu; without coordinates they are laid out in a row.
import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { num, type AreaStat } from '@growsense/core'
import { useStore } from '../data/store'
import { Card, CardTitle, Note, PageHeader, Select, Td, Th } from '../components/ui'
import { HIDDEN, INDICATORS, indicatorValue, quarterLabel, type Indicator } from '../lib/area'

const W = 720
const H = 420

function tone(v: number | null, good: boolean | undefined) {
  if (v === null) return '#bfc7d2'
  const bad = good ? 1 - v : v
  if (good) return bad > 0.2 ? '#ba1a1a' : bad > 0.1 ? '#c77700' : '#1b6b3a'
  return bad >= 0.2 ? '#ba1a1a' : bad >= 0.1 ? '#c77700' : '#1b6b3a'
}

export function MapPage() {
  const { data, session } = useStore()
  const [indicator, setIndicator] = useState<Indicator>('stunting')
  const meta = INDICATORS.find((i) => i.value === indicator)!
  const dusun = data.dusun.filter((a): a is AreaStat & { area: string } => a.area !== null)
  const total = data.dusun.find((a) => a.area === null)

  // Average posyandu position per dusun.
  const pos = new Map<string, { lat: number; lng: number; n: number; posyandu: string[] }>()
  for (const p of data.posyandu) {
    const key = p.dusun ?? p.name
    const cur = pos.get(key) ?? { lat: 0, lng: 0, n: 0, posyandu: [] }
    cur.posyandu.push(p.name)
    if (p.lat !== null && p.lng !== null) {
      cur.lat += Number(p.lat)
      cur.lng += Number(p.lng)
      cur.n++
    }
    pos.set(key, cur)
  }
  const placed = dusun.map((d, i) => {
    const p = pos.get(d.area)
    return { d, lat: p?.n ? p.lat / p.n : null, lng: p?.n ? p.lng / p.n : null, i, posyandu: p?.posyandu ?? [] }
  })
  const withCoords = placed.filter((p) => p.lat !== null)
  const lats = withCoords.map((p) => p.lat!)
  const lngs = withCoords.map((p) => p.lng!)
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)]
  const xy = (p: (typeof placed)[number]) =>
    p.lat === null || withCoords.length < 2
      ? { x: ((p.i + 0.5) / placed.length) * W, y: H / 2 }
      : {
          x: 90 + ((p.lng! - minLng) / (maxLng - minLng || 1)) * (W - 180),
          y: 80 + (1 - (p.lat! - minLat) / (maxLat - minLat || 1)) * (H - 160),
        }
  const maxS = Math.max(1, ...dusun.map((d) => d.sasaran))
  const ranked = [...placed].sort(
    (a, b) => (indicatorValue(b.d, indicator) ?? -1) - (indicatorValue(a.d, indicator) ?? -1),
  )
  const fmt = (v: number | null) => (v === null ? HIDDEN : `${num(v * 100)}%`)

  return (
    <>
      <PageHeader
        eyebrow="Tampilan Pemdes dan Dinkes"
        title="Peta sebaran risiko per dusun"
        description={`Angka gabungan per dusun tanpa identitas balita untuk menentukan lokasi intervensi prioritas. Periode ${quarterLabel(data.quarter, true)}.`}
        actions={
          <Select<Indicator>
            label="Lapisan peta"
            value={indicator}
            onChange={setIndicator}
            options={INDICATORS.map((i) => ({ value: i.value, label: i.label }))}
          />
        }
      />
      <div className="mb-6 grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardTitle
            icon={<MapPin size={18} />}
            title={meta.label}
            subtitle={`Ukuran lingkaran: jumlah balita. Warna: ${meta.good ? 'hijau di atas 90%, kuning 80 sampai 90%, merah di bawah 80%' : 'hijau di bawah 10%, kuning 10 sampai 20%, merah 20% ke atas'}.`}
          />
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full rounded-xl bg-[#eef3fb]"
            role="img"
            aria-label={`Peta ${meta.label} per dusun`}
          >
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M40 0H0V40" fill="none" stroke="#dde5f5" />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="url(#grid)" />
            {placed.map((p) => {
              const { x, y } = xy(p)
              const v = indicatorValue(p.d, indicator)
              const r = 22 + 26 * Math.sqrt(p.d.sasaran / maxS)
              return (
                <g key={p.d.area}>
                  <circle
                    cx={x}
                    cy={y}
                    r={r}
                    fill={tone(v, meta.good)}
                    fillOpacity="0.22"
                    stroke={tone(v, meta.good)}
                    strokeWidth="2"
                  />
                  <circle cx={x} cy={y} r="5" fill={tone(v, meta.good)} />
                  <text x={x} y={y - r - 8} textAnchor="middle" fontSize="13" fontWeight="600" fill="#131b2e">
                    {p.d.area}
                  </text>
                  <text x={x} y={y + 22} textAnchor="middle" fontSize="12" fontWeight="700" fill={tone(v, meta.good)}>
                    {fmt(v)}
                  </text>
                </g>
              )
            })}
          </svg>
          <p className="mt-2 text-xs text-on-surface-variant">
            {session.demo
              ? 'Posisi dusun pada data contoh adalah karangan, bukan koordinat asli.'
              : withCoords.length < 2
                ? 'Koordinat Posyandu belum diisi, dusun ditampilkan berjajar.'
                : 'Posisi dari rata-rata koordinat Posyandu di tiap dusun. Peta skematis, bukan peta wilayah.'}
          </p>
        </Card>
        <Card className="lg:col-span-4">
          <CardTitle
            title="Urutan prioritas"
            subtitle={meta.good ? 'Cakupan terendah di atas' : 'Angka tertinggi di atas'}
          />
          <ol className="space-y-2">
            {(meta.good ? [...ranked].reverse() : ranked).map((p, i) => {
              const v = indicatorValue(p.d, indicator)
              return (
                <li key={p.d.area} className="flex items-center gap-3 rounded-xl bg-surface-low p-3">
                  <span className="w-5 text-sm font-bold text-on-surface-variant">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{p.d.area}</span>
                    <span className="block truncate text-xs text-on-surface-variant">{p.posyandu.join(', ')}</span>
                  </span>
                  <span className="text-sm font-bold" style={{ color: tone(v, meta.good) }}>
                    {fmt(v)}
                  </span>
                </li>
              )
            })}
          </ol>
          {total && (
            <p className="mt-3 text-sm text-on-surface-variant">
              Seluruh desa:{' '}
              <span className="font-semibold text-on-surface">{fmt(indicatorValue(total, indicator))}</span>
            </p>
          )}
        </Card>
      </div>

      <Card className="mb-6">
        <CardTitle
          title="Angka per dusun"
          subtitle={`${quarterLabel(data.quarter, true)}, dihitung per anak per bulan`}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-surface-high">
              <tr>
                <Th>Dusun</Th>
                <Th className="text-right">Anak bulan sasaran</Th>
                <Th className="text-right">Ditimbang</Th>
                {INDICATORS.filter((i) => i.value !== 'cakupan').map((i) => (
                  <Th key={i.value} className="text-right">
                    {i.label}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...dusun, ...(total ? [total] : [])].map((d) => (
                <tr
                  key={d.area ?? 'total'}
                  className={`border-b border-surface-low ${d.area === null ? 'bg-surface-low font-semibold' : ''}`}
                >
                  <Td>{d.area ?? 'Seluruh desa'}</Td>
                  <Td className="text-right">{d.sasaran}</Td>
                  <Td className="text-right">{d.ditimbang}</Td>
                  {INDICATORS.filter((i) => i.value !== 'cakupan').map((i) => (
                    <Td key={i.value} className="text-right">
                      {fmt(indicatorValue(d, i.value))}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Note label="Cara membaca">
        Satu balita yang ditimbang tiap bulan dihitung tiga kali dalam satu triwulan. Angka kecil (1 atau 2 kasus)
        disamarkan untuk semua dusun sekaligus, supaya tidak bisa ditebak keluarga mana.
      </Note>
    </>
  )
}
