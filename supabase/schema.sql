-- CalorieTrack.ai — jalankan sekali di Supabase SQL Editor
create extension if not exists pgcrypto;
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  target_kalori integer not null default 2000 check (target_kalori between 500 and 10000),
  created_at timestamptz not null default now()
);
create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  waktu_makan text not null check (waktu_makan in ('Pagi','Siang','Sore','Malam')),
  nama_makanan text not null check (char_length(nama_makanan) between 1 and 200),
  kalori integer not null check (kalori between 0 and 10000),
  rincian_nutrisi jsonb not null default '{"karbo":0,"protein":0,"lemak":0}'::jsonb,
  tanggal date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists food_logs_user_date_idx on public.food_logs(user_id,tanggal desc);
alter table public.users enable row level security;
alter table public.food_logs enable row level security;
create policy "users_select_own" on public.users for select using (auth.uid()=id);
create policy "users_update_own" on public.users for update using (auth.uid()=id) with check (auth.uid()=id);
create policy "logs_select_own" on public.food_logs for select using (auth.uid()=user_id);
create policy "logs_insert_own" on public.food_logs for insert with check (auth.uid()=user_id);
create policy "logs_update_own" on public.food_logs for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "logs_delete_own" on public.food_logs for delete using (auth.uid()=user_id);
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.users(id,email) values(new.id,coalesce(new.email,'')) on conflict(id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('food-images','food-images',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "food_images_select_own" on storage.objects for select using (bucket_id='food-images' and auth.uid()::text=(storage.foldername(name))[1]);
create policy "food_images_insert_own" on storage.objects for insert with check (bucket_id='food-images' and auth.uid()::text=(storage.foldername(name))[1]);
create policy "food_images_delete_own" on storage.objects for delete using (bucket_id='food-images' and auth.uid()::text=(storage.foldername(name))[1]);
