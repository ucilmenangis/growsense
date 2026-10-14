// d06: every child with filters; a row opens the full profile.
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Users } from 'lucide-react'
import {
  ageLabel,
  classifyHeightForAge,
  classifyWeightForHeight,
  dateLabel,
  levelTone,
  zLabel,
  type ChildSummary,
  type RiskLevel,
} from '@growsense/core'
import { Avatar, RiskBadge } from '@growsense/ui'
import { useStore } from '../data/store'
import { Badge, Card, CardTitle, Empty, inputClass, PageHeader, Select, Td, Th } from '../components/ui'

type Status = 'semua' | RiskLevel | 'belum' | 'pendek' | 'kurang_data'
const PAGE = 25

function matches(s: ChildSummary, q: string) {
  if (!q) return true
  const text = `${s.child.full_name} ${s.child.mother_name ?? ''} ${s.child.nik ?? ''}`.toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => text.includes(w))
}

export function Children() {
  const { summaries, data, posyanduById } = useStore()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [posyandu, setPosyandu] = useState('semua')
  const [status, setStatus] = useState<Status>('semua')
  const [page, setPage] = useState(0)

  const list = useMemo(
    () =>
      summaries.filter(
        (s) =>
          matches(s, q) &&
          (posyandu === 'semua' || s.child.posyandu_id === posyandu) &&
          (status === 'semua' ||
            (status === 'belum' && !s.measuredThisMonth) ||
            (status === 'pendek' && s.latest?.haz != null && s.latest.haz < -2) ||
            (status === 'kurang_data' && (!s.child.nik || !s.child.consent_at)) ||
            s.warning.level === status),
      ),
    [summaries, q, posyandu, status],
  )
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const shown = list.slice(page * PAGE, page * PAGE + PAGE)

  return (
    <>
      <PageHeader
        eyebrow="Manajemen data balita"
        title="Profil balita lengkap"
        description="Riwayat pengukuran, status gizi, faktor risiko, dan catatan tindak lanjut tiap balita di semua Posyandu wilayah Puskesmas."
      />
      <Card>
        <CardTitle
          icon={<Users size={18} />}
          title={`${list.length} balita`}
          subtitle="Klik baris untuk membuka profil"
        />
        <div className="mb-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
          <label className="flex flex-col gap-1 text-xs font-medium text-on-surface-variant">
            Cari
            <input
              className={inputClass}
              placeholder="Nama balita, nama ibu, atau NIK"
              value={q}
              onChange={(e) => {
                setPage(0)
                setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })
              }}
            />
          </label>
          <Select
            label="Posyandu"
            value={posyandu}
            onChange={(v) => {
              setPage(0)
              setPosyandu(v)
            }}
            options={[
              { value: 'semua', label: 'Semua Posyandu' },
              ...data.posyandu.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
          <Select<Status>
            label="Status"
            value={status}
            onChange={(v) => {
              setPage(0)
              setStatus(v)
            }}
            options={[
              { value: 'semua', label: 'Semua status' },
              { value: 'tinggi', label: 'Perlu kunjungan' },
              { value: 'sedang', label: 'Perlu dipantau' },
              { value: 'rendah', label: 'Tumbuh baik' },
              { value: 'pendek', label: 'Pendek atau sangat pendek' },
              { value: 'belum', label: 'Belum ditimbang bulan ini' },
              { value: 'kurang_data', label: 'NIK atau persetujuan kosong' },
            ]}
          />
        </div>

        {list.length === 0 ? (
          <Empty>Tidak ada balita yang cocok dengan pencarian.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="border-b border-surface-high">
                <tr>
                  <Th>Balita</Th>
                  <Th>Posyandu</Th>
                  <Th>Umur</Th>
                  <Th>TB/U</Th>
                  <Th>BB/TB</Th>
                  <Th>Peringatan</Th>
                  <Th>Timbang terakhir</Th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => {
                  const m = s.latest
                  const p = posyanduById.get(s.child.posyandu_id)
                  return (
                    <tr key={s.child.id} className="border-b border-surface-low hover:bg-surface-low">
                      <Td>
                        <Link to={`/balita/${s.child.id}`} className="flex items-center gap-3">
                          <Avatar name={s.child.full_name} sex={s.child.sex} />
                          <span>
                            <span className="block font-semibold text-primary">{s.child.full_name}</span>
                            <span className="text-xs text-on-surface-variant">
                              Ibu {s.child.mother_name ?? 'belum diisi'}
                              {!s.child.nik && ' · NIK kosong'}
                            </span>
                          </span>
                        </Link>
                      </Td>
                      <Td>
                        {p?.name}
                        <span className="block text-xs text-on-surface-variant">{p?.dusun}</span>
                      </Td>
                      <Td>{ageLabel(s.child.birth_date, data.today)}</Td>
                      <Td>
                        {m?.haz != null ? (
                          <>
                            <span className="font-semibold">{zLabel(m.haz)}</span>
                            <Badge className={`mt-1 flex w-fit ${levelTone[classifyHeightForAge(m.haz).level]}`}>
                              {classifyHeightForAge(m.haz).label}
                            </Badge>
                          </>
                        ) : (
                          '?'
                        )}
                      </Td>
                      <Td>
                        {m?.whz != null ? (
                          <>
                            <span className="font-semibold">{zLabel(m.whz)}</span>
                            <Badge className={`mt-1 flex w-fit ${levelTone[classifyWeightForHeight(m.whz).level]}`}>
                              {classifyWeightForHeight(m.whz).label}
                            </Badge>
                          </>
                        ) : (
                          '?'
                        )}
                      </Td>
                      <Td>
                        <RiskBadge level={s.warning.level} />
                      </Td>
                      <Td>
                        {m ? dateLabel(m.measured_at) : 'Belum pernah'}
                        {!s.measuredThisMonth && (
                          <span className="block text-xs text-warn">Belum ditimbang bulan ini</span>
                        )}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-on-surface-variant">
              Menampilkan {page * PAGE + 1} sampai {Math.min(list.length, page * PAGE + PAGE)} dari {list.length}
            </span>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: pages }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i)}
                  aria-current={i === page}
                  className={`size-9 rounded-lg font-semibold ${
                    i === page ? 'bg-primary text-on-primary' : 'text-primary hover:bg-surface-low'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>
    </>
  )
}
