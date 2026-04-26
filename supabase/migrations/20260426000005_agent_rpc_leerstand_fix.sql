-- leerstand_count: orphaned Einheiten (immobilie_id=null) ausschließen
-- Vorher: count(*) auf einheiten direkt → 16 (inkl. 2 Einheiten ohne Immobilie)
-- Jetzt: INNER JOIN immobilien wie in rpc_agent_vacancies → 14 (konsistent)
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
      join immobilien i on i.id = e.immobilie_id
      where not exists (
        select 1 from mietvertrag v2
        where v2.einheit_id = e.id and v2.status in ('aktiv', 'gekuendigt')
      ))
  );
$$;

revoke all on function rpc_agent_portfolio_summary() from anon, authenticated;
