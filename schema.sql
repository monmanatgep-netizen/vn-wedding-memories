-- Run this entire file in Supabase > SQL Editor.
create extension if not exists vector with schema extensions;

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  photo_no bigint generated always as identity (start with 1 increment by 1) unique,
  storage_path text not null,
  guest_name text not null,
  wish text not null default '',
  face_search_consent boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists photos_created_at_idx on public.photos(created_at desc);
create index if not exists photos_guest_name_idx on public.photos using gin (to_tsvector('simple', guest_name));
create index if not exists photos_wish_idx on public.photos using gin (to_tsvector('simple', wish));

-- A separate table prevents the public gallery from directly reading biometric vectors.
create table if not exists public.face_embeddings (
  id bigint generated always as identity primary key,
  photo_id uuid not null references public.photos(id) on delete cascade,
  embedding extensions.vector(128) not null,
  created_at timestamptz not null default now()
);

create index if not exists face_embeddings_vector_idx
on public.face_embeddings using ivfflat (embedding extensions.vector_cosine_ops) with (lists = 50);

alter table public.photos enable row level security;
alter table public.face_embeddings enable row level security;

-- Wedding gallery is public: visitors can view photos and submit new ones.
drop policy if exists "Public can view wedding photos" on public.photos;
create policy "Public can view wedding photos" on public.photos
for select to anon, authenticated using (true);

drop policy if exists "Public can upload photo records" on public.photos;
create policy "Public can upload photo records" on public.photos
for insert to anon, authenticated with check (
  length(guest_name) between 1 and 80 and
  length(wish) <= 1000 and
  storage_path like 'uploads/%'
);

-- Embeddings are never directly selectable by visitors.
drop policy if exists "No public embedding reads" on public.face_embeddings;
create policy "No public embedding reads" on public.face_embeddings
for select to anon, authenticated using (false);

-- Only allow a descriptor to be stored for a photo whose uploader consented.
drop policy if exists "Insert opted-in face embeddings" on public.face_embeddings;
create policy "Insert opted-in face embeddings" on public.face_embeddings
for insert to anon, authenticated with check (
  exists (
    select 1 from public.photos p
    where p.id = photo_id and p.face_search_consent = true
  )
);

-- Search is limited to consented photos. Similarity is cosine similarity (higher is closer).
create or replace function public.match_faces(query_embedding extensions.vector(128), match_count int default 30)
returns table (
  id uuid,
  photo_no bigint,
  storage_path text,
  guest_name text,
  wish text,
  created_at timestamptz,
  similarity double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select p.id, p.photo_no, p.storage_path, p.guest_name, p.wish, p.created_at,
         (1 - (f.embedding <=> query_embedding))::double precision as similarity
  from public.face_embeddings f
  join public.photos p on p.id = f.photo_id
  where p.face_search_consent = true
  order by f.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 30), 100));
$$;

revoke all on function public.match_faces(extensions.vector, int) from public;
grant execute on function public.match_faces(extensions.vector, int) to anon, authenticated;

-- Storage bucket: public read allows gallery images to display without signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wedding-photos', 'wedding-photos', true, 15728640,
        array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set public = true, file_size_limit = 15728640;

drop policy if exists "Public view wedding image files" on storage.objects;
create policy "Public view wedding image files" on storage.objects
for select to anon, authenticated using (bucket_id = 'wedding-photos');

drop policy if exists "Public upload wedding image files" on storage.objects;
create policy "Public upload wedding image files" on storage.objects
for insert to anon, authenticated with check (
  bucket_id = 'wedding-photos' and
  (storage.foldername(name))[1] = 'uploads'
);
