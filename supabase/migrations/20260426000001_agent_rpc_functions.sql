-- Agent RPC Functions: deterministische, schlanke Datenpfade für den Telegram-Bot
-- Ersetzen den "alles laden" Portfolio-Context-Dump

-- Voraussetzung: pg_trgm für fuzzy search (similarity())
create extension if not exists pg_trgm;

-- 1. Portfolio-KPIs in einem Call
create or replace function rpc_agent_portfolio_summary()
returns jsonb
language sql stable security definer as $$
  with kpis as (
    select
      (select count(*) from immobilien) as immobilien_count,
      (select count(*) from einheiten) as einheiten_count,
      (select count(*) from mietvertrag where status = 'aktiv') as aktive_vertraege,
      (select count(*) from mietvertrag where status = 'gekuendigt') as gekuendigt,
      (select coalesce(sum(kaltmiete), 0) from mietvertrag where status = 'aktiv') as kaltmiete_monat,
      (select coalesce(sum(kaltmiete + coalesce(betriebskosten, 0)), 0) from mietvertrag where status = 'aktiv') as warmmiete_monat,
      (select count(*) from mietforderungen where ist_faellig = true) as offene_forderungen_count,
      (select coalesce(sum(sollbetrag), 0) from mietforderungen where ist_faellig = true) as offene_forderungen_summe,
      (select count(*) from mietvertrag where coalesce(mahnstufe, 0) > 0) as mahnfaelle,
      (select coalesce(sum(restschuld), 0) from darlehen) as darlehen_restschuld,
      (select coalesce(sum(monatliche_rate), 0) from darlehen) as darlehen_rate,
      (select count(*) from einheiten e
        where not exists (
          select 1 from mietvertrag v
          where v.einheit_id = e.id and v.status in ('aktiv', 'gekuendigt')
        )
      ) as leerstand_count
  )
  select to_jsonb(kpis) from kpis;
$$;

-- 2. Mieter suchen (fuzzy, returns top 5)
create or replace function rpc_agent_find_tenants(p_search text)
returns table(
  mieter_id uuid,
  vorname text,
  nachname text,
  hauptmail text,
  immobilie text,
  einheit text,
  vertrag_status text,
  kaltmiete numeric,
  warmmiete numeric,
  mahnstufe int
)
language sql stable security definer as $$
  select
    m.id,
    m.vorname,
    m.nachname,
    m.hauptmail,
    i.name,
    e.etage,
    v.status,
    v.kaltmiete,
    v.kaltmiete + coalesce(v.betriebskosten, 0) as warmmiete,
    v.mahnstufe
  from mieter m
  left join mietvertrag_mieter mv on mv.mieter_id = m.id
  left join mietvertrag v on v.id = mv.mietvertrag_id and v.status = 'aktiv'
  left join einheiten e on e.id = v.einheit_id
  left join immobilien i on i.id = e.immobilie_id
  where m.vorname ilike '%' || p_search || '%'
     or m.nachname ilike '%' || p_search || '%'
     or (m.vorname || ' ' || m.nachname) ilike '%' || p_search || '%'
  order by similarity((m.vorname || ' ' || m.nachname), p_search) desc nulls last
  limit 5;
$$;

-- 3. Zahlungen für einen Mieter in einem Zeitraum
create or replace function rpc_agent_tenant_payments(
  p_mieter_id uuid default null,
  p_search text default null,
  p_year int default null,
  p_month int default null
)
returns table(
  buchungsdatum date,
  betrag numeric,
  kategorie text,
  verwendungszweck text,
  empfaenger text,
  mietvertrag_id uuid,
  mieter_namen text
)
language sql stable security definer as $$
  with target as (
    select id from mieter
    where (p_mieter_id is not null and id = p_mieter_id)
       or (p_search is not null and (
         vorname ilike '%' || p_search || '%'
         or nachname ilike '%' || p_search || '%'
         or (vorname || ' ' || nachname) ilike '%' || p_search || '%'
       ))
  ),
  vertrage as (
    select distinct v.id
    from mietvertrag v
    join mietvertrag_mieter vm on vm.mietvertrag_id = v.id
    where vm.mieter_id in (select id from target)
  )
  select
    z.buchungsdatum,
    z.betrag,
    z.kategorie,
    z.verwendungszweck,
    z.empfaengername,
    z.mietvertrag_id,
    (select string_agg(m.vorname || ' ' || m.nachname, ', ')
       from mietvertrag_mieter vm
       join mieter m on m.id = vm.mieter_id
       where vm.mietvertrag_id = z.mietvertrag_id) as mieter_namen
  from zahlungen z
  where z.mietvertrag_id in (select id from vertrage)
    and (p_year is null or extract(year from z.buchungsdatum) = p_year)
    and (p_month is null or extract(month from z.buchungsdatum) = p_month)
  order by z.buchungsdatum desc
  limit 50;
$$;

