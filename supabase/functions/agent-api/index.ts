import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

// ─── Auth ────────────────────────────────────────────────────────────────────

function validateAgentKey(req: Request): boolean {
  const key = req.headers.get('x-agent-key')
  const expected = Deno.env.get('AGENT_API_KEY')
  return !!key && !!expected && key === expected
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

async function askClaude(systemPrompt: string, userQuery: string): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY nicht konfiguriert')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userQuery }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API Fehler: ${res.status} – ${err}`)
  }

  const data = await res.json()
  return data.content?.[0]?.text ?? 'Keine Antwort erhalten.'
}

// ─── Daten laden ─────────────────────────────────────────────────────────────

async function buildPortfolioContext(supabase: ReturnType<typeof createClient>): Promise<string> {
  const today = new Date().toISOString().split('T')[0]

  const [
    immobilienRes,
    einheitenRes,
    mietvertraegeRes,
    mieterRes,
    mietvertragMieterRes,
    forderungenRes,
    zahlungenRes,
    darlehenRes,
    darlehenImmobilienRes,
    versicherungenRes,
  ] = await Promise.all([
    supabase.from('immobilien').select('id, name, adresse, einheiten_anzahl, objekttyp, kaufpreis, baujahr'),
    supabase.from('einheiten').select('id, immobilie_id, qm, etage, einheitentyp, anzahl_personen'),
    supabase.from('mietvertrag').select('id, einheit_id, kaltmiete, betriebskosten, status, start_datum, ende_datum, kuendigungsdatum, mahnstufe, kaution_betrag, kaution_ist, kaution_status'),
    supabase.from('mieter').select('id, vorname, nachname, hauptmail, telnr'),
    supabase.from('mietvertrag_mieter').select('mietvertrag_id, mieter_id'),
    supabase
      .from('mietforderungen')
      .select('id, sollbetrag, sollmonat, ist_faellig, faelligkeitsdatum, mietvertrag_id')
      .eq('ist_faellig', true)
      .order('faelligkeitsdatum', { ascending: true })
      .limit(50),
    supabase
      .from('zahlungen')
      .select('id, betrag, buchungsdatum, kategorie, mietvertrag_id, empfaengername, verwendungszweck')
      .order('buchungsdatum', { ascending: false })
      .limit(30),
    supabase.from('darlehen').select('id, bezeichnung, bank, restschuld, zinssatz_prozent, monatliche_rate, ende_datum'),
    supabase.from('darlehen_immobilien').select('darlehen_id, immobilie_id'),
    supabase.from('versicherungen').select('id, immobilie_id, typ, firma, jahresbeitrag'),
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
  const versicherungen = versicherungenRes.data ?? []

  // ── KPIs ──
  const aktiveV = mietvertraege.filter(v => v.status === 'aktiv')
  const gekuendigtV = mietvertraege.filter(v => v.status === 'gekuendigt')
  const gesamtKaltmiete = aktiveV.reduce((s, v) => s + (v.kaltmiete ?? 0), 0)
  const gesamtBK = aktiveV.reduce((s, v) => s + (v.betriebskosten ?? 0), 0)
  const gesamtRueckstand = forderungen.reduce((s, f) => s + (f.sollbetrag ?? 0), 0)
  const vertraegeInMahnung = mietvertraege.filter(v => (v.mahnstufe ?? 0) > 0)
  const leerstehend = einheiten.filter(e =>
    !mietvertraege.some(v => v.einheit_id === e.id && (v.status === 'aktiv' || v.status === 'gekuendigt'))
  )
  const totalRestschuld = darlehen.reduce((s, d) => s + (d.restschuld ?? 0), 0)
  const totalRate = darlehen.reduce((s, d) => s + (d.monatliche_rate ?? 0), 0)

  // ── Immobilien mit Einheiten ──
  const immobilienDetails = immobilien.map(immo => {
    const immoEinheiten = einheiten.filter(e => e.immobilie_id === immo.id)
    const immoV = mietvertraege.filter(v => immoEinheiten.some(e => e.id === v.einheit_id))
    const aktiv = immoV.filter(v => v.status === 'aktiv' || v.status === 'gekuendigt')
    const kaltmiete = aktiv.reduce((s, v) => s + (v.kaltmiete ?? 0), 0)

    let block = `📍 ${immo.name} (${immo.adresse})\n   ${immo.einheiten_anzahl ?? immoEinheiten.length} Einheiten | ${aktiv.length} aktive Verträge | ${kaltmiete.toFixed(0)}€/Monat Kaltmiete`

    immoEinheiten.forEach(e => {
      const vertrag = mietvertraege.find(v => v.einheit_id === e.id && (v.status === 'aktiv' || v.status === 'gekuendigt'))
      const mieterIds = vertrag
        ? mietvertragMieter.filter(mv => mv.mietvertrag_id === vertrag.id).map(mv => mv.mieter_id)
        : []
      const namen = mieterIds
        .map(id => mieter.find(m => m.id === id))
        .filter(Boolean)
        .map(m => `${m!.vorname} ${m!.nachname ?? ''}`.trim())
        .join(', ')

      block += `\n   • ${e.etage ?? '?'} (${e.einheitentyp ?? 'Wohnung'}, ${e.qm ?? '?'}qm): `
      if (vertrag) {
        block += `${namen || 'Mieter unbekannt'} | ${vertrag.kaltmiete ?? 0}€ Kaltmiete | ${vertrag.status}`
        if ((vertrag.mahnstufe ?? 0) > 0) block += ` ⚠️ Mahnstufe ${vertrag.mahnstufe}`
      } else {
        block += '🔴 LEERSTAND'
      }
    })
    return block
  }).join('\n\n')

  // ── Rückstände ──
  const rueckstandDetails = forderungen.slice(0, 15).map(f => {
    const v = mietvertraege.find(mv => mv.id === f.mietvertrag_id)
    const einheit = v ? einheiten.find(e => e.id === v.einheit_id) : null
    const immo = einheit ? immobilien.find(i => i.id === einheit.immobilie_id) : null
    const mieterIds = v ? mietvertragMieter.filter(mv => mv.mietvertrag_id === v.id).map(mv => mv.mieter_id) : []
    const namen = mieterIds.map(id => {
      const m = mieter.find(mi => mi.id === id)
      return m ? `${m.vorname} ${m.nachname ?? ''}`.trim() : ''
    }).filter(Boolean).join(', ')

    return `• ${namen || 'Unbekannt'} | ${immo?.name ?? '?'} | ${f.sollmonat ?? '?'} | ${(f.sollbetrag ?? 0).toFixed(2)}€ | fällig: ${f.faelligkeitsdatum ?? '?'}`
  }).join('\n')

  // ── Letzte Zahlungen ──
  const zahlungenDetails = zahlungen.slice(0, 10).map(z =>
    `• ${z.buchungsdatum?.slice(0, 10) ?? '?'} | ${(z.betrag ?? 0).toFixed(2)}€ | ${z.kategorie ?? '?'} | ${z.empfaengername ?? z.verwendungszweck ?? '?'}`
  ).join('\n')

  // ── Mieter ──
  const mieterDetails = mieter.map(m => {
    const mvIds = mietvertragMieter.filter(mv => mv.mieter_id === m.id).map(mv => mv.mietvertrag_id)
    const aktiverV = mietvertraege.find(v => mvIds.includes(v.id) && v.status === 'aktiv')
    const einheit = aktiverV ? einheiten.find(e => e.id === aktiverV.einheit_id) : null
    const immo = einheit ? immobilien.find(i => i.id === einheit.immobilie_id) : null
    let detail = `• ${m.vorname} ${m.nachname ?? ''}`
    if (m.hauptmail) detail += ` | ${m.hauptmail}`
    if (m.telnr) detail += ` | ${m.telnr}`
    if (immo && einheit) detail += ` | ${immo.name} ${einheit.etage ?? ''}`
    if (!aktiverV) detail += ' | (kein aktiver Vertrag)'
    return detail
  }).join('\n')

  // ── Darlehen ──
  const darlehenDetails = darlehen.map(d => {
    const immosIds = darlehenImmobilien.filter(di => di.darlehen_id === d.id).map(di => di.immobilie_id)
    const immoNamen = immosIds.map(id => immobilien.find(i => i.id === id)?.name ?? '?').join(', ')
    return `• ${d.bezeichnung ?? d.bank ?? '?'} | Restschuld: ${(d.restschuld ?? 0).toFixed(0)}€ | Rate: ${(d.monatliche_rate ?? 0).toFixed(0)}€/Mo | Zins: ${d.zinssatz_prozent ?? '?'}% | Immobilie(n): ${immoNamen || 'keine'}`
  }).join('\n')

  return `=== NiImmo Portfolio – Stand: ${today} ===

📊 PORTFOLIO-KPIs
• Immobilien: ${immobilien.length}
• Einheiten gesamt: ${einheiten.length} (davon ${leerstehend.length} Leerstand)
• Aktive Mietverträge: ${aktiveV.length} | Gekündigt: ${gekuendigtV.length}
• Monatliche Kaltmiete: ${gesamtKaltmiete.toFixed(2)}€
• Monatliche Warmmiete: ${(gesamtKaltmiete + gesamtBK).toFixed(2)}€
• Offene fällige Forderungen: ${forderungen.length} (${gesamtRueckstand.toFixed(2)}€ Rückstand)
• Verträge in Mahnung: ${vertraegeInMahnung.length}
• Gesamtrestschuld Darlehen: ${totalRestschuld.toFixed(0)}€ | Raten: ${totalRate.toFixed(0)}€/Mo

🏢 IMMOBILIEN & EINHEITEN
${immobilienDetails || 'Keine Immobilien vorhanden'}

⚠️ OFFENE FORDERUNGEN (fällig)
${rueckstandDetails || 'Keine offenen Forderungen – alles bezahlt!'}

👤 MIETER
${mieterDetails || 'Keine Mieter vorhanden'}

💳 LETZTE ZAHLUNGSEINGÄNGE
${zahlungenDetails || 'Keine Zahlungen vorhanden'}

🏦 DARLEHEN
${darlehenDetails || 'Keine Darlehen vorhanden'}
`
}

// ─── Main ────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS nicht nötig – nur OpenClaw (kein Browser) ruft diese Function auf.
  // Einfache HTTP-Fehler-Responses ohne CORS-Headers.

  if (!validateAgentKey(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let query: string
  try {
    const body = await req.json()
    query = (body.query ?? '').trim()
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültiger JSON-Body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!query) {
    return new Response(JSON.stringify({ error: '"query" ist erforderlich' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const context = await buildPortfolioContext(supabase)

    const systemPrompt = `Du bist Chilla, der KI-Assistent der NiImmo Immobilienverwaltung. Du hast Zugriff auf alle Echtzeit-Daten des Portfolios.

${context}

REGELN:
- Antworte IMMER auf Deutsch
- Deine Antworten sind für Telegram optimiert: prägnant, gut strukturiert, mit Zeilenumbrüchen
- Nutze ausschließlich die echten Daten aus dem Kontext – keine Vermutungen
- Bei Rückständen oder Mahnungen: nenne konkrete Beträge, Namen und Daten
- Wenn du nach einem Mieter/Vertrag/Immobilie fragst, suche exakt in den Daten
- Du kannst keine Daten ändern, aber du analysierst und empfiehlst
- Sei proaktiv: wenn du Probleme siehst (Rückstände, Leerstand, Mahnungen), weise darauf hin
- Halte Antworten kurz (max 5-8 Zeilen für einfache Fragen, mehr nur wenn explizit gefragt)`

    const response = await askClaude(systemPrompt, query)

    return new Response(JSON.stringify({ response }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('agent-api Fehler:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unbekannter Fehler' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
