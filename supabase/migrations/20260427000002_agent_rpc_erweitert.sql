-- 5 neue RPC-Funktionen für den Agenten:
-- rpc_agent_meter_readings   — Zählerstände (KW/WW/Strom/Gas) per Einheit
-- rpc_agent_insurance        — Versicherungen je Immobilie
-- rpc_agent_nebenkosten      — Kostenpositionen / Nebenkosten
-- rpc_agent_property_details — Vollständige Immobilien-Details
-- rpc_agent_tenant_deposit   — Kautions-Status eines Mieters

-- 1. Zählerstände
create or replace function rpc_agent_meter_readings(p_search text default null)
returns table(
  immobilie              text,
  einheit                text,
  mieter_namen           text,
  kaltwasser_zaehler     text,
  kaltwasser_stand       numeric,
  kaltwasser_datum       date,
  warmwasser_zaehler     text,
  warmwasser_stand       numeric,
  warmwasser_datum       date,
  strom_zaehler          text,
  strom_stand            numeric,
  strom_datum            date,
  gas_zaehler            text,
  gas_stand              numeric,
  gas_datum              date
)
language sql stable security definer as $$
  select
    i.name,
    e.etage,
    (
      select string_agg(m.vorname || ' ' || m.nachname, ', ')
      from mietvertrag v2
      join mietvertrag_mieter vm2 on vm2.mietvertrag_id = v2.id
      join mieter m on m.id = vm2.mieter_id
      where v2.einheit_id = e.id and v2.status in ('aktiv', 'gekuendigt')
    ),
    e.kaltwasser_zaehler,
    e.kaltwasser_stand_aktuell,
    e.kaltwasser_stand_datum::date,
    e.warmwasser_zaehler,
    e.warmwasser_stand_aktuell,
    e.warmwasser_stand_datum::date,
    e.strom_zaehler,
    e.strom_stand_aktuell,
    e.strom_stand_datum::date,
    e.gas_zaehler,
    e.gas_stand_aktuell,
    e.gas_stand_datum::date
  from einheiten e
  join immobilien i on i.id = e.immobilie_id
  where
    p_search is null
    or i.name ilike '%' || p_search || '%'
    or i.adresse ilike '%' || p_search || '%'
    or exists (
      select 1
      from mietvertrag v
      join mietvertrag_mieter vm on vm.mietvertrag_id = v.id
      join mieter m on m.id = vm.mieter_id
      where v.einheit_id = e.id
        and v.status in ('aktiv', 'gekuendigt')
        and (
          m.vorname ilike '%' || p_search || '%'
          or m.nachname ilike '%' || p_search || '%'
          or (m.vorname || ' ' || m.nachname) ilike '%' || p_search || '%'
        )
    )
  order by i.name, e.etage
  limit 20;
$$;

-- 2. Versicherungen
create or replace function rpc_agent_insurance(p_search text default null)
returns table(
  immobilie      text,
  typ            text,
  firma          text,
  kontaktperson  text,
  email          text,
  telefon        text,
  vertragsnummer text,
  jahresbeitrag  numeric,
  notizen        text
)
language sql stable security definer as $$
  select
    i.name,
    v.typ,
    v.firma,
    v.kontaktperson,
    v.email,
    v.telefon,
    v.vertragsnummer,
    v.jahresbeitrag,
    v.notizen
  from versicherungen v
  join immobilien i on i.id = v.immobilie_id
  where
    p_search is null
    or i.name ilike '%' || p_search || '%'
    or v.firma ilike '%' || p_search || '%'
  order by i.name, v.typ;
$$;

-- 3. Nebenkosten / Kostenpositionen
create or replace function rpc_agent_nebenkosten(
  p_search text default null,
  p_year   int  default null
)
returns table(
  immobilie        text,
  bezeichnung      text,
  nebenkostenart   text,
  gesamtbetrag     numeric,
  ist_umlagefaehig boolean,
  zeitraum_von     date,
  zeitraum_bis     date
)
language sql stable security definer as $$
  select
    i.name,
    kp.bezeichnung,
    na.name,
    kp.gesamtbetrag,
    kp.ist_umlagefaehig,
    kp.zeitraum_von::date,
    kp.zeitraum_bis::date
  from kostenpositionen kp
  join immobilien i on i.id = kp.immobilie_id
  left join nebenkostenarten na on na.id = kp.nebenkostenart_id
  where
    (p_search is null
      or i.name ilike '%' || p_search || '%'
      or i.adresse ilike '%' || p_search || '%')
    and (p_year is null
      or extract(year from kp.zeitraum_von) = p_year
      or extract(year from kp.zeitraum_bis) = p_year)
  order by i.name, kp.zeitraum_von;
