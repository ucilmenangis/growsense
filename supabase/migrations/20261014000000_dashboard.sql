-- Dashboard: Pemdes and Dinkes role, follow up notes by the bidan, monthly figures without identity.

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('kader', 'bidan', 'admin', 'pemdes'));

-- Map position of the posyandu, filled in when the coordinates are collected.
alter table public.posyandu add column lat numeric(8, 5), add column lng numeric(8, 5);

create function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

-- Pemdes and Dinkes see the posyandu list of their puskesmas, never the children.
create policy "pemdes reads posyandu" on public.posyandu for select to authenticated
  using (
    public.my_role() = 'pemdes'
    and puskesmas_id in (select puskesmas_id from public.profiles where id = auth.uid())
  );

-- One row per action taken. The latest row of a child gives the current stage.
create table public.follow_ups (
  id uuid primary key,
  child_id uuid not null references public.children (id),
  stage text not null check (stage in ('rujukan', 'intervensi', 'kunjungan', 'evaluasi', 'selesai')),
  done_at date not null,
  next_at date,
  actions text[] not null default '{}',
  note text,
  recorded_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index follow_ups_child_idx on public.follow_ups (child_id, done_at);

create trigger follow_ups_stamp before insert or update on public.follow_ups
  for each row execute function public.stamp_row();

alter table public.follow_ups enable row level security;

-- Kader can read the notes for children of their posyandu; only bidan and admin write them.
create policy "read follow ups" on public.follow_ups for select to authenticated
  using (public.can_access_child(child_id));
create policy "add follow ups" on public.follow_ups for insert to authenticated
  with check (public.my_role() in ('bidan', 'admin') and public.can_access_child(child_id));
create policy "edit follow ups" on public.follow_ups for update to authenticated
  using (public.my_role() in ('bidan', 'admin') and public.can_access_child(child_id))
  with check (public.my_role() in ('bidan', 'admin') and public.can_access_child(child_id));

-- Monthly counts per posyandu of one puskesmas. Same rules as monthlyStats in
-- packages/core/src/stats.ts: children under five at the end of the month, status from the last
-- measurement of the month, implausible values left out. Internal: callers go through
-- posyandu_monthly or area_monthly, which decide the puskesmas from the caller's profile.
create function public.monthly_counts(p_puskesmas uuid, p_from date, p_to date)
returns table (
  posyandu_id uuid,
  month text,
  sasaran int,
  ditimbang int,
  stunting int,
  sangat_pendek int,
  wasting int,
  underweight int,
  asi_eksklusif_no int,
  asi_eksklusif_answered int,
  mpasi_adekuat_no int,
  mpasi_adekuat_answered int,
  imunisasi_lengkap_no int,
  imunisasi_lengkap_answered int,
  sanitasi_layak_no int,
  sanitasi_layak_answered int
)
language sql stable set search_path = public as $$
  with months as (
    select m::date as start, (m + interval '1 month' - interval '1 day')::date as finish
    from generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month') as m
    where p_to - p_from <= 800
  ),
  pos as (
    select po.id from posyandu po where po.puskesmas_id = p_puskesmas
  ),
  eligible as (
    select c.id, c.posyandu_id, mo.start
    from children c
    join pos on pos.id = c.posyandu_id
    cross join months mo
    where c.deleted_at is null and c.birth_date <= mo.finish and mo.finish - c.birth_date <= 1826
  ),
  last_of_month as (
    select distinct on (e.id, e.start) e.id, e.start, m.haz, m.waz, m.whz, m.flags, m.risk_factors
    from eligible e
    join months mo on mo.start = e.start
    join measurements m
      on m.child_id = e.id and m.deleted_at is null and m.measured_at between mo.start and mo.finish
    order by e.id, e.start, m.measured_at desc, m.id desc
  ),
  joined as (
    select e.posyandu_id, e.start, l.id is not null as measured, l.haz, l.waz, l.whz, l.flags, l.risk_factors
    from eligible e left join last_of_month l on l.id = e.id and l.start = e.start
  )
  select
    pos.id,
    to_char(mo.start, 'YYYY-MM'),
    count(j.posyandu_id)::int,
    count(*) filter (where j.measured)::int,
    count(*) filter (where j.haz < -2 and not 'haz_tidak_wajar' = any (j.flags))::int,
    count(*) filter (where j.haz < -3 and not 'haz_tidak_wajar' = any (j.flags))::int,
    count(*) filter (where j.whz < -2 and not 'whz_tidak_wajar' = any (j.flags))::int,
    count(*) filter (where j.waz < -2 and not 'waz_tidak_wajar' = any (j.flags))::int,
    count(*) filter (where j.risk_factors -> 'asi_eksklusif' = 'false'::jsonb)::int,
    count(*) filter (where jsonb_typeof(j.risk_factors -> 'asi_eksklusif') = 'boolean')::int,
    count(*) filter (where j.risk_factors -> 'mpasi_adekuat' = 'false'::jsonb)::int,
    count(*) filter (where jsonb_typeof(j.risk_factors -> 'mpasi_adekuat') = 'boolean')::int,
    count(*) filter (where j.risk_factors -> 'imunisasi_lengkap' = 'false'::jsonb)::int,
    count(*) filter (where jsonb_typeof(j.risk_factors -> 'imunisasi_lengkap') = 'boolean')::int,
    count(*) filter (where j.risk_factors -> 'sanitasi_layak' = 'false'::jsonb)::int,
    count(*) filter (where jsonb_typeof(j.risk_factors -> 'sanitasi_layak') = 'boolean')::int
  from pos
  cross join months mo
  left join joined j on j.posyandu_id = pos.id and j.start = mo.start
  group by pos.id, mo.start
  order by pos.id, mo.start
$$;

-- Per posyandu, for the bidan and admin of the puskesmas.
create function public.posyandu_monthly(p_from date, p_to date)
returns table (
  posyandu_id uuid,
  month text,
  sasaran int,
  ditimbang int,
  stunting int,
  sangat_pendek int,
  wasting int,
  underweight int,
  factors jsonb
)
language sql stable security definer set search_path = public as $$
  select
    mc.posyandu_id, mc.month, mc.sasaran, mc.ditimbang, mc.stunting, mc.sangat_pendek, mc.wasting, mc.underweight,
    jsonb_build_object(
      'asi_eksklusif', jsonb_build_object('no', mc.asi_eksklusif_no, 'answered', mc.asi_eksklusif_answered),
      'mpasi_adekuat', jsonb_build_object('no', mc.mpasi_adekuat_no, 'answered', mc.mpasi_adekuat_answered),
      'imunisasi_lengkap', jsonb_build_object('no', mc.imunisasi_lengkap_no, 'answered', mc.imunisasi_lengkap_answered),
      'sanitasi_layak', jsonb_build_object('no', mc.sanitasi_layak_no, 'answered', mc.sanitasi_layak_answered)
    )
  from public.monthly_counts(
    (select puskesmas_id from profiles where id = auth.uid() and role in ('bidan', 'admin')), p_from, p_to
  ) mc
$$;

-- Per dusun (area null = whole puskesmas), for Pemdes and Dinkes as well as the bidan.
-- Health counts of 1 or 2 are hidden. When any dusun is hidden for a count in a month, that count
-- is hidden for every dusun in the month, so the village total minus the other dusun cannot give
-- a hidden value back. With p_by_month false the months are added up into one row per dusun
-- (month = 'periode', counted in child months), which hides far fewer values. Same rules as
-- areaStats in packages/core/src/stats.ts.
create function public.area_monthly(p_from date, p_to date, p_by_month boolean default true)
returns table (
  area text,
  month text,
  sasaran int,
  ditimbang int,
  stunting int,
  sangat_pendek int,
  wasting int,
  underweight int,
  factors jsonb
)
language sql stable security definer set search_path = public as $$
  with counts as (
    select mc.*, coalesce(po.dusun, po.name) as area_name,
      case when p_by_month then mc.month else 'periode' end as period
    from public.monthly_counts(
      (select puskesmas_id from profiles where id = auth.uid() and role in ('bidan', 'admin', 'pemdes')), p_from, p_to
    ) mc
    join posyandu po on po.id = mc.posyandu_id
  ),
  grouped as (
    select
      case when grouping(area_name) = 1 then null else area_name end as area,
      period as month,
      sum(sasaran)::int as sasaran,
      sum(ditimbang)::int as ditimbang,
      sum(stunting)::int as stunting,
      sum(sangat_pendek)::int as sangat_pendek,
      sum(wasting)::int as wasting,
      sum(underweight)::int as underweight,
      sum(asi_eksklusif_no)::int as asi_eksklusif,
      sum(asi_eksklusif_answered)::int as asi_eksklusif_answered,
      sum(mpasi_adekuat_no)::int as mpasi_adekuat,
      sum(mpasi_adekuat_answered)::int as mpasi_adekuat_answered,
      sum(imunisasi_lengkap_no)::int as imunisasi_lengkap,
      sum(imunisasi_lengkap_answered)::int as imunisasi_lengkap_answered,
      sum(sanitasi_layak_no)::int as sanitasi_layak,
      sum(sanitasi_layak_answered)::int as sanitasi_layak_answered
    from counts
    group by grouping sets ((area_name, period), (period))
  ),
  long as (
    select g.area, g.month, v.measure, v.value, v.value between 1 and 2 as small
    from grouped g
    cross join lateral (
      values
        ('stunting', g.stunting), ('sangat_pendek', g.sangat_pendek), ('wasting', g.wasting),
        ('underweight', g.underweight), ('asi_eksklusif', g.asi_eksklusif), ('mpasi_adekuat', g.mpasi_adekuat),
        ('imunisasi_lengkap', g.imunisasi_lengkap), ('sanitasi_layak', g.sanitasi_layak)
    ) as v (measure, value)
  ),
  ranked as (
    select l.*,
      count(*) filter (where l.small) over (partition by l.month, l.measure, l.area is null) as small_count
    from long l
  ),
  hidden as (
    select area, month, measure,
      case
        when small then null
        when area is not null and small_count > 0 then null
        else value
      end as value
    from ranked
  ),
  wide as (
    select area, month,
      max(value) filter (where measure = 'stunting') as stunting,
      max(value) filter (where measure = 'sangat_pendek') as sangat_pendek,
      max(value) filter (where measure = 'wasting') as wasting,
      max(value) filter (where measure = 'underweight') as underweight,
      max(value) filter (where measure = 'asi_eksklusif') as asi_eksklusif,
      max(value) filter (where measure = 'mpasi_adekuat') as mpasi_adekuat,
      max(value) filter (where measure = 'imunisasi_lengkap') as imunisasi_lengkap,
      max(value) filter (where measure = 'sanitasi_layak') as sanitasi_layak
    from hidden
    group by area, month
  )
  select
    g.area, g.month, g.sasaran, g.ditimbang, w.stunting, w.sangat_pendek, w.wasting, w.underweight,
    jsonb_build_object(
      'asi_eksklusif', jsonb_build_object('no', w.asi_eksklusif, 'answered', g.asi_eksklusif_answered),
      'mpasi_adekuat', jsonb_build_object('no', w.mpasi_adekuat, 'answered', g.mpasi_adekuat_answered),
      'imunisasi_lengkap', jsonb_build_object('no', w.imunisasi_lengkap, 'answered', g.imunisasi_lengkap_answered),
      'sanitasi_layak', jsonb_build_object('no', w.sanitasi_layak, 'answered', g.sanitasi_layak_answered)
    )
  from grouped g
  join wide w on w.area is not distinct from g.area and w.month = g.month
  order by g.area collate "C" nulls first, g.month
$$;

-- Supabase grants new functions to anon and authenticated by default; open only what the
-- dashboard calls, and only to signed in users.
revoke execute on function public.monthly_counts(uuid, date, date) from public, anon, authenticated;
revoke execute on function public.posyandu_monthly(date, date) from public, anon;
revoke execute on function public.area_monthly(date, date, boolean) from public, anon;
revoke execute on function public.my_role() from public, anon;
grant execute on function public.posyandu_monthly(date, date) to authenticated;
grant execute on function public.area_monthly(date, date, boolean) to authenticated;
grant execute on function public.my_role() to authenticated;
