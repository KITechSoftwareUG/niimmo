-- 6 weitere READ-RPC-Funktionen für den Agenten:
-- rpc_agent_unassigned_payments — Nicht zugeordnete Zahlungen
-- rpc_agent_revenue_by_property — Einnahmen aufgeteilt nach Immobilien
-- rpc_agent_loan_details        — Darlehen-Details inkl. letzte Tilgungen
-- rpc_agent_contract_history    — Alle Verträge einer Einheit/Immobilie/Mieter
-- rpc_agent_market_data         — Basiszinssatz + VPI-Daten
-- rpc_agent_documents           — Dokumente eines Mieters oder einer Immobilie

-- 1. Nicht zugeordnete Zahlungen
create or replace function rpc_agent_unassigned_payments(p_limit int default 25)
returns table(
  id               uuid,
  buchungsdatum    date,
  betrag           numeric,
  empfaengername   text,
  verwendungszweck text,
  iban             text
)
language sql stable security definer as $$
  select
    z.id,
    z.buchungsdatum::date,
    z.betrag,
    z.empfaengername,
    z.verwendungszweck,
    z.iban
  from zahlungen z
  where z.mietvertrag_id is null
    and (z.kategorie is null or z.kategorie::text not in ('Ignorieren', 'Nichtmiete'))
  order by z.buchungsdatum desc
  limit p_limit;
$$;

-- 2. Einnahmen nach Immobilie (für einen Monat)
create or replace function rpc_agent_revenue_by_property(
  p_year  int default null,
  p_month int default null
)
returns table(
  immobilie        text,
  aktive_vertraege bigint,
  kaltmiete_soll   numeric,
  warmmiete_soll   numeric,
  ist_eingegangen  numeric,
  differenz        numeric
)
language sql stable security definer as $$
  with params as (
    select
      coalesce(p_year,  extract(year  from current_date)::int) as jahr,
      coalesce(p_month, extract(month from current_date)::int) as monat
  ),
  soll as (
    select
      e.immobilie_id,
      count(distinct v.id)                                               as vertraege,
      coalesce(sum(v.kaltmiete), 0)                                      as kaltmiete,
      coalesce(sum(v.kaltmiete + coalesce(v.betriebskosten, 0)), 0)      as warmmiete
    from mietvertrag v
    join einheiten e on e.id = v.einheit_id
    where v.status = 'aktiv'
    group by e.immobilie_id
  ),
  ist as (
    select
      e.immobilie_id,
      coalesce(sum(z.betrag) filter (where z.kategorie = 'Miete'), 0) as eingegangen
    from zahlungen z
    join mietvertrag v on v.id = z.mietvertrag_id
    join einheiten e on e.id = v.einheit_id
    cross join params
    where extract(year  from z.buchungsdatum) = params.jahr
      and extract(month from z.buchungsdatum) = params.monat
    group by e.immobilie_id
  )
  select
    i.name,
    coalesce(s.vertraege,      0),
    coalesce(s.kaltmiete,      0),
    coalesce(s.warmmiete,      0),
    coalesce(ist.eingegangen,  0),
    coalesce(s.warmmiete, 0) - coalesce(ist.eingegangen, 0)
  from immobilien i
  left join soll s   on s.immobilie_id   = i.id
  left join ist      on ist.immobilie_id = i.id
  order by i.name;
$$;

-- 3. Darlehen-Details mit letzter Tilgungszahlung und Immobilien
create or replace function rpc_agent_loan_details(p_search text default null)
returns table(
  darlehen_id          uuid,
  bezeichnung          text,
  bank                 text,
  darlehensbetrag      numeric,
  restschuld           numeric,
  zinssatz_prozent     numeric,
  monatliche_rate      numeric,
  start_datum          date,
  ende_datum           date,
  letzte_tilgung_datum date,
  letzte_tilgung_betrag numeric,
  immobilien           text
)
language sql stable security definer as $$
  select
    d.id,
    d.bezeichnung,
    d.bank,
    d.darlehensbetrag,
    d.restschuld,
    d.zinssatz_prozent,
    d.monatliche_rate,
    d.start_datum::date,
    d.ende_datum::date,
    (
      select max(dz.buchungsdatum)::date
      from darlehen_zahlungen dz
      where dz.darlehen_id = d.id
    ),
    (
      select dz.betrag
      from darlehen_zahlungen dz
      where dz.darlehen_id = d.id
      order by dz.buchungsdatum desc
      limit 1
    ),
    (
      select string_agg(i.name, ', ')
      from darlehen_immobilien di
      join immobilien i on i.id = di.immobilie_id
      where di.darlehen_id = d.id
    )
  from darlehen d
  where
    p_search is null
    or d.bezeichnung ilike '%' || p_search || '%'
    or d.bank ilike '%' || p_search || '%'
    or exists (
      select 1
      from darlehen_immobilien di
      join immobilien i on i.id = di.immobilie_id
      where di.darlehen_id = d.id
        and i.name ilike '%' || p_search || '%'
    )
  order by d.bezeichnung;
