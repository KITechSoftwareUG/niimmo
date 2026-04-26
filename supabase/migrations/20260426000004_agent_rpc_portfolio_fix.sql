-- Fix 1: rpc_agent_portfolio_summary — echte Mietrückstände statt ist_faellig-Aggregation
-- ist_faellig=true bedeutet nur "Cron lief für diesen Monat", nicht "unbezahlt"
-- Korrekt: Soll (mietforderungen) minus Ist (zahlungen kategorie=Miete) pro Vertrag
create or replace function rpc_agent_portfolio_summary()
returns jsonb
language sql stable security definer as $$
  with vertraege_rueckstand as (
    select
      v.id,
      coalesce(sum(f.sollbetrag), 0) as soll,
      coalesce((
        select sum(z.betrag) filter (where z.kategorie = 'Miete')
        from zahlungen z where z.mietvertrag_id = v.id
      ), 0) as ist
    from mietvertrag v
    left join mietforderungen f on f.mietvertrag_id = v.id
      and f.sollmonat <= date_trunc('month', current_date)
    where v.status in ('aktiv', 'gekuendigt')
    group by v.id
  )
  select jsonb_build_object(
    'immobilien_count',        (select count(*) from immobilien),
    'einheiten_count',         (select count(*) from einheiten),
    'aktive_vertraege',        (select count(*) from mietvertrag where status = 'aktiv'),
    'gekuendigt',              (select count(*) from mietvertrag where status = 'gekuendigt'),
    'kaltmiete_monat',         (select coalesce(sum(kaltmiete), 0) from mietvertrag where status = 'aktiv'),
    'warmmiete_monat',         (select coalesce(sum(kaltmiete + coalesce(betriebskosten, 0)), 0) from mietvertrag where status = 'aktiv'),
    'vertraege_mit_rueckstand',(select count(*) from vertraege_rueckstand where soll - ist > 1),
    'gesamtrueckstand',        (select coalesce(sum(greatest(soll - ist, 0)), 0) from vertraege_rueckstand),
    'mahnfaelle',              (select count(*) from mietvertrag where coalesce(mahnstufe, 0) > 0),
    'darlehen_restschuld',     (select coalesce(sum(restschuld), 0) from darlehen),
    'darlehen_rate',           (select coalesce(sum(monatliche_rate), 0) from darlehen),
    'leerstand_count',         (select count(*) from einheiten e
      where not exists (
        select 1 from mietvertrag v2
        where v2.einheit_id = e.id and v2.status in ('aktiv', 'gekuendigt')
      ))
  );
$$;

-- Fix 2: rpc_agent_outstanding — zeigt Verträge mit echtem Rückstand (Soll > Ist)
-- Vorher: alle mietforderungen mit ist_faellig=true (auch bezahlte Monate!)
-- Jetzt: nur Verträge wo Soll > Ist (echter Mietrückstand)
create or replace function rpc_agent_outstanding(p_search text default null)
returns table(
  mietvertrag_id uuid,
  immobilie      text,
  einheit        text,
  mieter_namen   text,
  kaltmiete      numeric,
  soll_gesamt    numeric,
  ist_gesamt     numeric,
  rueckstand     numeric,
  mahnstufe      int
)
language sql stable security definer as $$
  with soll as (
    select v.id as vertrag_id, coalesce(sum(f.sollbetrag), 0) as soll
    from mietvertrag v
    left join mietforderungen f on f.mietvertrag_id = v.id
      and f.sollmonat <= date_trunc('month', current_date)
    where v.status in ('aktiv', 'gekuendigt')
    group by v.id
  ),
  ist as (
    select mietvertrag_id as vertrag_id,
      coalesce(sum(betrag) filter (where kategorie = 'Miete'), 0) as ist
    from zahlungen
    group by mietvertrag_id
  )
  select
    v.id,
    i.name,
    e.etage,
    (select string_agg(m.vorname || ' ' || m.nachname, ', ')
       from mietvertrag_mieter vm
       join mieter m on m.id = vm.mieter_id
       where vm.mietvertrag_id = v.id),
    v.kaltmiete,
    s.soll,
    coalesce(ist.ist, 0) as ist,
    s.soll - coalesce(ist.ist, 0) as rueckstand,
    v.mahnstufe
  from soll s
  join mietvertrag v on v.id = s.vertrag_id
  left join einheiten e on e.id = v.einheit_id
  left join immobilien i on i.id = e.immobilie_id
  left join ist on ist.vertrag_id = v.id
  where s.soll - coalesce(ist.ist, 0) > 1
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
  order by rueckstand desc
  limit 50;
$$;

revoke all on function rpc_agent_portfolio_summary() from anon, authenticated;
revoke all on function rpc_agent_outstanding(text) from anon, authenticated;