$$;

-- 4. Immobilien-Details (vollständig)
create or replace function rpc_agent_property_details(p_search text)
returns table(
  immobilie_id            uuid,
  name                    text,
  adresse                 text,
  baujahr                 int,
  objekttyp               text,
  kaufpreis               numeric,
  marktwert               numeric,
  ist_angespannt          boolean,
  hat_strom               boolean,
  hat_gas                 boolean,
  hat_wasser              boolean,
  versorger_strom         text,
  versorger_gas           text,
  versorger_wasser        text,
  einheiten_count         bigint,
  aktive_vertraege        bigint,
  leerstand               bigint,
  hausanschluss_strom_stand numeric,
  hausanschluss_strom_datum date,
  hausanschluss_gas_stand   numeric,
  hausanschluss_gas_datum   date,
  hausanschluss_wasser_stand numeric,
  hausanschluss_wasser_datum date
)
language sql stable security definer as $$
  select
    i.id,
    i.name,
    i.adresse,
    i.baujahr,
    i.objekttyp::text,
    i.kaufpreis,
    i.marktwert,
    i.ist_angespannt,
    i.hat_strom,
    i.hat_gas,
    i.hat_wasser,
    i.versorger_strom_name,
    i.versorger_gas_name,
    i.versorger_wasser_name,
    (select count(*) from einheiten e where e.immobilie_id = i.id),
    (select count(*) from mietvertrag v join einheiten e on e.id = v.einheit_id
      where e.immobilie_id = i.id and v.status = 'aktiv'),
    (select count(*) from einheiten e where e.immobilie_id = i.id
      and not exists (
        select 1 from mietvertrag v
        where v.einheit_id = e.id and v.status in ('aktiv', 'gekuendigt')
      )),
    i.allgemein_strom_stand,
    i.allgemein_strom_datum::date,
    i.allgemein_gas_stand,
    i.allgemein_gas_datum::date,
    i.allgemein_wasser_stand,
    i.allgemein_wasser_datum::date
  from immobilien i
  where
    i.name ilike '%' || p_search || '%'
    or i.adresse ilike '%' || p_search || '%'
  order by similarity(i.name || ' ' || i.adresse, p_search) desc
  limit 3;
$$;

-- 5. Kautions-Status
create or replace function rpc_agent_tenant_deposit(
  p_search    text default null,
  p_mieter_id uuid default null
)
returns table(
  mieter_id        uuid,
  mieter_name      text,
  immobilie        text,
  einheit          text,
  kaution_betrag   numeric,
  kaution_ist      numeric,
  kaution_status   text,
  kaution_gezahlt_am date,
  vertrag_status   text
)
language sql stable security definer as $$
  select distinct on (m.id)
    m.id,
    m.vorname || ' ' || m.nachname,
    i.name,
    e.etage,
    v.kaution_betrag,
    v.kaution_ist,
    v.kaution_status,
    v.kaution_gezahlt_am::date,
    v.status::text
  from mieter m
  join mietvertrag_mieter mm on mm.mieter_id = m.id
  join mietvertrag v on v.id = mm.mietvertrag_id
    and v.status in ('aktiv', 'gekuendigt')
  join einheiten e on e.id = v.einheit_id
  join immobilien i on i.id = e.immobilie_id
  where
    (p_mieter_id is not null and m.id = p_mieter_id)
    or (p_search is not null and (
          m.vorname ilike '%' || p_search || '%'
       or m.nachname ilike '%' || p_search || '%'
       or (m.vorname || ' ' || m.nachname) ilike '%' || p_search || '%'
    ))
  order by m.id,
    (case when v.status = 'aktiv' then 0 when v.status = 'gekuendigt' then 1 else 2 end)
  limit 10;
$$;

revoke all on function rpc_agent_meter_readings(text) from anon, authenticated;
revoke all on function rpc_agent_insurance(text) from anon, authenticated;
revoke all on function rpc_agent_nebenkosten(text, int) from anon, authenticated;
revoke all on function rpc_agent_property_details(text) from anon, authenticated;
revoke all on function rpc_agent_tenant_deposit(text, uuid) from anon, authenticated;