-- 4. Offene Forderungen (alle oder pro Mieter)
create or replace function rpc_agent_outstanding(p_search text default null)
returns table(
  mietvertrag_id uuid,
  immobilie text,
  einheit text,
  mieter_namen text,
  sollmonat text,
  sollbetrag numeric,
  faelligkeitsdatum date,
  mahnstufe int
)
language sql stable security definer as $$
  select
    v.id,
    i.name,
    e.etage,
    (select string_agg(m.vorname || ' ' || m.nachname, ', ')
       from mietvertrag_mieter vm
       join mieter m on m.id = vm.mieter_id
       where vm.mietvertrag_id = v.id),
    f.sollmonat::text,
    f.sollbetrag,
    f.faelligkeitsdatum,
    v.mahnstufe
  from mietforderungen f
  join mietvertrag v on v.id = f.mietvertrag_id
  left join einheiten e on e.id = v.einheit_id
  left join immobilien i on i.id = e.immobilie_id
  where f.ist_faellig = true
    and (
      p_search is null
      or exists (
        select 1 from mietvertrag_mieter vm
        join mieter m on m.id = vm.mieter_id
        where vm.mietvertrag_id = v.id
          and (
            m.vorname ilike '%' || p_search || '%'
            or m.nachname ilike '%' || p_search || '%'
            or (m.vorname || ' ' || m.nachname) ilike '%' || p_search || '%'
          )
      )
    )
  order by f.faelligkeitsdatum asc
  limit 100;
$$;

-- 5. Leerstand-Übersicht
create or replace function rpc_agent_vacancies()
returns table(
  einheit_id uuid,
  immobilie text,
  adresse text,
  etage text,
  qm numeric,
  einheitentyp text
)
language sql stable security definer as $$
  select
    e.id,
    i.name,
    i.adresse,
    e.etage,
    e.qm,
    e.einheitentyp::text
  from einheiten e
  join immobilien i on i.id = e.immobilie_id
  where not exists (
    select 1 from mietvertrag v
    where v.einheit_id = e.id and v.status in ('aktiv', 'gekuendigt')
  )
  order by i.name, e.etage;
$$;

-- 6. Mahnstufen-Übersicht (alle Verträge mit Mahnstufe > 0)
create or replace function rpc_agent_dunning_summary()
returns table(
  mietvertrag_id uuid,
  immobilie text,
  mieter_namen text,
  mahnstufe int,
  kaltmiete numeric,
  offene_forderungen numeric
)
language sql stable security definer as $$
  select
    v.id,
    i.name,
    (select string_agg(m.vorname || ' ' || m.nachname, ', ')
       from mietvertrag_mieter vm
       join mieter m on m.id = vm.mieter_id
       where vm.mietvertrag_id = v.id),
    v.mahnstufe,
    v.kaltmiete,
    (select coalesce(sum(sollbetrag), 0)
       from mietforderungen
       where mietvertrag_id = v.id and ist_faellig = true)
  from mietvertrag v
  left join einheiten e on e.id = v.einheit_id
  left join immobilien i on i.id = e.immobilie_id
  where coalesce(v.mahnstufe, 0) > 0
  order by v.mahnstufe desc;
$$;

-- 7. Darlehen-Übersicht
create or replace function rpc_agent_loans()
returns table(
  bezeichnung text,
  bank text,
  restschuld numeric,
  zinssatz numeric,
  monatliche_rate numeric,
  ende_datum date,
  immobilie_namen text
)
language sql stable security definer as $$
  select
    d.bezeichnung,
    d.bank,
    d.restschuld,
    d.zinssatz_prozent,
    d.monatliche_rate,
    d.ende_datum,
    (select string_agg(i.name, ', ')
       from darlehen_immobilien di
       join immobilien i on i.id = di.immobilie_id
       where di.darlehen_id = d.id)
  from darlehen d
  order by d.restschuld desc;
$$;

-- 8. Mieten-Eingänge in einem Monat (Aggregation)
create or replace function rpc_agent_rent_received(p_year int, p_month int)
returns jsonb
language sql stable security definer as $$
  select jsonb_build_object(
    'year', p_year,
    'month', p_month,
    'total_received', coalesce(sum(z.betrag), 0),
    'kategorie_miete', coalesce(sum(z.betrag) filter (where z.kategorie = 'Miete'), 0),
    'count_payments', count(*)
  )
  from zahlungen z
  where extract(year from z.buchungsdatum) = p_year
    and extract(month from z.buchungsdatum) = p_month;
$$;

-- Permissions: nur via service_role aufrufbar (Edge Function)
revoke all on function rpc_agent_portfolio_summary() from anon, authenticated;
revoke all on function rpc_agent_find_tenants(text) from anon, authenticated;
revoke all on function rpc_agent_tenant_payments(uuid, text, int, int) from anon, authenticated;
revoke all on function rpc_agent_outstanding(text) from anon, authenticated;
revoke all on function rpc_agent_vacancies() from anon, authenticated;
revoke all on function rpc_agent_dunning_summary() from anon, authenticated;
revoke all on function rpc_agent_loans() from anon, authenticated;
revoke all on function rpc_agent_rent_received(int, int) from anon, authenticated;
