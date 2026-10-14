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

-- Monthly figures per posyandu for the caller's puskesmas, counts only. Same rules as
-- monthlyStats in packages/core/src/stats.ts: children under five at the end of the month,
-- status from the last measurement of the month, implausible values left out.
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
  with me as (
    select puskesmas_id from profiles where id = auth.uid() and role in ('bidan', 'admin', 'pemdes')
  ),
  months as (
    select m::date as start, (m + interval '1 month' - interval '1 day')::date as finish
    from generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month') as m
    where p_to - p_from <= 800
  ),
  pos as (
    select po.id from posyandu po join me on me.puskesmas_id = po.puskesmas_id
  ),
  eligible as (
    select c.id, c.posyandu_id, mo.start, mo.finish
    from children c
    join pos on pos.id = c.posyandu_id
    cross join months mo
    where c.deleted_at is null and c.birth_date <= mo.finish and mo.finish - c.birth_date <= 1826
  ),
  last_of_month as (
    select distinct on (e.id, e.start) e.id, e.start, m.haz, m.waz, m.whz, m.flags, m.risk_factors
    from eligible e
    join measurements m
      on m.child_id = e.id and m.deleted_at is null and m.measured_at between e.start and e.finish
    order by e.id, e.start, m.measured_at desc, m.id desc
  ),
  joined as (
    select e.posyandu_id, e.start, l.id is not null as measured, l.haz, l.waz, l.whz, l.flags, l.risk_factors
    from eligible e left join last_of_month l on l.id = e.id and l.start = e.start
  ),
  factor_keys as (
    select unnest(array['asi_eksklusif', 'mpasi_adekuat', 'imunisasi_lengkap', 'sanitasi_layak']) as k
  ),
  factor_counts as (
    select j.posyandu_id, j.start, fk.k,
      count(*) filter (where jsonb_typeof(j.risk_factors -> fk.k) = 'boolean')::int as answered,
      count(*) filter (where j.risk_factors -> fk.k = 'false'::jsonb)::int as no
    from joined j cross join factor_keys fk
    where j.measured
    group by j.posyandu_id, j.start, fk.k
  ),
  grid as (
    select pos.id as posyandu_id, mo.start from pos cross join months mo
  )
  select
    g.posyandu_id,
    to_char(g.start, 'YYYY-MM'),
    count(j.posyandu_id)::int,
    count(*) filter (where j.measured)::int,
    count(*) filter (where j.haz < -2 and not 'haz_tidak_wajar' = any (j.flags))::int,
    count(*) filter (where j.haz < -3 and not 'haz_tidak_wajar' = any (j.flags))::int,
    count(*) filter (where j.whz < -2 and not 'whz_tidak_wajar' = any (j.flags))::int,
    count(*) filter (where j.waz < -2 and not 'waz_tidak_wajar' = any (j.flags))::int,
    coalesce(
      (select jsonb_object_agg(fc.k, jsonb_build_object('no', fc.no, 'answered', fc.answered))
       from factor_counts fc where fc.posyandu_id = g.posyandu_id and fc.start = g.start),
      (select jsonb_object_agg(k, jsonb_build_object('no', 0, 'answered', 0)) from factor_keys)
    )
  from grid g
  left join joined j on j.posyandu_id = g.posyandu_id and j.start = g.start
  group by g.posyandu_id, g.start
  order by g.posyandu_id, g.start
$$;

revoke execute on function public.posyandu_monthly(date, date) from public;
grant execute on function public.posyandu_monthly(date, date) to authenticated;
