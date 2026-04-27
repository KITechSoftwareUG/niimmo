-- start_datum, ende_datum, kuendigungsdatum in find_tenants + tenant_balance ergänzen
-- Der Bot wusste bisher nicht wann ein Mietvertrag begann/endet
-- Return-Typ ändert sich → DROP zuerst

drop function if exists rpc_agent_find_tenants(text);
drop function if exists rpc_agent_tenant_balance(text, uuid);

-- find_tenants: mit Vertragsdaten
create or replace function rpc_agent_find_tenants(p_search text)
returns table(
  mieter_id        uuid,
  vorname          text,
  nachname         text,
  hauptmail        text,
  immobilie        text,
  einheit          text,
  vertrag_status   text,
  kaltmiete        numeric,
  warmmiete        numeric,
  mahnstufe        int,
  start_datum      date,
  ende_datum       date,
  kuendigungsdatum date
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
    v.mahnstufe,
    v.start_datum,
    v.ende_datum,
    v.kuendigungsdatum
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

-- tenant_balance: mit Vertragsdaten
create or replace function rpc_agent_tenant_balance(p_search text default null, p_mieter_id uuid default null)
returns table(
  mieter_id        uuid,
  mieter_name      text,
  immobilie        text,
  einheit          text,
  kaltmiete        numeric,
  warmmiete        numeric,
  start_datum      date,
  ende_datum       date,
  kuendigungsdatum date,
  soll_gesamt      numeric,
  ist_gesamt       numeric,
  rueckstand       numeric,
  monate_soll      bigint,
  letzte_zahlung   date
)
language sql stable security definer as $$
  with zielmieter as (
    select m.id, m.vorname || ' ' || m.nachname as name
    from mieter m
    where (p_mieter_id is not null and m.id = p_mieter_id)
       or (p_search is not null and (
            m.vorname ilike '%' || p_search || '%'
         or m.nachname ilike '%' || p_search || '%'
         or (m.vorname || ' ' || m.nachname) ilike '%' || p_search || '%'
       ))
  ),
  vertraege as (
    select distinct v.id as vertrag_id, v.kaltmiete, v.betriebskosten,
      v.start_datum, v.ende_datum, v.kuendigungsdatum,
      vm.mieter_id, e.etage, i.name as immo_name
    from mietvertrag v
    join mietvertrag_mieter vm on vm.mietvertrag_id = v.id
    join einheiten e on e.id = v.einheit_id
    join immobilien i on i.id = e.immobilie_id
    where vm.mieter_id in (select id from zielmieter)
  ),
  soll as (
    select
      vt.mieter_id,
      coalesce(sum(f.sollbetrag), 0) as soll_gesamt,
      count(f.id) as monate_soll
    from vertraege vt
    left join mietforderungen f on f.mietvertrag_id = vt.vertrag_id
      and f.sollmonat <= date_trunc('month', current_date)
    group by vt.mieter_id
  ),
  ist as (
    select
      vt.mieter_id,
      coalesce(sum(z.betrag) filter (where z.kategorie = 'Miete'), 0) as ist_gesamt,
      max(z.buchungsdatum) filter (where z.kategorie = 'Miete') as letzte_zahlung
    from vertraege vt
    left join zahlungen z on z.mietvertrag_id = vt.vertrag_id
    group by vt.mieter_id
  )
  select
    zm.id,
    zm.name,
    vt.immo_name,
    vt.etage,
    vt.kaltmiete,
    vt.kaltmiete + coalesce(vt.betriebskosten, 0) as warmmiete,
    vt.start_datum,
    vt.ende_datum,
    vt.kuendigungsdatum,
    s.soll_gesamt,
    i.ist_gesamt,
    s.soll_gesamt - i.ist_gesamt as rueckstand,
    s.monate_soll,
    i.letzte_zahlung
  from zielmieter zm
  join vertraege vt on vt.mieter_id = zm.id
  join soll s on s.mieter_id = zm.id
  join ist i on i.mieter_id = zm.id
  limit 10;
$$;

revoke all on function rpc_agent_find_tenants(text) from anon, authenticated;
revoke all on function rpc_agent_tenant_balance(text, uuid) from anon, authenticated;
