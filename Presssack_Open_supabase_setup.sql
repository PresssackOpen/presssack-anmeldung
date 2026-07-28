-- Bereits ausgeführte Supabase-Struktur
-- Diese Datei dient nur als Sicherung.
create extension if not exists pgcrypto;

create table if not exists public.turnier_einstellungen (
  id integer primary key default 1 check (id = 1),
  turniername text not null default '12. Presssack Open',
  turnierjahr integer not null default 2027 check (turnierjahr between 2026 and 2100),
  max_teams integer not null default 20 check (max_teams between 1 and 50),
  geaendert_am timestamptz not null default now()
);

insert into public.turnier_einstellungen (id,turniername,turnierjahr,max_teams)
values (1,'12. Presssack Open',2027,20)
on conflict (id) do nothing;

create table if not exists public.anmeldungen (
 id uuid primary key default gen_random_uuid(),
 anmeldungsgruppe uuid not null,
 spieler1 text not null,
 spieler2 text not null,
 email text not null,
 telefon text,
 bemerkung text,
 start_nr integer not null check (start_nr between 1 and 16),
 anzahl_teams integer not null check (anzahl_teams between 1 and 50),
 status text not null default 'offen' check (status in ('offen','storniert')),
 erstellt_am timestamptz not null default now(),
 geaendert_am timestamptz not null default now()
);

create table if not exists public.admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace view public.oeffentliche_meldeliste as
select id,spieler1,spieler2,start_nr,anzahl_teams,erstellt_am
from public.anmeldungen where status='offen';
