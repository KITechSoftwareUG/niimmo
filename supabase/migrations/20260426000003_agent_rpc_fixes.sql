-- Fix 1: rpc_agent_find_tenants — Duplikate bei Mietern mit mehreren Verträgen vermeiden
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
  select distinct on (m.id)
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
  left join mietvertrag v on v.id = mv.mietvertrag_id
    and v.status in ('aktiv', 'gekuendigt')
  left join einheiten e on e.id = v.einheit_id
  left join immobilien i on i.id = e.immobilie_id
  where m.vorname ilike '%' || p_search || '%'
     or m.nachname ilike '%' || p_search || '%'
     or (m.vorname || ' ' || m.nachname) ilike '%' || p_search || '%'
  order by m.id, (case when v.status = 'aktiv' then 0 when v.status = 'gekuendigt' then 1 else 2 end)
  limit 5;
$$;

-- Fix 2: rpc_agent_rent_received — klare Felder statt irreführendes total_received
create or replace function rpc_agent_rent_received(p_year int, p_month int)
returns jsonb
language sql stable security definer as $$
  select jsonb_build_object(
    'year', p_year,
    'month', p_month,
    'miete_eingegangen', coalesce(sum(z.betrag) filter (where z.kategorie = 'Miete' and z.betrag > 0), 0),
    'alle_positiven_eingaenge', coalesce(sum(z.betrag) filter (where z.betrag > 0), 0),
    'ruecklastschriften', coalesce(sum(z.betrag) filter (where z.betrag < 0), 0),
    'netto_gesamt', coalesce(sum(z.betrag), 0),
    'anzahl_zahlungen', count(*),
    'anzahl_miete', count(*) filter (where z.kategorie = 'Miete' and z.betrag > 0)
  )
  from zahlungen z
  where extract(year from z.buchungsdatum) = p_year
    and extract(month from z.buchungsdatum) = p_month;
$$;

revoke all on function rpc_agent_find_tenants(text) from anon, authenticated;
revoke all on function rpc_agent_rent_received(int, int) from anon, authenticated;
