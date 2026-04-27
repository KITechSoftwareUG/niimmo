-- 6 weitere READ-RPC-Funktionen für den Agenten:
-- rpc_agent_upcoming_endings  — Verträge die bald enden / bereits gekündigt
-- rpc_agent_tenant_contacts   — Vollständige Kontaktdaten eines Mieters
-- rpc_agent_property_units    — Alle Einheiten einer Immobilie mit Belegungsinfo
-- rpc_agent_all_tenants       — Alle aktiven/gekündigten Mieter (Gesamtliste)
-- rpc_agent_meter_history     — Historische Zählerstände aus zaehlerstand_historie
-- rpc_agent_whatsapp          — WhatsApp-Nachrichten eines Mieters

-- 1. Bald endende / gekündigte Verträge
create or replace function rpc_agent_upcoming_endings(p_months int default 3)
returns table(
  mieter_name      text,
  immobilie        text,
  einheit          text,
  kaltmiete        numeric,
  vertrag_status   text,
  ende_datum       date,
  kuendigungsdatum date,
  tage_bis_ende    int
)
language sql stable security definer as $$
  select
    (
      select string_agg(m.vorname || ' ' || m.nachname, ', ')
      from mietvertrag_mieter mm2
      join mieter m on m.id = mm2.mieter_id
      where mm2.mietvertrag_id = v.id
    ),
    i.name,
    e.etage,
    v.kaltmiete,
    v.status::text,
    v.ende_datum::date,
    v.kuendigungsdatum::date,
    (v.ende_datum::date - current_date)::int
  from mietvertrag v
  join einheiten e on e.id = v.einheit_id
  join immobilien i on i.id = e.immobilie_id
  where v.status in ('aktiv', 'gekuendigt')
    and (
      v.status = 'gekuendigt'
      or (
        v.ende_datum is not null
        and v.ende_datum::date <= current_date + (p_months || ' months')::interval
      )
    )
  order by v.ende_datum asc nulls last
  limit 20;
$$;

-- 2. Vollständige Kontaktdaten eines Mieters
create or replace function rpc_agent_tenant_contacts(p_search text)
returns table(
  mieter_id      uuid,
  vorname        text,
  nachname       text,
  hauptmail      text,
  telnr          text,
  weitere_mails  text,
  geburtsdatum   date,
  immobilie      text,
  einheit        text,
  vertrag_status text
)
language sql stable security definer as $$
  select distinct on (m.id)
    m.id,
    m.vorname,
    m.nachname,
    m.hauptmail,
    m.telnr,
    m.weitere_mails,
    m.geburtsdatum::date,
    i.name,
    e.etage,
    v.status::text
  from mieter m
  left join mietvertrag_mieter mm on mm.mieter_id = m.id
  left join mietvertrag v on v.id = mm.mietvertrag_id
    and v.status in ('aktiv', 'gekuendigt')
  left join einheiten e on e.id = v.einheit_id
  left join immobilien i on i.id = e.immobilie_id
  where
    m.vorname ilike '%' || p_search || '%'
    or m.nachname ilike '%' || p_search || '%'
    or (m.vorname || ' ' || m.nachname) ilike '%' || p_search || '%'
    or m.hauptmail ilike '%' || p_search || '%'
    or m.telnr ilike '%' || p_search || '%'
  order by m.id, (case when v.status = 'aktiv' then 0 when v.status = 'gekuendigt' then 1 else 2 end)
  limit 5;
$$;

-- 3. Alle Einheiten einer Immobilie mit Belegungsinfo
create or replace function rpc_agent_property_units(p_search text)
returns table(
  einheit        text,
  qm             numeric,
  einheitentyp   text,
  mieter_namen   text,
  vertrag_status text,
  kaltmiete      numeric,
  warmmiete      numeric,
  start_datum    date,
  mahnstufe      int
)
language sql stable security definer as $$
  select
    e.etage,
    e.qm,
    e.einheitentyp::text,
    (
      select string_agg(m.vorname || ' ' || m.nachname, ', ')
      from mietvertrag_mieter mm2
      join mieter m on m.id = mm2.mieter_id
      where mm2.mietvertrag_id = v.id
    ),
    v.status::text,
    v.kaltmiete,
    v.kaltmiete + coalesce(v.betriebskosten, 0),
    v.start_datum::date,
    v.mahnstufe
  from immobilien i
  join einheiten e on e.immobilie_id = i.id
  left join mietvertrag v on v.einheit_id = e.id
    and v.status in ('aktiv', 'gekuendigt')
  where
    i.name ilike '%' || p_search || '%'
    or i.adresse ilike '%' || p_search || '%'
  order by e.etage;
