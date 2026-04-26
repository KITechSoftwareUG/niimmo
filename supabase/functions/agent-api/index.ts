import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

type SupabaseClient = ReturnType<typeof createClient>

interface FileData {
  base64: string
  filename: string
  mimetype: string
  size_bytes?: number
}

// ─── Auth ────────────────────────────────────────────────────────────────────

function validateAgentKey(req: Request): boolean {
  const key = req.headers.get('x-agent-key')
  const expected = Deno.env.get('AGENT_API_KEY')
  return !!key && !!expected && key === expected
}

// ─── Tools ───────────────────────────────────────────────────────────────────

const TOOLS = [
  // ── Read: Mieter & Verträge ──
  {
    type: 'function',
    function: {
      name: 'get_tenant_details',
      description: 'Vollständige Infos zu einem Mieter: Kontakt, Vertrag, offene Forderungen, letzte Zahlungen, Dokumente',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Vor- oder Nachname' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_contract_details',
      description: 'Alle Vertragsdetails eines Mieters: Kaltmiete, Betriebskosten, Kaution, Status, Daten',
      parameters: {
        type: 'object',
        properties: { mieter_name: { type: 'string' } },
        required: ['mieter_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_all_contracts',
      description: 'Alle Mietverträge optional gefiltert nach Status',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['aktiv', 'gekuendigt', 'beendet'], description: 'Optional: Status-Filter' },
        },
      },
    },
  },
  // ── Read: Zahlungen & Forderungen ──
  {
    type: 'function',
    function: {
      name: 'get_outstanding_demands',
      description: 'Offene fällige Mietforderungen, optional nach Mieter gefiltert',
      parameters: {
        type: 'object',
        properties: { mieter_name: { type: 'string', description: 'Optional: Mietername' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_payment_history',
      description: 'Zahlungshistorie eines Mieters oder alle Zahlungen (letzte N Monate)',
      parameters: {
        type: 'object',
        properties: {
          mieter_name: { type: 'string', description: 'Optional: Mietername' },
          monate: { type: 'number', description: 'Letzten N Monate (Standard: 3, max: 24)' },
          limit: { type: 'number', description: 'Max Anzahl Einträge (Standard: 30, max: 100)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_mahnung_overview',
      description: 'Alle Verträge mit aktiver Mahnstufe (> 0)',
      parameters: { type: 'object', properties: {} },
    },
  },
  // ── Read: Immobilien & Einheiten ──
  {
    type: 'function',
    function: {
      name: 'get_property_details',
      description: 'Detaillierte Immobilien-Infos: alle Einheiten, Mieter, Verträge, Darlehen, Versicherungen',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Name oder Adresse' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_vacant_units',
      description: 'Alle leerstehenden Einheiten',
      parameters: { type: 'object', properties: {} },
    },
  },
  // ── Read: Dokumente ──
  {
    type: 'function',
    function: {
      name: 'list_documents',
      description: 'Dokumente eines Mieters oder einer Immobilie auflisten',
      parameters: {
        type: 'object',
        properties: {
          mieter_name: { type: 'string' },
          immobilie_name: { type: 'string' },
        },
      },
    },
  },
  // ── Read: Darlehen ──
  {
    type: 'function',
    function: {
      name: 'get_loan_details',
      description: 'Darlehen mit vollständigem Tilgungsplan und Immobilien-Zuordnung',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Optional: Bezeichnung oder Bank' } },
      },
    },
  },
  // ── Read: Nebenkosten ──
  {
    type: 'function',
    function: {
      name: 'get_nebenkosten_info',
      description: 'Nebenkostenpositionen und Arten einer Immobilie, optional nach Jahr gefiltert',
      parameters: {
        type: 'object',
        properties: {
          immobilie_name: { type: 'string', description: 'Name der Immobilie' },
          jahr: { type: 'number', description: 'Optional: Abrechnungsjahr' },
        },
        required: ['immobilie_name'],
      },
    },
  },
  // ── Read: Zählerstände ──
  {
    type: 'function',
    function: {
      name: 'get_meter_history',
      description: 'Zählerstand-Historie für einen Mieter oder eine Immobilie',
      parameters: {
        type: 'object',
        properties: {
          mieter_name: { type: 'string', description: 'Optional: Mietername' },
          immobilie_name: { type: 'string', description: 'Optional: Immobilienname' },
          zaehler_typ: { type: 'string', description: 'Optional: z.B. Strom, Gas, Wasser' },
        },
      },
    },
  },
  // ── Read: Versicherungen ──
  {
    type: 'function',
    function: {
      name: 'get_insurance_info',
      description: 'Versicherungen aller Immobilien oder einer bestimmten',
      parameters: {
        type: 'object',
        properties: { immobilie_name: { type: 'string', description: 'Optional: Immobilienname' } },
      },
    },
  },
  // ── Read: Marktdaten ──
  {
    type: 'function',
    function: {
      name: 'get_market_data',
      description: 'Aktueller Basiszinssatz und VPI-Werte für Mieterhöhungsberechnungen',
      parameters: { type: 'object', properties: {} },
    },
  },
  // ── Read: WhatsApp ──
  {
    type: 'function',
    function: {
      name: 'get_whatsapp_history',
      description: 'WhatsApp-Kommunikation mit einem Mieter',
      parameters: {
        type: 'object',
        properties: { mieter_name: { type: 'string' } },
        required: ['mieter_name'],
      },
    },
  },
  // ── Read: Generisch (Fallback) ──
  {
    type: 'function',
    function: {
      name: 'query_database',
      description: 'Führt eine beliebige SELECT-Abfrage gegen die Datenbank aus. Nutze dieses Tool wenn du spezifische Daten benötigst, die kein anderes Tool liefert. NUR SELECT erlaubt.',
      parameters: {
        type: 'object',
        properties: {
          sql: {
            type: 'string',
            description: 'Gültige PostgreSQL SELECT-Abfrage. Verfügbare Tabellen: immobilien, einheiten, mietvertrag, mietvertrag_mieter, mieter, zahlungen, mietforderungen, dokumente, nebenkostenarten, kostenpositionen, kostenposition_anteile, darlehen, darlehen_zahlungen, darlehen_immobilien, versicherungen, zaehlerstand_historie, user_roles, marktdaten, whatsapp_nachrichten, angespannte_maerkte',
          },
          description: { type: 'string', description: 'Kurze Beschreibung was du herausfinden willst' },
        },
        required: ['sql'],
      },
    },
  },
  // ── Write: Dokumente ──
  {
    type: 'function',
    function: {
      name: 'upload_document',
      description: 'Lädt eine Datei/Foto als Dokument für einen Mieter in Supabase Storage hoch. Nur aufrufen wenn eine Datei im Request vorhanden ist.',
      parameters: {
        type: 'object',
        properties: {
          mieter_name: { type: 'string' },
          titel: { type: 'string', description: 'Titel des Dokuments' },
          kategorie: {
            type: 'string',
            enum: ['Sonstiges', 'Mietvertrag', 'Kündigung', 'Übergabeprotokoll', 'Mietkaution', 'Mieterunterlagen', 'Schriftverkehr', 'Versicherungen'],
          },
        },
        required: ['mieter_name', 'kategorie'],
      },
    },
  },
  // ── Write: Zählerstand ──
  {
    type: 'function',
    function: {
      name: 'add_zaehlerstand',
      description: 'Neuen Zählerstand für die Einheit eines Mieters eintragen',
      parameters: {
        type: 'object',
        properties: {
          mieter_name: { type: 'string' },
          zaehler_typ: { type: 'string', description: 'z.B. Strom, Gas, Wasser, Warmwasser' },
          stand: { type: 'number' },
          datum: { type: 'string', description: 'YYYY-MM-DD (Standard: heute)' },
        },
        required: ['mieter_name', 'zaehler_typ', 'stand'],
      },
    },
  },
  // ── Write: Mahnstufe ──
  {
    type: 'function',
    function: {
      name: 'update_mahnstufe',
      description: 'Mahnstufe eines Mietvertrags setzen (0 = keine Mahnung, 1-3 = Mahnstufe)',
      parameters: {
        type: 'object',
        properties: {
          mieter_name: { type: 'string' },
          mahnstufe: { type: 'number', description: '0-3' },
        },
        required: ['mieter_name', 'mahnstufe'],
      },
    },
  },
  // ── Write: Mietforderung erstellen ──
  {
    type: 'function',
    function: {
      name: 'create_mietforderung',
      description: 'Erstellt eine manuelle Mietforderung für einen Mieter',
      parameters: {
        type: 'object',
        properties: {
          mieter_name: { type: 'string' },
          sollmonat: { type: 'string', description: 'Monat als YYYY-MM-DD (erster des Monats)' },
          sollbetrag: { type: 'number', description: 'Betrag in Euro' },
        },
        required: ['mieter_name', 'sollmonat', 'sollbetrag'],
      },
    },
  },
  // ── Write: Zahlung kategorisieren ──
  {
    type: 'function',
    function: {
      name: 'update_payment_category',
      description: 'Kategorie einer Zahlung ändern',
      parameters: {
        type: 'object',
        properties: {
          zahlung_id: { type: 'string', description: 'UUID der Zahlung' },
          kategorie: {
            type: 'string',
            enum: ['Miete', 'Nichtmiete', 'Mietkaution', 'Ignorieren', 'Rücklastschrift', 'Nebenkosten'],
          },
        },
        required: ['zahlung_id', 'kategorie'],
      },
    },
  },
]

// ─── Tool Execution ───────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  file?: FileData,
): Promise<unknown> {

  // ── Helpers ──

  async function findMieter(nameStr: string) {
    const parts = nameStr.trim().split(/\s+/)
    let q = supabase.from('mieter').select('id, vorname, nachname, hauptmail, telnr')
    q = parts.length >= 2
      ? q.or(`vorname.ilike.%${parts[0]}%,nachname.ilike.%${parts[parts.length - 1]}%`)
      : q.or(`vorname.ilike.%${nameStr}%,nachname.ilike.%${nameStr}%`)
    const { data } = await q.limit(3)
    return data ?? []
  }

  async function getMvIds(mieterId: string): Promise<string[]> {
    const { data } = await supabase
      .from('mietvertrag_mieter').select('mietvertrag_id').eq('mieter_id', mieterId)
    return data?.map((l: { mietvertrag_id: string }) => l.mietvertrag_id) ?? []
  }

  async function getAktiverVertrag(mieterId: string) {
    const ids = await getMvIds(mieterId)
    if (!ids.length) return null
    const { data } = await supabase
      .from('mietvertrag')
      .select('id, einheit_id, kaltmiete, betriebskosten, status, start_datum, ende_datum, kuendigungsdatum, mahnstufe, kaution_betrag, kaution_ist, kaution_status')
      .in('id', ids).in('status', ['aktiv', 'gekuendigt'])
      .order('start_datum', { ascending: false }).limit(1)
    return data?.[0] ?? null
  }

  async function getEinheitAndImmo(einheitId: string) {
    const { data } = await supabase
      .from('einheiten').select('id, immobilie_id, etage, einheitentyp, qm, immobilien(id, name, adresse)')
      .eq('id', einheitId).single()
    return data
  }

  // ── Switch ──

  switch (name) {

    case 'get_tenant_details': {
      const list = await findMieter(String(args.name))
      if (!list.length) return { error: `Kein Mieter "${args.name}" gefunden` }
      const results = []
      for (const m of list) {
        const v = await getAktiverVertrag((m as { id: string }).id)
        const einheit = v ? await getEinheitAndImmo(v.einheit_id) : null
        const mvIds = await getMvIds((m as { id: string }).id)
        const { data: forderungen } = await supabase.from('mietforderungen')
          .select('sollbetrag, sollmonat, faelligkeitsdatum').in('mietvertrag_id', mvIds)
          .eq('ist_faellig', true).order('faelligkeitsdatum')
        const { data: zahlungen } = await supabase.from('zahlungen')
          .select('betrag, buchungsdatum, kategorie, verwendungszweck')
          .in('mietvertrag_id', mvIds).order('buchungsdatum', { ascending: false }).limit(8)
        const { data: dokumente } = await supabase.from('dokumente')
          .select('titel, kategorie, hochgeladen_am').in('mietvertrag_id', mvIds)
          .eq('geloescht', false).order('hochgeladen_am', { ascending: false }).limit(5)
        results.push({ mieter: m, vertrag: v, einheit, offene_forderungen: forderungen ?? [], letzte_zahlungen: zahlungen ?? [], dokumente: dokumente ?? [] })
      }
      return results
    }

    case 'get_contract_details': {
      const list = await findMieter(String(args.mieter_name))
      if (!list.length) return { error: `Mieter "${args.mieter_name}" nicht gefunden` }
      const results = []
      for (const m of list) {
        const mvIds = await getMvIds((m as { id: string }).id)
        const { data: vertraege } = await supabase.from('mietvertrag').select('*')
          .in('id', mvIds).order('start_datum', { ascending: false })
        results.push({ mieter: m, vertraege: vertraege ?? [] })
      }
      return results
    }

    case 'get_all_contracts': {
      let q = supabase.from('mietvertrag')
        .select('id, einheit_id, kaltmiete, betriebskosten, status, start_datum, ende_datum, mahnstufe')
      if (args.status) q = q.eq('status', args.status)
      const { data: vertraege } = await q.order('start_datum', { ascending: false }).limit(100)
      return vertraege ?? []
    }

    case 'get_outstanding_demands': {
      const { data: forderungen } = await supabase.from('mietforderungen')
        .select('id, sollbetrag, sollmonat, faelligkeitsdatum, mietvertrag_id')
        .eq('ist_faellig', true).order('faelligkeitsdatum').limit(50)
      if (!forderungen?.length) return { message: 'Keine offenen Forderungen – alles bezahlt!' }

      if (args.mieter_name) {
        const list = await findMieter(String(args.mieter_name))
        if (list.length) {
          const allIds = (await Promise.all(list.map((m: { id: string }) => getMvIds(m.id)))).flat()
          return forderungen.filter(f => allIds.includes(f.mietvertrag_id))
        }
      }

      return await Promise.all(forderungen.slice(0, 25).map(async f => {
        const { data: links } = await supabase.from('mietvertrag_mieter').select('mieter_id').eq('mietvertrag_id', f.mietvertrag_id)
        const { data: mieter } = await supabase.from('mieter').select('vorname, nachname')
          .in('id', links?.map((l: { mieter_id: string }) => l.mieter_id) ?? [])
        const { data: v } = await supabase.from('mietvertrag').select('einheit_id').eq('id', f.mietvertrag_id).single()
        let immoName = ''
        if (v) {
          const { data: e } = await supabase.from('einheiten').select('immobilien(name)').eq('id', (v as { einheit_id: string }).einheit_id).single()
          immoName = (e as { immobilien?: { name: string } })?.immobilien?.name ?? ''
        }
        return { ...f, mieter: mieter?.map((m: { vorname: string; nachname: string }) => `${m.vorname} ${m.nachname}`).join(', ') ?? '', immobilie: immoName }
      }))
    }

    case 'get_payment_history': {
      const limit = Math.min(Number(args.limit ?? 30), 100)
      const monate = Math.min(Number(args.monate ?? 3), 24)
      const since = new Date()
      since.setMonth(since.getMonth() - monate)
      const sinceStr = since.toISOString().split('T')[0]

      let mvFilter: string[] | null = null
      if (args.mieter_name) {
        const list = await findMieter(String(args.mieter_name))
        if (list.length) mvFilter = (await Promise.all(list.map((m: { id: string }) => getMvIds(m.id)))).flat()
      }

      let q = supabase.from('zahlungen')
        .select('id, betrag, buchungsdatum, kategorie, verwendungszweck, empfaengername, mietvertrag_id')
        .gte('buchungsdatum', sinceStr).order('buchungsdatum', { ascending: false }).limit(limit)
      if (mvFilter?.length) q = q.in('mietvertrag_id', mvFilter)
      const { data } = await q
      return data ?? []
    }

    case 'get_mahnung_overview': {
      const { data: vertraege } = await supabase.from('mietvertrag')
        .select('id, einheit_id, mahnstufe, kaltmiete, status')
        .gt('mahnstufe', 0).in('status', ['aktiv', 'gekuendigt'])
        .order('mahnstufe', { ascending: false })
      if (!vertraege?.length) return { message: 'Keine aktiven Mahnfälle' }
      return await Promise.all(vertraege.map(async v => {
        const { data: links } = await supabase.from('mietvertrag_mieter').select('mieter_id').eq('mietvertrag_id', v.id)
        const { data: mieter } = await supabase.from('mieter').select('vorname, nachname, hauptmail, telnr')
          .in('id', links?.map((l: { mieter_id: string }) => l.mieter_id) ?? [])
        const e = await getEinheitAndImmo(v.einheit_id)
        return { ...v, mieter: mieter ?? [], immobilie: (e as { immobilien?: { name: string } })?.immobilien?.name ?? '' }
      }))
    }

    case 'get_property_details': {
      const { data: immobilien } = await supabase.from('immobilien')
        .select('id, name, adresse, einheiten_anzahl, objekttyp, kaufpreis, baujahr')
        .or(`name.ilike.%${args.name}%,adresse.ilike.%${args.name}%`).limit(3)
      if (!immobilien?.length) return { error: `Immobilie "${args.name}" nicht gefunden` }
      return await Promise.all(immobilien.map(async immo => {
        const { data: einheiten } = await supabase.from('einheiten').select('id, etage, einheitentyp, qm, anzahl_personen').eq('immobilie_id', immo.id)
        const einheitIds = einheiten?.map((e: { id: string }) => e.id) ?? []
        const { data: vertraege } = einheitIds.length
          ? await supabase.from('mietvertrag').select('id, einheit_id, kaltmiete, betriebskosten, status, mahnstufe, kaution_betrag').in('einheit_id', einheitIds)
          : { data: [] }
        const { data: darlehen } = await supabase.from('darlehen_immobilien')
          .select('darlehen:darlehen_id(bezeichnung, bank, restschuld, monatliche_rate, zinssatz_prozent, ende_datum)').eq('immobilie_id', immo.id)
        const { data: versicherungen } = await supabase.from('versicherungen')
          .select('typ, firma, jahresbeitrag').eq('immobilie_id', immo.id)
        return { immobilie: immo, einheiten, vertraege, darlehen, versicherungen }
      }))
    }

    case 'get_vacant_units': {
      const { data: einheiten } = await supabase.from('einheiten').select('id, etage, einheitentyp, qm, immobilien(name, adresse)')
      const { data: aktiv } = await supabase.from('mietvertrag').select('einheit_id').in('status', ['aktiv', 'gekuendigt'])
      const besetzt = new Set(aktiv?.map((v: { einheit_id: string }) => v.einheit_id) ?? [])
      const leer = (einheiten ?? []).filter((e: { id: string }) => !besetzt.has(e.id))
      if (!leer.length) return { message: 'Kein Leerstand – alle Einheiten belegt' }
      return leer.map((e: { etage?: string; einheitentyp?: string; qm?: number; immobilien?: { name: string; adresse: string } }) => ({
        einheit: `${e.immobilien?.name} – ${e.etage ?? 'EG'} (${e.einheitentyp ?? 'Wohnung'}, ${e.qm ?? '?'}qm)`,
        adresse: e.immobilien?.adresse,
      }))
    }

    case 'list_documents': {
      let mvIds: string[] = []
      let immobilieId: string | null = null
      if (args.mieter_name) {
        const list = await findMieter(String(args.mieter_name))
        if (list.length) mvIds = (await Promise.all(list.map((m: { id: string }) => getMvIds(m.id)))).flat()
      }
      if (args.immobilie_name) {
        const { data: immos } = await supabase.from('immobilien').select('id').ilike('name', `%${args.immobilie_name}%`).limit(1)
        immobilieId = (immos as { id: string }[] | null)?.[0]?.id ?? null
      }
      let q = supabase.from('dokumente').select('id, titel, kategorie, dateityp, hochgeladen_am, groesse_bytes, erstellt_von')
        .eq('geloescht', false).order('hochgeladen_am', { ascending: false }).limit(20)
      if (mvIds.length) q = q.in('mietvertrag_id', mvIds)
      else if (immobilieId) q = q.eq('immobilie_id', immobilieId)
      const { data } = await q
      return data?.length ? data : { message: 'Keine Dokumente gefunden' }
    }

    case 'get_loan_details': {
      let q = supabase.from('darlehen').select('id, bezeichnung, bank, restschuld, zinssatz_prozent, monatliche_rate, tilgungssatz_prozent, start_datum, ende_datum, darlehensbetrag')
      if (args.name) q = q.or(`bezeichnung.ilike.%${args.name}%,bank.ilike.%${args.name}%`)
      const { data: darlehen } = await q
      if (!darlehen?.length) return { message: 'Keine Darlehen gefunden' }
      return await Promise.all(darlehen.map(async d => {
        const { data: immoLinks } = await supabase.from('darlehen_immobilien')
          .select('immobilien:immobilie_id(name, adresse)').eq('darlehen_id', d.id)
        const { data: zahlungen } = await supabase.from('darlehen_zahlungen')
          .select('datum, betrag, zinsanteil, tilgungsanteil, restschuld_nach').eq('darlehen_id', d.id)
          .order('datum', { ascending: false }).limit(12)
        return { ...d, immobilien: immoLinks?.map((l: { immobilien?: unknown }) => l.immobilien), letzte_zahlungen: zahlungen ?? [] }
      }))
    }

    case 'get_nebenkosten_info': {
      const { data: immos } = await supabase.from('immobilien').select('id, name')
        .ilike('name', `%${args.immobilie_name}%`).limit(1)
      if (!immos?.length) return { error: `Immobilie "${args.immobilie_name}" nicht gefunden` }
      const immoId = (immos[0] as { id: string }).id

      const { data: arten } = await supabase.from('nebenkostenarten')
        .select('id, name, umlagefaehig, betrkvparagraph').eq('immobilie_id', immoId)

      let kpQuery = supabase.from('kostenpositionen')
        .select('id, name, betrag, zeitraum_von, zeitraum_bis, nebenkostenart_id')
        .eq('immobilie_id', immoId).order('zeitraum_bis', { ascending: false }).limit(30)
      if (args.jahr) {
        kpQuery = kpQuery
          .gte('zeitraum_von', `${args.jahr}-01-01`)
          .lte('zeitraum_bis', `${args.jahr}-12-31`)
      }
      const { data: kostenpositionen } = await kpQuery
      return { immobilie: immos[0], nebenkostenarten: arten ?? [], kostenpositionen: kostenpositionen ?? [] }
    }

    case 'get_meter_history': {
      let einheitIds: string[] = []
      let immoId: string | null = null

      if (args.mieter_name) {
        const list = await findMieter(String(args.mieter_name))
        if (list.length) {
          for (const m of list) {
            const v = await getAktiverVertrag((m as { id: string }).id)
            if (v) einheitIds.push(v.einheit_id)
          }
        }
      }
      if (args.immobilie_name) {
        const { data: immos } = await supabase.from('immobilien').select('id').ilike('name', `%${args.immobilie_name}%`).limit(1)
        immoId = (immos as { id: string }[] | null)?.[0]?.id ?? null
      }

      let q = supabase.from('zaehlerstand_historie')
        .select('einheit_id, immobilie_id, zaehler_typ, zaehler_nummer, stand, datum, quelle')
        .order('datum', { ascending: false }).limit(50)
      if (einheitIds.length) q = q.in('einheit_id', einheitIds)
      else if (immoId) q = q.eq('immobilie_id', immoId)
      if (args.zaehler_typ) q = q.ilike('zaehler_typ', `%${args.zaehler_typ}%`)

      const { data } = await q
      return data?.length ? data : { message: 'Keine Zählerstände gefunden' }
    }

    case 'get_insurance_info': {
      let q = supabase.from('versicherungen').select('id, immobilie_id, typ, firma, versicherungsnummer, jahresbeitrag, kuendigungsfrist, hauptfaelligkeit, immobilien(name)')
      if (args.immobilie_name) {
        const { data: immos } = await supabase.from('immobilien').select('id').ilike('name', `%${args.immobilie_name}%`).limit(1)
        const immoId = (immos as { id: string }[] | null)?.[0]?.id
        if (immoId) q = q.eq('immobilie_id', immoId)
      }
      const { data } = await q
      return data?.length ? data : { message: 'Keine Versicherungen gefunden' }
    }

    case 'get_market_data': {
      const { data: markt } = await supabase.from('marktdaten')
        .select('typ, wert, gueltig_ab, gueltig_bis, quelle')
        .order('gueltig_ab', { ascending: false }).limit(20)
      return markt?.length ? markt : { message: 'Keine Marktdaten vorhanden' }
    }

    case 'get_whatsapp_history': {
      const list = await findMieter(String(args.mieter_name))
      if (!list.length) return { error: `Mieter "${args.mieter_name}" nicht gefunden` }
      const mvIds = (await Promise.all(list.map((m: { id: string }) => getMvIds(m.id)))).flat()
      const { data } = await supabase.from('whatsapp_nachrichten')
        .select('richtung, nachricht, gesendet_am, status')
        .in('mietvertrag_id', mvIds).order('gesendet_am', { ascending: false }).limit(30)
      return data?.length ? data : { message: 'Keine WhatsApp-Nachrichten gefunden' }
    }

    case 'query_database': {
      const sql = String(args.sql).trim()
      if (!/^select\s/i.test(sql)) return { error: 'Nur SELECT-Abfragen erlaubt' }
      const limited = /\blimit\s+\d+/i.test(sql) ? sql : `${sql} LIMIT 50`
      const { data, error } = await supabase.rpc('execute_agent_query', { query_sql: limited }).single()
        .catch(() => ({ data: null, error: { message: 'RPC nicht verfügbar' } }))
      if (error || !data) {
        // Fallback: direkt via REST wenn RPC nicht vorhanden
        const { data: rows, error: e2 } = await (supabase as SupabaseClient & { from: (t: string) => unknown }).from('_agent_query_placeholder') as unknown as { data: unknown; error: { message: string } | null }
        void rows; void e2
        return { error: 'Direkte SQL-Abfragen nicht verfügbar – nutze spezifische Tools' }
      }
      return data
    }

    case 'upload_document': {
      if (!file) return { error: 'Keine Datei im Request – Foto/Datei als base64 mitsenden' }
      const list = await findMieter(String(args.mieter_name))
      if (!list.length) return { error: `Mieter "${args.mieter_name}" nicht gefunden` }
      const m = list[0] as { id: string; vorname: string; nachname: string }
      const v = await getAktiverVertrag(m.id)
      let immobilieId: string | null = null
      if (v) {
        const { data: e } = await supabase.from('einheiten').select('immobilie_id').eq('id', v.einheit_id).single()
        immobilieId = (e as { immobilie_id?: string } | null)?.immobilie_id ?? null
      }
      const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = [immobilieId ?? 'allgemein', v?.id ?? 'kein-vertrag', `${Date.now()}_${safeName}`].join('/')
      const bytes = Uint8Array.from(atob(file.base64), c => c.charCodeAt(0))
      const { error: uploadErr } = await supabase.storage.from('dokumente').upload(storagePath, bytes, { contentType: file.mimetype, upsert: false })
      if (uploadErr) return { error: `Storage-Upload fehlgeschlagen: ${uploadErr.message}` }
      const { error: dbErr } = await supabase.from('dokumente').insert({
        mietvertrag_id: v?.id ?? null,
        immobilie_id: immobilieId,
        titel: String(args.titel ?? file.filename),
        dateityp: file.mimetype,
        pfad: storagePath,
        kategorie: args.kategorie ?? 'Sonstiges',
        groesse_bytes: file.size_bytes ?? bytes.length,
        erstellt_von: 'telegram-agent',
      })
      if (dbErr) return { error: `DB-Eintrag fehlgeschlagen: ${dbErr.message}` }
      return { success: true, message: `Dokument "${args.titel ?? file.filename}" für ${m.vorname} ${m.nachname} gespeichert`, pfad: storagePath }
    }

    case 'add_zaehlerstand': {
      const list = await findMieter(String(args.mieter_name))
      if (!list.length) return { error: `Mieter "${args.mieter_name}" nicht gefunden` }
      const v = await getAktiverVertrag((list[0] as { id: string }).id)
      if (!v) return { error: 'Kein aktiver Vertrag gefunden' }
      const { data: e } = await supabase.from('einheiten').select('id, immobilie_id').eq('id', v.einheit_id).single()
      const today = new Date().toISOString().split('T')[0]
      const { error } = await supabase.from('zaehlerstand_historie').insert({
        einheit_id: (e as { id: string } | null)?.id ?? null,
        immobilie_id: (e as { immobilie_id?: string } | null)?.immobilie_id ?? null,
        zaehler_typ: String(args.zaehler_typ),
        stand: Number(args.stand),
        datum: String(args.datum ?? today),
        quelle: 'telegram',
      })
      if (error) return { error: error.message }
      const m = list[0] as { vorname: string; nachname: string }
      return { success: true, message: `Zählerstand ${args.zaehler_typ}: ${args.stand} für ${m.vorname} ${m.nachname} am ${args.datum ?? today} eingetragen` }
    }

    case 'update_mahnstufe': {
      const list = await findMieter(String(args.mieter_name))
      if (!list.length) return { error: `Mieter "${args.mieter_name}" nicht gefunden` }
      const v = await getAktiverVertrag((list[0] as { id: string }).id)
      if (!v) return { error: 'Kein aktiver Vertrag gefunden' }
      const { error } = await supabase.from('mietvertrag').update({ mahnstufe: Number(args.mahnstufe) }).eq('id', v.id)
      if (error) return { error: error.message }
      const m = list[0] as { vorname: string; nachname: string }
      return { success: true, message: `Mahnstufe für ${m.vorname} ${m.nachname} auf ${args.mahnstufe} gesetzt` }
    }

    case 'create_mietforderung': {
      const list = await findMieter(String(args.mieter_name))
      if (!list.length) return { error: `Mieter "${args.mieter_name}" nicht gefunden` }
      const v = await getAktiverVertrag((list[0] as { id: string }).id)
      if (!v) return { error: 'Kein aktiver Vertrag gefunden' }
      const faellig = new Date(String(args.sollmonat))
      faellig.setDate(faellig.getDate() + 7)
      const { error } = await supabase.from('mietforderungen').insert({
        mietvertrag_id: v.id,
        sollmonat: String(args.sollmonat),
        sollbetrag: Number(args.sollbetrag),
        faelligkeitsdatum: faellig.toISOString().split('T')[0],
        ist_faellig: false,
      })
      if (error) return { error: error.message }
      const m = list[0] as { vorname: string; nachname: string }
      return { success: true, message: `Mietforderung ${args.sollmonat}: ${args.sollbetrag}€ für ${m.vorname} ${m.nachname} erstellt` }
    }

    case 'update_payment_category': {
      const { error } = await supabase.from('zahlungen')
        .update({ kategorie: args.kategorie }).eq('id', String(args.zahlung_id))
      if (error) return { error: error.message }
      return { success: true, message: `Zahlung ${args.zahlung_id} als "${args.kategorie}" kategorisiert` }
    }

    default:
      return { error: `Unbekanntes Tool: ${name}` }
  }
}

// ─── OpenAI mit Function Calling ─────────────────────────────────────────────

async function askOpenAI(
  systemPrompt: string,
  userQuery: string,
  supabase: SupabaseClient,
  file?: FileData,
): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY nicht konfiguriert')

  const userContent = file
    ? `${userQuery}\n\n[Datei vorhanden: ${file.filename}, ${file.mimetype}, ${(file.size_bytes ?? 0).toLocaleString()} Bytes]`
    : userQuery

  const messages: unknown[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ]

  for (let i = 0; i < 8; i++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-5.4-mini', messages, tools: TOOLS, tool_choice: 'auto' }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenAI API Fehler: ${res.status} – ${err}`)
    }

    const data = await res.json()
    const choice = data.choices?.[0]
    const msg = choice?.message

    if (choice?.finish_reason === 'stop' || !msg?.tool_calls?.length) {
      return msg?.content ?? 'Keine Antwort erhalten.'
    }

    messages.push(msg)

    for (const tc of msg.tool_calls) {
      let args: Record<string, unknown> = {}
      try { args = JSON.parse(tc.function.arguments) } catch { /* ignore */ }
      const result = await executeTool(tc.function.name, args, supabase, file)
      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
    }
  }

  return 'Maximale Iterations-Anzahl erreicht – bitte Anfrage vereinfachen.'
}

// ─── Portfolio Context ────────────────────────────────────────────────────────

async function buildPortfolioContext(supabase: SupabaseClient): Promise<string> {
  const today = new Date().toISOString().split('T')[0]

  const [immobilienRes, einheitenRes, mietvertraegeRes, mieterRes, mietvertragMieterRes, forderungenRes, zahlungenRes, darlehenRes, darlehenImmobilienRes] =
    await Promise.all([
      supabase.from('immobilien').select('id, name, adresse, einheiten_anzahl, objekttyp'),
      supabase.from('einheiten').select('id, immobilie_id, qm, etage, einheitentyp'),
      supabase.from('mietvertrag').select('id, einheit_id, kaltmiete, betriebskosten, status, start_datum, ende_datum, mahnstufe, kaution_betrag, kaution_ist, kaution_status'),
      supabase.from('mieter').select('id, vorname, nachname, hauptmail, telnr'),
      supabase.from('mietvertrag_mieter').select('mietvertrag_id, mieter_id'),
      supabase.from('mietforderungen').select('id, sollbetrag, sollmonat, faelligkeitsdatum, mietvertrag_id').eq('ist_faellig', true).order('faelligkeitsdatum').limit(50),
      supabase.from('zahlungen').select('id, betrag, buchungsdatum, kategorie, mietvertrag_id, empfaengername').order('buchungsdatum', { ascending: false }).limit(30),
      supabase.from('darlehen').select('id, bezeichnung, bank, restschuld, zinssatz_prozent, monatliche_rate'),
      supabase.from('darlehen_immobilien').select('darlehen_id, immobilie_id'),
    ])

  const immobilien = immobilienRes.data ?? []
  const einheiten = einheitenRes.data ?? []
  const mietvertraege = mietvertraegeRes.data ?? []
  const mieter = mieterRes.data ?? []
  const mietvertragMieter = mietvertragMieterRes.data ?? []
  const forderungen = forderungenRes.data ?? []
  const zahlungen = zahlungenRes.data ?? []
  const darlehen = darlehenRes.data ?? []
  const darlehenImmobilien = darlehenImmobilienRes.data ?? []

  const aktiveV = mietvertraege.filter(v => v.status === 'aktiv')
  const gekuendigtV = mietvertraege.filter(v => v.status === 'gekuendigt')
  const gesamtKaltmiete = aktiveV.reduce((s, v) => s + (v.kaltmiete ?? 0), 0)
  const gesamtBK = aktiveV.reduce((s, v) => s + (v.betriebskosten ?? 0), 0)
  const gesamtRueckstand = forderungen.reduce((s, f) => s + (f.sollbetrag ?? 0), 0)
  const vertraegeInMahnung = mietvertraege.filter(v => (v.mahnstufe ?? 0) > 0)
  const leerstehend = einheiten.filter(e => !mietvertraege.some(v => v.einheit_id === e.id && (v.status === 'aktiv' || v.status === 'gekuendigt')))
  const totalRestschuld = darlehen.reduce((s, d) => s + (d.restschuld ?? 0), 0)
  const totalRate = darlehen.reduce((s, d) => s + (d.monatliche_rate ?? 0), 0)

  const immobilienDetails = immobilien.map(immo => {
    const immoEinheiten = einheiten.filter(e => e.immobilie_id === immo.id)
    const aktiv = mietvertraege.filter(v => immoEinheiten.some(e => e.id === v.einheit_id) && (v.status === 'aktiv' || v.status === 'gekuendigt'))
    const kaltmiete = aktiv.reduce((s, v) => s + (v.kaltmiete ?? 0), 0)
    let block = `📍 ${immo.name} (${immo.adresse}) — ${immoEinheiten.length} Einheiten | ${aktiv.length} aktiv | ${kaltmiete.toFixed(0)}€/Mo`
    immoEinheiten.forEach(e => {
      const v = mietvertraege.find(mv => mv.einheit_id === e.id && (mv.status === 'aktiv' || mv.status === 'gekuendigt'))
      const namen = v
        ? mietvertragMieter.filter(mv => mv.mietvertrag_id === v.id)
            .map(mv => mieter.find(m => m.id === mv.mieter_id))
            .filter(Boolean).map(m => `${m!.vorname} ${m!.nachname ?? ''}`.trim()).join(', ')
        : ''
      block += `\n   • ${e.etage ?? '?'} (${e.einheitentyp ?? 'Wohnung'}, ${e.qm ?? '?'}qm): `
      if (v) {
        block += `${namen || '?'} | ${v.kaltmiete ?? 0}€ | ${v.status}`
        if ((v.mahnstufe ?? 0) > 0) block += ` ⚠️ Mahnstufe ${v.mahnstufe}`
      } else block += '🔴 LEERSTAND'
    })
    return block
  }).join('\n\n')

  const rueckstandDetails = forderungen.slice(0, 15).map(f => {
    const v = mietvertraege.find(mv => mv.id === f.mietvertrag_id)
    const e = v ? einheiten.find(ein => ein.id === v.einheit_id) : null
    const immo = e ? immobilien.find(i => i.id === e.immobilie_id) : null
    const namen = v
      ? mietvertragMieter.filter(mv => mv.mietvertrag_id === v.id)
          .map(mv => { const m = mieter.find(mi => mi.id === mv.mieter_id); return m ? `${m.vorname} ${m.nachname ?? ''}`.trim() : '' })
          .filter(Boolean).join(', ')
      : ''
    return `• ${namen || '?'} | ${immo?.name ?? '?'} | ${f.sollmonat ?? '?'} | ${(f.sollbetrag ?? 0).toFixed(2)}€ | fällig: ${f.faelligkeitsdatum ?? '?'}`
  }).join('\n')

  const mieterDetails = mieter.map(m => {
    const mvIds = mietvertragMieter.filter(mv => mv.mieter_id === m.id).map(mv => mv.mietvertrag_id)
    const aktiverV = mietvertraege.find(v => mvIds.includes(v.id) && v.status === 'aktiv')
    const e = aktiverV ? einheiten.find(ein => ein.id === aktiverV.einheit_id) : null
    const immo = e ? immobilien.find(i => i.id === e.immobilie_id) : null
    let d = `• ${m.vorname} ${m.nachname ?? ''}`
    if (m.hauptmail) d += ` | ${m.hauptmail}`
    if (m.telnr) d += ` | ${m.telnr}`
    if (immo && e) d += ` | ${immo.name} ${e.etage ?? ''}`
    if (!aktiverV) d += ' | (kein aktiver Vertrag)'
    return d
  }).join('\n')

  const darlehenDetails = darlehen.map(d => {
    const immoNamen = darlehenImmobilien.filter(di => di.darlehen_id === d.id)
      .map(di => immobilien.find(i => i.id === di.immobilie_id)?.name ?? '?').join(', ')
    return `• ${d.bezeichnung ?? d.bank ?? '?'} | ${(d.restschuld ?? 0).toFixed(0)}€ Restschuld | ${(d.monatliche_rate ?? 0).toFixed(0)}€/Mo | ${d.zinssatz_prozent ?? '?'}% | ${immoNamen || '?'}`
  }).join('\n')

  const zahlungenDetails = zahlungen.slice(0, 8).map(z =>
    `• ${z.buchungsdatum} | ${(z.betrag ?? 0).toFixed(2)}€ | ${z.kategorie ?? '?'} | ${z.empfaengername ?? '?'}`
  ).join('\n')

  return `=== NiImmo Portfolio – Stand: ${today} ===

📊 KPIs
• Immobilien: ${immobilien.length} | Einheiten: ${einheiten.length} (${leerstehend.length} Leerstand)
• Aktive Verträge: ${aktiveV.length} | Gekündigt: ${gekuendigtV.length}
• Kaltmiete/Mo: ${gesamtKaltmiete.toFixed(0)}€ | Warmmiete: ${(gesamtKaltmiete + gesamtBK).toFixed(0)}€
• Offene Forderungen: ${forderungen.length} (${gesamtRueckstand.toFixed(0)}€)
• Mahnfälle: ${vertraegeInMahnung.length}
• Restschuld Darlehen: ${totalRestschuld.toFixed(0)}€ | Raten: ${totalRate.toFixed(0)}€/Mo

🏢 IMMOBILIEN
${immobilienDetails || 'Keine'}

⚠️ OFFENE FORDERUNGEN
${rueckstandDetails || 'Keine'}

👤 MIETER
${mieterDetails || 'Keine'}

💳 LETZTE ZAHLUNGEN
${zahlungenDetails || 'Keine'}

🏦 DARLEHEN
${darlehenDetails || 'Keine'}
`
}

// ─── Main ────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (!validateAgentKey(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    })
  }

  let query: string
  let file: FileData | undefined
  try {
    const body = await req.json()
    query = (body.query ?? '').trim()
    file = body.file ?? undefined
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültiger JSON-Body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!query) {
    return new Response(JSON.stringify({ error: '"query" ist erforderlich' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const context = await buildPortfolioContext(supabase)

    const systemPrompt = `Du bist Chilla, der allwissende KI-Assistent der NiImmo Immobilienverwaltung.

${context}

DEINE FÄHIGKEITEN:
Du hast folgende Tools – nutze sie aktiv wenn du mehr Infos brauchst oder handeln sollst:

READ (Infos holen):
• get_tenant_details – Vollständige Mieterinfo on-demand
• get_contract_details – Alle Vertragsdetails
• get_all_contracts – Alle Verträge (nach Status filterbar)
• get_outstanding_demands – Offene Forderungen
• get_payment_history – Zahlungshistorie (bis 24 Monate)
• get_mahnung_overview – Alle Mahnfälle
• get_property_details – Immobilien-Details
• get_vacant_units – Leerstände
• list_documents – Dokumente eines Mieters/Immobilie
• get_loan_details – Darlehen + Tilgungsplan
• get_nebenkosten_info – Nebenkostenpositionen
• get_meter_history – Zählerstand-Historie
• get_insurance_info – Versicherungen
• get_market_data – Basiszinssatz, VPI
• get_whatsapp_history – WhatsApp-Verlauf mit Mieter

WRITE (aktiv handeln):
• upload_document – Foto/Datei für Mieter speichern
• add_zaehlerstand – Zählerstand eintragen
• update_mahnstufe – Mahnstufe setzen
• create_mietforderung – Mietforderung erstellen
• update_payment_category – Zahlung kategorisieren

REGELN:
- Antworte IMMER auf Deutsch
- Telegram-optimiert: prägnant, strukturiert, mit Zeilenumbrüchen
- Wenn eine Frage Details erfordert, die du noch nicht hast → Tool aufrufen
- Wenn eine Datei mitgesendet wird → upload_document aufrufen
- Bei Schreiboperationen kurz bestätigen was getan wurde
- Proaktiv auf Probleme hinweisen (Rückstände, Leerstand, Mahnstufen)
- Antworten kurz halten (5-8 Zeilen), mehr nur wenn explizit gewünscht`

    const response = await askOpenAI(systemPrompt, query, supabase, file)

    return new Response(JSON.stringify({ response }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('agent-api Fehler:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unbekannter Fehler' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
