-- GrowSense initial schema: organisation, children, measurements, row level security.

create table public.puskesmas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.posyandu (
  id uuid primary key default gen_random_uuid(),
  puskesmas_id uuid not null references public.puskesmas (id),
  name text not null,
  dusun text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('kader', 'bidan', 'admin')),
  full_name text not null,
  puskesmas_id uuid not null references public.puskesmas (id),
  posyandu_id uuid references public.posyandu (id),
  created_at timestamptz not null default now(),
  constraint kader_has_posyandu check (role <> 'kader' or posyandu_id is not null)
);

-- Ids for children and measurements are generated on the device so offline records keep them.
create table public.children (
  id uuid primary key,
  posyandu_id uuid not null references public.posyandu (id),
  full_name text not null,
  nik text check (nik ~ '^[0-9]{16}$'),
  sex text not null check (sex in ('male', 'female')),
  birth_date date not null,
  mother_name text,
  birth_weight_kg numeric(4, 2) check (birth_weight_kg between 0.3 and 7),
  consent_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.measurements (
  id uuid primary key,
  child_id uuid not null references public.children (id),
  measured_at date not null,
  weight_kg numeric(5, 2) check (weight_kg between 0.5 and 60),
  height_cm numeric(5, 1) check (height_cm between 35 and 130),
  position text check (position in ('recumbent', 'standing')),
  risk_factors jsonb not null default '{}',
  haz numeric(5, 2),
  waz numeric(5, 2),
  whz numeric(5, 2),
  flags text[] not null default '{}',
  note text,
  recorded_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index children_posyandu_idx on public.children (posyandu_id);
create index children_updated_idx on public.children (updated_at);
create index measurements_child_idx on public.measurements (child_id, measured_at);
create index measurements_updated_idx on public.measurements (updated_at);

-- The server decides timestamps and authorship, whatever the client sends.
create function public.stamp_row() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := now();
    if tg_table_name = 'children' then
      new.created_by := auth.uid();
    else
      new.recorded_by := auth.uid();
    end if;
  else
    new.created_at := old.created_at;
    if tg_table_name = 'children' then
      new.created_by := old.created_by;
    else
      new.recorded_by := old.recorded_by;
    end if;
  end if;
  return new;
end
$$;

create trigger children_stamp before insert or update on public.children
  for each row execute function public.stamp_row();
create trigger measurements_stamp before insert or update on public.measurements
  for each row execute function public.stamp_row();

-- Kader: own posyandu. Bidan and admin: every posyandu under their puskesmas.
create function public.can_access_posyandu(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from profiles pr
    join posyandu po on po.id = target
    where pr.id = auth.uid()
      and (
        pr.posyandu_id = target
        or (pr.role in ('bidan', 'admin') and po.puskesmas_id = pr.puskesmas_id)
      )
  )
$$;

create function public.can_access_child(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from children c where c.id = target and public.can_access_posyandu(c.posyandu_id)
  )
$$;

alter table public.puskesmas enable row level security;
alter table public.posyandu enable row level security;
alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.measurements enable row level security;

create policy "own puskesmas" on public.puskesmas for select to authenticated
  using (id in (select puskesmas_id from public.profiles where id = auth.uid()));

create policy "accessible posyandu" on public.posyandu for select to authenticated
  using (public.can_access_posyandu(id));

create policy "own profile" on public.profiles for select to authenticated
  using (id = auth.uid());

-- No delete policies: records are soft deleted through deleted_at.
create policy "read children" on public.children for select to authenticated
  using (public.can_access_posyandu(posyandu_id));
create policy "add children" on public.children for insert to authenticated
  with check (public.can_access_posyandu(posyandu_id));
create policy "edit children" on public.children for update to authenticated
  using (public.can_access_posyandu(posyandu_id))
  with check (public.can_access_posyandu(posyandu_id));

create policy "read measurements" on public.measurements for select to authenticated
  using (public.can_access_child(child_id));
create policy "add measurements" on public.measurements for insert to authenticated
  with check (public.can_access_child(child_id));
create policy "edit measurements" on public.measurements for update to authenticated
  using (public.can_access_child(child_id))
  with check (public.can_access_child(child_id));
