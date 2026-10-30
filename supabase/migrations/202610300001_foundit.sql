-- Apply to a new Supabase Free project. No service-role key is used by the app.
create extension if not exists vector with schema extensions;
create table public.foundit_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  title text not null check (length(trim(title)) between 1 and 70),
  description text not null check (length(trim(description)) between 1 and 500),
  category text not null check (category in ('Bags','Bottles','Electronics','Accessories','Other')),
  location text not null check (location in ('Student Center','Library','Engineering Hall')),
  date date not null check (date <= current_date),
  pickup_notes text not null default '' check (length(pickup_notes)<=500),
  is_sample boolean not null default false,
  image_path text not null unique,
  embedding extensions.vector(512) not null,
  created_at timestamptz not null default now(),
  check (image_path = owner_id::text || '/' || id::text || '.jpg')
);
create index foundit_embedding_idx on public.foundit_items
  using hnsw (embedding extensions.vector_cosine_ops);
alter table public.foundit_items enable row level security;
revoke all on public.foundit_items from anon, authenticated;
grant select on public.foundit_items to anon, authenticated;
grant insert (id,owner_id,title,description,category,location,date,pickup_notes,image_path,embedding)
  on public.foundit_items to authenticated;
create policy "Public board is readable" on public.foundit_items
  for select to anon,authenticated using (true);
create policy "Post under your session" on public.foundit_items
  for insert to authenticated with check (owner_id=(select auth.uid()));

create function public.match_foundit_items(
  query_embedding extensions.vector(512), match_count integer default 100,
  filter_category text default null, filter_location text default null,
  date_from date default null, date_to date default null
) returns table(
  id uuid,title text,description text,category text,location text,date date,
  pickup_notes text,is_sample boolean,image_path text,score double precision
) language sql stable security invoker
set search_path = public, extensions
as $$
  select i.id,i.title,i.description,i.category,i.location,i.date,
         i.pickup_notes,i.is_sample,i.image_path,
         1-(i.embedding <=> query_embedding) as score
  from public.foundit_items i
  where (filter_category is null or i.category=filter_category)
    and (filter_location is null or i.location=filter_location)
    and (date_from is null or i.date>=date_from)
    and (date_to is null or i.date<=date_to)
  order by i.embedding <=> query_embedding
  limit greatest(1,least(match_count,100));
$$;
revoke all on function public.match_foundit_items from public;
grant execute on function public.match_foundit_items to anon,authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('foundit-photos','foundit-photos',true,8388608,array['image/jpeg']);
create policy "Upload photos under your session" on storage.objects
for insert to authenticated with check (
  bucket_id='foundit-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy "Read your photo metadata" on storage.objects
for select to authenticated using (
  bucket_id='foundit-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy "Remove unlinked upload after failed post" on storage.objects
for delete to authenticated using (
  bucket_id='foundit-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
  and not exists (select 1 from public.foundit_items where image_path=name)
);
