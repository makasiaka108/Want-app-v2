create extension if not exists "pgcrypto";

create table if not exists public.wishes (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  external_id text not null,
  query text not null,
  title text not null,
  initial_price numeric(12, 2) not null,
  current_price numeric(12, 2) not null,
  source text not null,
  link text not null,
  thumbnail text not null default '',
  rating numeric(3, 2),
  reviews integer,
  delivery text not null default '',
  match_score numeric(4, 2) not null default 0,
  retailer_score integer not null default 0,
  price_score integer not null default 0,
  want_score integer not null default 0,
  reasons text[] not null default '{}',
  badges text[] not null default '{}',
  possible_mismatch boolean not null default false,
  trusted_seller boolean not null default false,
  price_confidence text not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  unique (device_id, external_id)
);

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  wish_id uuid not null references public.wishes(id) on delete cascade,
  price numeric(12, 2) not null,
  source text not null default '',
  checked_at timestamptz not null default now()
);

create index if not exists wishes_device_id_idx
  on public.wishes(device_id, created_at desc);

create index if not exists price_history_wish_id_idx
  on public.price_history(wish_id, checked_at asc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists wishes_set_updated_at on public.wishes;

create trigger wishes_set_updated_at
before update on public.wishes
for each row
execute function public.set_updated_at();
