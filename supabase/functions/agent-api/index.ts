import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const SYSTEM_PROMPT = `Du bist Chilla, der KI-Assistent der NiImmo Holding GmbH (Hausverwaltung).

Beantworte Fragen zum Portfolio in präzisem, knappem Deutsch (Telegram-Format).

REGELN:
- Nutze IMMER die verfügbaren Tools um echte Daten abzurufen — nie raten, nie schätzen.
- Bei Folgefragen mit Pronomen ("er", "sie", "dort") nutze den Kontext der vorherigen Tool-Calls.
- Antworten kurz, konkret, mit Zahlen + Namen + Daten.
- Aktuelles Datum: ${new Date().toISOString().split('T')[0]}.
- Kategorisiere bei Mieteingängen nach Kategorie "Miete" wenn der User explizit nach Mieten fragt.

ANTWORTFORMAT:
- Beträge mit Tausendertrennzeichen: 1.234,56 €
- Daten als TT.MM.JJJJ
- Listen als Bullet-Points (•) bei mehr als 3 Einträgen.`;

// ── Read Tools (via Postgres RPC) ──────────────────────────────────────────
const READ_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'rpc_agent_portfolio_summary',
      description:
        'KPI-Übersicht: Anzahl Immobilien, Einheiten, aktive/gekündigte Verträge, Kaltmiete/Warmmiete monatlich, offene Forderungen, Mahnfälle, Restschuld, Leerstand. Für jede Frage nach Portfolio-Status, Übersicht, Gesamtmiete.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rpc_agent_find_tenants',
      description:
        'Mieter per Namens-Such-String finden. Gibt bis zu 5 beste Treffer mit Vertrag, Miete und Mahnstufe zurück.',
      parameters: {
        type: 'object',
        properties: {
          p_search: { type: 'string', description: 'Vor-, Nach- oder vollständiger Name' },
        },
        required: ['p_search'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rpc_agent_tenant_payments',
      description:
        'Zahlungen eines Mieters abrufen. Optional gefiltert nach Jahr und/oder Monat. Mindestens p_search ODER p_mieter_id muss gesetzt sein.',
      parameters: {
        type: 'object',
        properties: {
          p_search: { type: 'string', description: 'Mieter-Name (optional wenn p_mieter_id gegeben)' },
          p_mieter_id: { type: 'string', description: 'UUID des Mieters' },
          p_year: { type: 'integer', description: 'Jahr-Filter, z.B. 2026' },
          p_month: { type: 'integer', description: 'Monat 1–12' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rpc_agent_outstanding',
      description:
        'Offene Forderungen / Rückstände. Optional gefiltert nach Mieter-Name (p_search). Ohne p_search: alle offenen Forderungen.',
      parameters: {
        type: 'object',
        properties: {
          p_search: { type: 'string', description: 'Mieter-Name für Filterung' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rpc_agent_vacancies',
      description: 'Alle leerstehenden Einheiten mit Immobilie, Adresse, Etage und Größe.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rpc_agent_dunning_summary',
      description: 'Mahnstufen-Übersicht: alle Verträge mit aktiver Mahnstufe (> 0).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rpc_agent_loans',
      description: 'Darlehen-Übersicht mit Restschuld, Zinssatz, monatlicher Rate und zugeordneten Immobilien.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rpc_agent_rent_received',
      description:
        'Aggregierte Zahlungseingänge eines Monats (Summe gesamt + Kategorie Miete + Anzahl). Erforderlich: p_year + p_month.',
      parameters: {
        type: 'object',
        properties: {
          p_year: { type: 'integer', description: 'Jahr, z.B. 2026' },
          p_month: { type: 'integer', description: 'Monat 1–12' },
        },
        required: ['p_year', 'p_month'],
      },
    },
  },
];

// ── Write Tools (direkte Supabase-Operationen) ─────────────────────────────
const WRITE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'assign_payment_to_contract',
      description: 'Zahlung einem Mietvertrag zuordnen. Setzt mietvertrag_id und Kategorie auf die Zahlung.',
      parameters: {
        type: 'object',
        properties: {
          zahlung_id: { type: 'string', description: 'UUID der Zahlung' },
          mietvertrag_id: { type: 'string', description: 'UUID des Mietvertrags' },
          kategorie: {
            type: 'string',
            enum: ['Miete', 'Nichtmiete', 'Nebenkosten', 'Mietkaution', 'Rücklastschrift', 'Ignorieren'],
          },
        },
        required: ['zahlung_id', 'mietvertrag_id', 'kategorie'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_mieter',
      description: 'Neuen Mieter in der Datenbank anlegen.',
      parameters: {
        type: 'object',
        properties: {
          vorname: { type: 'string' },
          nachname: { type: 'string' },
          hauptmail: { type: 'string', description: 'E-Mail-Adresse' },
          telefon: { type: 'string' },
          geburtsdatum: { type: 'string', description: 'ISO-Datum YYYY-MM-DD' },
        },
        required: ['vorname', 'nachname'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_mietvertrag',
      description:
        'Neuen Mietvertrag anlegen. Findet automatisch eine freie Einheit in der angegebenen Immobilie.',
      parameters: {
        type: 'object',
        properties: {
          mieter_id: { type: 'string', description: 'UUID des Mieters' },
          immobilie_name: { type: 'string', description: 'Name der Immobilie' },
          kaltmiete: { type: 'number' },
          betriebskosten: { type: 'number' },
          kaution: { type: 'number' },
          start_datum: { type: 'string', description: 'ISO-Datum YYYY-MM-DD' },
        },
        required: ['mieter_id', 'immobilie_name', 'kaltmiete', 'start_datum'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'terminate_contract',
      description: 'Mietvertrag kündigen. Setzt Status auf "gekuendigt" und speichert Kündigungsdatum.',
      parameters: {
        type: 'object',
        properties: {
          mietvertrag_id: { type: 'string' },
          kuendigungsdatum: { type: 'string', description: 'ISO-Datum YYYY-MM-DD' },
          kuendigungsgrund: { type: 'string' },
        },
        required: ['mietvertrag_id', 'kuendigungsdatum'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_mieter',
      description: 'Kontaktdaten eines Mieters aktualisieren.',
      parameters: {
        type: 'object',
        properties: {
          mieter_id: { type: 'string' },
          hauptmail: { type: 'string' },
          telefon: { type: 'string' },
          vorname: { type: 'string' },
          nachname: { type: 'string' },
        },
        required: ['mieter_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_vertrag_miete',
      description: 'Kaltmiete oder Betriebskosten eines aktiven Mietvertrags anpassen.',
      parameters: {
        type: 'object',
        properties: {
          mietvertrag_id: { type: 'string' },
          kaltmiete: { type: 'number' },
          betriebskosten: { type: 'number' },
        },
        required: ['mietvertrag_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_rent_increase_eligibility',
      description:
        'Prüft ob eine Mieterhöhung für einen Mietvertrag zulässig ist (Kappungsgrenze 15%/20%, Sperrfrist 15 Monate).',
      parameters: {
        type: 'object',
        properties: {
          mietvertrag_id: { type: 'string' },
        },
        required: ['mietvertrag_id'],
      },
    },
  },
];

const TOOLS = [...READ_TOOLS, ...WRITE_TOOLS];
const READ_TOOL_NAMES = new Set(READ_TOOLS.map((t) => t.function.name));

// ── OpenAI Call ────────────────────────────────────────────────────────────
async function callOpenAI(messages: unknown[]) {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY nicht konfiguriert');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 300)}`);
  }
  return res.json();
}

// ── RPC Executor (Read Tools via Postgres) ─────────────────────────────────
async function executeRPC(
  supabase: ReturnType<typeof createClient>,
  name: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const { data, error } = await supabase.rpc(name, args);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── Write Tool Executor ────────────────────────────────────────────────────
async function executeWrite(
  supabase: ReturnType<typeof createClient>,
  name: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    switch (name) {
      case 'assign_payment_to_contract': {
        const { data, error } = await supabase
          .from('zahlungen')
          .update({ mietvertrag_id: args.mietvertrag_id, kategorie: args.kategorie })
          .eq('id', args.zahlung_id)
          .select()
          .single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, data: { updated: true, zahlung: data } };
      }

      case 'create_mieter': {
        const { data, error } = await supabase
          .from('mieter')
          .insert({
            vorname: args.vorname,
            nachname: args.nachname,
            hauptmail: args.hauptmail ?? null,
            telefon: args.telefon ?? null,
            geburtsdatum: args.geburtsdatum ?? null,
          })
          .select()
          .single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, data: { created: true, mieter: data } };
      }

      case 'create_mietvertrag': {
        const { data: immo, error: immoErr } = await supabase
          .from('immobilien')
          .select('id')
          .ilike('name', `%${args.immobilie_name}%`)
          .limit(1)
          .single();
        if (immoErr || !immo) return { ok: false, error: 'Immobilie nicht gefunden' };

        const { data: einheiten } = await supabase
          .from('einheiten')
          .select('id')
          .eq('immobilie_id', immo.id);
        const { data: belegte } = await supabase
          .from('mietvertrag')
          .select('einheit_id')
          .in('status', ['aktiv', 'gekuendigt']);
        const belegteIds = new Set((belegte ?? []).map((v: { einheit_id: string }) => v.einheit_id));
        const freie = (einheiten ?? []).find((e: { id: string }) => !belegteIds.has(e.id));
        if (!freie) return { ok: false, error: 'Keine freie Einheit in dieser Immobilie' };

        const { data: vertrag, error: vertragErr } = await supabase
          .from('mietvertrag')
          .insert({
            einheit_id: freie.id,
            kaltmiete: args.kaltmiete,
            betriebskosten: args.betriebskosten ?? 0,
            kaution: args.kaution ?? 0,
            start_datum: args.start_datum,
            status: 'aktiv',
          })
          .select()
          .single();
        if (vertragErr || !vertrag) return { ok: false, error: vertragErr?.message ?? 'Vertrag-Erstellung fehlgeschlagen' };

        const { error: linkErr } = await supabase
          .from('mietvertrag_mieter')
          .insert({ mietvertrag_id: vertrag.id, mieter_id: args.mieter_id });
        if (linkErr) return { ok: false, error: linkErr.message };

        return { ok: true, data: { created: true, mietvertrag_id: vertrag.id, einheit_id: freie.id } };
      }

      case 'terminate_contract': {
        const { error } = await supabase
          .from('mietvertrag')
          .update({
            status: 'gekuendigt',
            kuendigungsdatum: args.kuendigungsdatum,
            kuendigungsgrund: args.kuendigungsgrund ?? null,
          })
          .eq('id', args.mietvertrag_id);
        if (error) return { ok: false, error: error.message };
        return { ok: true, data: { terminated: true } };
      }

      case 'update_mieter': {
        const updates: Record<string, unknown> = {};
        if (args.hauptmail !== undefined) updates.hauptmail = args.hauptmail;
        if (args.telefon !== undefined) updates.telefon = args.telefon;
        if (args.vorname !== undefined) updates.vorname = args.vorname;
        if (args.nachname !== undefined) updates.nachname = args.nachname;
        const { error } = await supabase.from('mieter').update(updates).eq('id', args.mieter_id);
        if (error) return { ok: false, error: error.message };
        return { ok: true, data: { updated: true } };
      }

      case 'update_vertrag_miete': {
        const updates: Record<string, unknown> = {};
        if (args.kaltmiete !== undefined) updates.kaltmiete = args.kaltmiete;
        if (args.betriebskosten !== undefined) updates.betriebskosten = args.betriebskosten;
        const { error } = await supabase.from('mietvertrag').update(updates).eq('id', args.mietvertrag_id);
        if (error) return { ok: false, error: error.message };
        return { ok: true, data: { updated: true } };
      }

      case 'get_rent_increase_eligibility': {
        const { data: vertrag, error } = await supabase
          .from('mietvertrag')
          .select('kaltmiete, start_datum, einheit_id')
          .eq('id', args.mietvertrag_id)
          .single();
        if (error || !vertrag) return { ok: false, error: 'Vertrag nicht gefunden' };

        const { data: einheit } = await supabase
          .from('einheiten')
          .select('immobilie_id')
          .eq('id', vertrag.einheit_id)
          .single();
        const { data: immo } = einheit
          ? await supabase.from('immobilien').select('ist_angespannt').eq('id', einheit.immobilie_id).single()
          : { data: null };

        const istAngespannt = immo?.ist_angespannt ?? false;
        const kappung = istAngespannt ? 0.15 : 0.2;
        const maxNeueKaltmiete = Number(vertrag.kaltmiete) * (1 + kappung);

        const startDatum = new Date(vertrag.start_datum);
        const heute = new Date();
        const monate =
          (heute.getFullYear() - startDatum.getFullYear()) * 12 +
          (heute.getMonth() - startDatum.getMonth());
        const sperrfristErfuellt = monate >= 15;

        return {
          ok: true,
          data: {
            aktuelle_kaltmiete: vertrag.kaltmiete,
            ist_angespannt: istAngespannt,
            kappungsgrenze_prozent: kappung * 100,
            max_neue_kaltmiete: Math.round(maxNeueKaltmiete * 100) / 100,
            monate_seit_start: monate,
            sperrfrist_erfuellt: sperrfristErfuellt,
            hinweis: sperrfristErfuellt
              ? `Mieterhöhung zulässig. Max. ${(kappung * 100).toFixed(0)}% Kappungsgrenze (${istAngespannt ? 'angespannter Markt' : 'normaler Markt'}).`
              : `Sperrfrist noch nicht erfüllt (${monate}/15 Monate).`,
          },
        };
      }

      default:
        return { ok: false, error: `Unbekanntes Write-Tool: ${name}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── Auth ───────────────────────────────────────────────────────────────────
function validateAgentKey(req: Request): boolean {
  const key = req.headers.get('x-agent-key');
  const expected = Deno.env.get('AGENT_API_KEY');
  return !!key && !!expected && key === expected;
}

// ── Main Handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (!validateAgentKey(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let query: string;
  try {
    const body = await req.json();
    query = (body.query ?? '').trim();
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültiger JSON-Body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!query) {
    return new Response(JSON.stringify({ error: '"query" ist erforderlich' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const messages: unknown[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: query },
    ];

    for (let round = 0; round < 4; round++) {
      const completion = await callOpenAI(messages);
      const msg = completion.choices?.[0]?.message;
      if (!msg) throw new Error('Leere OpenAI-Antwort');

      messages.push(msg);

      const toolCalls = msg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        return new Response(
          JSON.stringify({ response: msg.content ?? 'Keine Antwort.' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // Alle Tool-Calls parallel ausführen
      const results = await Promise.all(
        toolCalls.map(async (call: { id: string; function: { name: string; arguments: string } }) => {
          const args = JSON.parse(call.function.arguments || '{}');
          const toolName = call.function.name;
          const result = READ_TOOL_NAMES.has(toolName)
            ? await executeRPC(supabase, toolName, args)
            : await executeWrite(supabase, toolName, args);

          return {
            tool_call_id: call.id,
            role: 'tool',
            name: toolName,
            content: JSON.stringify(result.ok ? result.data : { error: result.error }),
          };
        }),
      );
      messages.push(...results);
    }

    return new Response(
      JSON.stringify({ error: 'Tool-Call-Limit erreicht (4 Runden) — Anfrage zu komplex.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('agent-api Fehler:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unbekannter Fehler' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
