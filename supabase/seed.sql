-- Development seed. Posyandu names are placeholders until the real list comes from the bidan.
insert into public.puskesmas (id, name) values
  ('00000000-0000-4000-8000-000000000001', 'Puskesmas Rowotengah');

insert into public.posyandu (puskesmas_id, name)
select '00000000-0000-4000-8000-000000000001', 'Posyandu ' || lpad(n::text, 2, '0')
from generate_series(1, 15) as n;

-- Profiles need users in auth.users first. Create them in the Supabase dashboard, then e.g.:
-- insert into public.profiles (id, role, full_name, puskesmas_id, posyandu_id)
-- values ('<user id>', 'kader', 'Nama Kader', '00000000-0000-4000-8000-000000000001', '<posyandu id>');