$$;

-- 4. Vollständige Vertragshistorie (alle Statuse) für eine Einheit/Immobilie/Mieter
create or replace function rpc_agent_contract_history(p_search text)
returns table(
  immobilie        text,
  einheit          text,
  mieter_name      text,
  vertrag_status   text,
  start_datum      date,
  ende_datum       date,
  kuendigungsdatum date,
  kaltmiete        numeric
)
language sql stable security definer as $$
  select distinct on (v.id)
    i.name,
    e.etage,
    (
      select string_agg(m2.vorname || ' ' || m2.nachname, ', ')
      from mietvertrag_mieter mm2
      join mieter m2 on m2.id = mm2.mieter_id
      where mm2.mietvertrag_id = v.id
    ),
    v.status::text,
    v.start_datum::date,
    v.ende_datum::date,
    v.kuendigungsdatum::date,
    v.kaltmiete
  from mietvertrag v
  join einheiten e on e.id = v.einheit_id
  join immobilien i on i.id = e.immobilie_id
  left join mietvertrag_mieter mm on mm.mietvertrag_id = v.id
  left join mieter m on m.id = mm.mieter_id
  where
    i.name    ilike '%' || p_search || '%'
    or i.adresse ilike '%' || p_search || '%'
    or e.etage   ilike '%' || p_search || '%'
    or m.vorname  ilike '%' || p_search || '%'
    or m.nachname ilike '%' || p_search || '%'
    or (m.vorname || ' ' || m.nachname) ilike '%' || p_search || '%'
  order by v.id, v.start_datum desc
  limit 30;
$$;

-- 5. Aktuelle Marktdaten (Basiszinssatz, VPI)
create or replace function rpc_agent_market_data()
returns table(
  typ      text,
  wert     numeric,
  stichtag date,
  quelle   text
)
language sql stable security definer as $$
  select distinct on (md.typ)
    md.typ,
    md.wert,
    md.stichtag::date,
    md.quelle
  from marktdaten md
  order by md.typ, md.stichtag desc;
$$;

-- 6. Dokumente eines Mieters oder einer Immobilie
create or replace function rpc_agent_documents(p_search text default null)
returns table(
  id             uuid,
  titel          text,
  kategorie      text,
  dateityp       text,
  hochgeladen_am date,
  immobilie      text,
  mieter_name    text
)
language sql stable security definer as $$
  select distinct on (d.id)
    d.id,
    d.titel,
    d.kategorie::text,
    d.dateityp,
    d.hochgeladen_am::date,
    i.name,
    (
      select string_agg(m2.vorname || ' ' || m2.nachname, ', ')
      from mietvertrag_mieter mm2
      join mieter m2 on m2.id = mm2.mieter_id
      where mm2.mietvertrag_id = d.mietvertrag_id
    )
  from dokumente d
  left join immobilien i on i.id = d.immobilie_id
  left join mietvertrag v on v.id = d.mietvertrag_id
  left join einheiten e on e.id = v.einheit_id
  left join mietvertrag_mieter mm on mm.mietvertrag_id = v.id
  left join mieter m on m.id = mm.mieter_id
  where d.geloescht = false
    and (
      p_search is null
      or d.titel ilike '%' || p_search || '%'
      or d.kategorie::text ilike '%' || p_search || '%'
      or i.name ilike '%' || p_search || '%'
      or m.vorname  ilike '%' || p_search || '%'
      or m.nachname ilike '%' || p_search || '%'
      or (m.vorname || ' ' || m.nachname) ilike '%' || p_search || '%'
    )
  order by d.id, d.hochgeladen_am desc nulls last
  limit 20;
$$;

revoke all on function rpc_agent_unassigned_payments(int) from anon, authenticated;
revoke all on function rpc_agent_revenue_by_property(int, int) from anon, authenticated;
revoke all on function rpc_agent_loan_details(text) from anon, authenticated;
revoke all on function rpc_agent_contract_history(text) from anon, authenticated;
revoke all on function rpc_agent_market_data() from anon, authenticated;
revoke all on function rpc_agent_documents(text) from anon, authenticated;
