// d07: follow up board and the note form. Each note moves the case to its stage.
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CheckCircle2, ClipboardList, NotebookPen } from 'lucide-react'
import {
  ageLabel,
  byPriority,
  dateLabel,
  FOLLOW_UP_ACTIONS,
  shiftMonths,
  zLabel,
  type FollowUpStage,
} from '@growsense/core'
import { RiskBadge } from '@growsense/ui'
import { useStore } from '../data/store'
import { Badge, Button, Card, CardTitle, inputClass, Kpi, PageHeader } from '../components/ui'
import { cases, COLUMNS, STAGE_LABEL, type Case } from '../lib/followUp'

const STAGES: FollowUpStage[] = ['rujukan', 'intervensi', 'kunjungan', 'evaluasi', 'selesai']

function CaseCard({ c, onPick, active }: { c: Case; onPick: () => void; active: boolean }) {
  const { data, posyanduById } = useStore()
  const s = c.summary
  return (
    <button
      type="button"
      onClick={onPick}
      className={`w-full rounded-xl bg-surface-lowest p-3 text-left shadow-card transition hover:ring-2 hover:ring-primary/30 ${
        active ? 'ring-2 ring-primary' : ''
      }`}
    >
      <p className="text-sm font-semibold">{s.child.full_name}</p>
      <div className="my-1">
        <RiskBadge level={s.warning.level} />
      </div>
      <p className="text-xs text-on-surface-variant">
        {ageLabel(s.child.birth_date, data.today)} · {posyanduById.get(s.child.posyandu_id)?.name}
        {s.latest?.haz != null && ` · TB/U ${zLabel(s.latest.haz)}`}
      </p>
      {c.latest && c.column !== 'perlu' ? (
        <p className="mt-1.5 line-clamp-2 text-xs">{c.latest.note ?? c.latest.actions.join(', ')}</p>
      ) : (
        <p className="mt-1.5 line-clamp-2 text-xs text-on-surface-variant">{s.warning.reasons[0]}</p>
      )}
      {c.latest?.next_at && c.column !== 'perlu' && (
        <p
          className={`mt-1 text-[11px] font-semibold ${c.latest.next_at < data.today ? 'text-danger' : 'text-primary'}`}
        >
          {c.latest.next_at < data.today ? 'Terlambat, ' : ''}cek {dateLabel(c.latest.next_at)}
        </p>
      )}
    </button>
  )
}