$$;

-- 4. Gesamtliste aller Mieter (nach Status filterbar)
create or replace function rpc_agent_all_tenants(p_status text default 'aktiv')
returns table(
  mieter_name  text,
  hauptmail    text,
  telnr        text,
  immobilie    text,
  einheit      text,
  kaltmiete    numeric,
  warmmiete    numeric,
  start_datum  date,
  mahnstufe    int
)
language sql stable security definer as $$
  select
    m.vorname || ' ' || m.nachname,
    m.hauptmail,
    m.telnr,
    i.name,
    e.etage,
    v.kaltmiete,
    v.kaltmiete + coalesce(v.betriebskosten, 0),
    v.start_datum::date,
    v.mahnstufe
  from mietvertrag v
  join mietvertrag_mieter mm on mm.mietvertrag_id = v.id
  join mieter m on m.id = mm.mieter_id
  join einheiten e on e.id = v.einheit_id
  join immobilien i on i.id = e.immobilie_id
  where v.status::text = p_status
  order by i.name, e.etage;
$$;

-- 5. Historische Zählerstände
create or replace function rpc_agent_meter_history(
  p_search text,
  p_limit  int default 15
)
returns table(
  datum          date,
  zaehler_typ    text,
  zaehler_nummer text,
  stand          numeric,
  quelle         text,
  einheit        text,
  immobilie      text
)
language sql stable security definer as $$
  select
    zh.datum::date,
    zh.zaehler_typ,
    zh.zaehler_nummer,
    zh.stand,
    zh.quelle,
    e.etage,
    i.name
  from zaehlerstand_historie zh
  left join einheiten e on e.id = zh.einheit_id
  left join immobilien i on i.id = coalesce(e.immobilie_id, zh.immobilie_id)
  where
    i.name ilike '%' || p_search || '%'
    or i.adresse ilike '%' || p_search || '%'
    or exists (
      select 1
      from mietvertrag v
      join mietvertrag_mieter mm on mm.mietvertrag_id = v.id
      join mieter m on m.id = mm.mieter_id
      where v.einheit_id = zh.einheit_id
        and (
          m.vorname ilike '%' || p_search || '%'
          or m.nachname ilike '%' || p_search || '%'
          or (m.vorname || ' ' || m.nachname) ilike '%' || p_search || '%'
        )
    )
  order by zh.datum desc
  limit p_limit;
$$;

-- 6. WhatsApp-Nachrichten eines Mieters
create or replace function rpc_agent_whatsapp(
  p_search text,
  p_limit  int default 20
)
returns table(
  zeitstempel   timestamptz,
  richtung      text,
  absender_name text,
  nachricht     text,
  telefonnummer text,
  gelesen       boolean
)
language sql stable security definer as $$
  select
    w.zeitstempel::timestamptz,
    w.richtung,
    w.absender_name,
    w.nachricht,
    w.telefonnummer,
    w.gelesen
  from whatsapp_nachrichten w
  left join mieter m on m.id = w.mieter_id
  where
    m.vorname ilike '%' || p_search || '%'
    or m.nachname ilike '%' || p_search || '%'
    or (m.vorname || ' ' || m.nachname) ilike '%' || p_search || '%'
    or w.absender_name ilike '%' || p_search || '%'
    or w.telefonnummer ilike '%' || p_search || '%'
  order by w.zeitstempel desc
  limit p_limit;
$$;

revoke all on function rpc_agent_upcoming_endings(int) from anon, authenticated;
revoke all on function rpc_agent_tenant_contacts(text) from anon, authenticated;
revoke all on function rpc_agent_property_units(text) from anon, authenticated;
revoke all on function rpc_agent_all_tenants(text) from anon, authenticated;
revoke all on function rpc_agent_meter_history(text, int) from anon, authenticated;
revoke all on function rpc_agent_whatsapp(text, int) from anon, authenticated;