export function FollowUps() {
  const { summaries, followUpsByChild, addFollowUp, data } = useStore()
  const [params, setParams] = useSearchParams()
  const board = useMemo(() => cases(summaries, followUpsByChild), [summaries, followUpsByChild])
  const childId = params.get('anak') ?? ''
  const formRef = useRef<HTMLFormElement>(null)

  const picked = summaries.find((s) => s.child.id === childId)
  const current = followUpsByChild.get(childId)?.at(-1)
  const nextStage: FollowUpStage =
    !current || current.stage === 'selesai' ? 'rujukan' : STAGES[Math.min(STAGES.indexOf(current.stage) + 1, 4)]!

  const [stage, setStage] = useState<FollowUpStage>(nextStage)
  const [doneAt, setDoneAt] = useState(data.today)
  const [nextAt, setNextAt] = useState(shiftMonths(data.today, 1))
  const [actions, setActions] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setStage(nextStage)
    setActions([])
    setNote('')
    setError('')
    // Only when another child is picked.
  }, [childId])

  const pick = (id: string) => {
    setParams({ anak: id })
    setSaved('')
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!picked) return
    setBusy(true)
    setError('')
    try {
      await addFollowUp({
        child_id: picked.child.id,
        stage,
        done_at: doneAt,
        next_at: stage === 'selesai' || !nextAt ? null : nextAt,
        actions,
        note: note.trim() || null,
      })
      setSaved(`Catatan ${STAGE_LABEL[stage].toLowerCase()} untuk ${picked.child.full_name} tersimpan.`)
      setNote('')
      setActions([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setBusy(false)
    }
  }

  const count = (key: string) => board.filter((c) => c.column === key).length
  const late = board.filter((c) => c.column !== 'perlu' && c.latest?.next_at && c.latest.next_at < data.today).length
  const candidates = byPriority(summaries)

  return (
    <>
      <PageHeader
        eyebrow="Koordinasi intervensi"
        title="Catatan tindak lanjut dan alur rujukan"
        description="Bidan mencatat rujukan, intervensi, kunjungan rumah, dan evaluasi. Catatan tersimpan sebagai riwayat balita dan bisa dibaca kader Posyandunya."
      />
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Belum ditindaklanjuti" value={count('perlu')} tone="danger" note="Peringatan tanpa catatan bidan" />
        <Kpi label="Kasus berjalan" value={board.length - count('perlu')} note="Rujukan sampai evaluasi" />
        <Kpi label="Jadwal cek terlambat" value={late} tone={late ? 'warn' : 'ok'} note="Tanggal cek sudah lewat" />
        <Kpi
          label="Kasus selesai"
          value={[...followUpsByChild.values()].filter((n) => n.at(-1)?.stage === 'selesai').length}
          tone="ok"
          note="Ditutup bidan"
        />
      </div>

      <div className="mb-6 flex gap-4 overflow-x-auto pb-2">
        {COLUMNS.map((col) => {
          const items = board.filter((c) => c.column === col.key)
          return (
            <section key={col.key} className="w-72 shrink-0 rounded-xl bg-surface-low p-3">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">{col.title}</h2>
                  <p className="text-[11px] text-on-surface-variant">{col.hint}</p>
                </div>
                <Badge className="bg-surface-container text-primary">{items.length}</Badge>
              </div>
              <div className="max-h-[480px] space-y-2 overflow-y-auto">
                {byPriority(items.map((c) => c.summary)).map((s) => {
                  const c = items.find((x) => x.summary === s)!
                  return (
                    <CaseCard key={s.child.id} c={c} active={s.child.id === childId} onPick={() => pick(s.child.id)} />
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      <Card>
        <form ref={formRef} onSubmit={submit} className="scroll-mt-24">
          <CardTitle
            icon={<NotebookPen size={18} />}
            title="Form catatan tindak lanjut"
            subtitle="Pilih balita dari papan di atas atau dari daftar"
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <label className="flex flex-col gap-1 text-xs font-medium text-on-surface-variant">
                Balita
                <select className={inputClass} value={childId} onChange={(e) => pick(e.target.value)} required>
                  <option value="">Pilih balita</option>
                  {candidates.map((s) => (
                    <option key={s.child.id} value={s.child.id}>
                      {s.child.full_name} ({ageLabel(s.child.birth_date, data.today)})
                    </option>
                  ))}
                </select>
              </label>
              {picked && (
                <div className="rounded-xl bg-surface-low p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/balita/${picked.child.id}`} className="font-semibold text-primary">
                      {picked.child.full_name}
                    </Link>
                    <RiskBadge level={picked.warning.level} />
                  </div>
                  <p className="text-on-surface-variant">
                    Tahap sekarang: {current ? STAGE_LABEL[current.stage] : 'belum ada catatan'}
                  </p>
                  {picked.warning.reasons.length > 0 && (
                    <ul className="mt-1 list-inside list-disc text-on-surface-variant">
                      {picked.warning.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div role="group" aria-label="Tahap" className="space-y-1">
                <p className="text-xs font-medium text-on-surface-variant">Tahap</p>
                <div className="flex flex-wrap gap-2">
                  {STAGES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={stage === s}
                      onClick={() => {
                        setStage(s)
                        setActions([])
                      }}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                        stage === s ? 'bg-primary text-on-primary' : 'bg-surface-low text-on-surface-variant'
                      }`}
                    >
                      {STAGE_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-on-surface-variant">
                  Tanggal tindakan
                  <input
                    type="date"
                    className={inputClass}
                    value={doneAt}
                    max={data.today}
                    onChange={(e) => setDoneAt(e.target.value)}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-on-surface-variant">
                  Cek berikutnya
                  <input
                    type="date"
                    className={inputClass}
                    value={stage === 'selesai' ? '' : nextAt}
                    min={doneAt}
                    disabled={stage === 'selesai'}
                    onChange={(e) => setNextAt(e.target.value)}
                  />
                </label>
              </div>
            </div>
            <div className="space-y-4">
              <fieldset>
                <legend className="mb-1 text-xs font-medium text-on-surface-variant">Tindakan</legend>
                <div className="space-y-2">
                  {FOLLOW_UP_ACTIONS[stage].map((a) => (
                    <label key={a} className="flex items-center gap-2.5 rounded-xl bg-surface-low px-3 py-2.5 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-[#006194]"
                        checked={actions.includes(a)}
                        onChange={(e) =>
                          setActions((list) => (e.target.checked ? [...list, a] : list.filter((x) => x !== a)))
                        }
                      />
                      {a}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex flex-col gap-1 text-xs font-medium text-on-surface-variant">
                Catatan
                <textarea
                  className={`${inputClass} h-28 py-2`}
                  value={note}
                  maxLength={1000}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Hasil pemeriksaan, kesepakatan dengan ibu dan kader"
                />
              </label>
            </div>
          </div>
          {error && <p className="mt-4 rounded-xl bg-danger-container px-4 py-3 text-sm text-danger">{error}</p>}
          {saved && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-ok-container px-4 py-3 text-sm text-ok">
              <CheckCircle2 size={16} /> {saved}
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={!picked || busy}>
              <ClipboardList size={16} /> {busy ? 'Menyimpan...' : 'Simpan catatan'}
            </Button>
          </div>
        </form>
      </Card>
    </>
  )
}
