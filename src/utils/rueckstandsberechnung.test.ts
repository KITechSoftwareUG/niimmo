import { describe, it, expect } from 'vitest';
import {
  calculateMietvertragRueckstand,
  calculateMieteZahlungen,
  calculateRuecklastschriftGebuehren,
} from './rueckstandsberechnung';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockMietvertrag = { id: 'mv-1', kaltmiete: 800, betriebskosten: 200 };

function makeForderung(sollmonat: string, sollbetrag: number) {
  return { id: `f-${sollmonat}`, mietvertrag_id: 'mv-1', sollmonat, sollbetrag };
}

function makeZahlung(
  id: string,
  betrag: number,
  kategorie: string | null,
  zugeordneter_monat: string | null = null,
  buchungsdatum = '2025-01-10'
) {
  return { id, mietvertrag_id: 'mv-1', betrag, kategorie, zugeordneter_monat, buchungsdatum };
}

// ---------------------------------------------------------------------------
// calculateMieteZahlungen
// ---------------------------------------------------------------------------
describe('calculateMieteZahlungen', () => {
  it('returns 0 for empty array', () => {
    expect(calculateMieteZahlungen([])).toBe(0);
  });

  it('sums only payments with kategorie "Miete"', () => {
    const zahlungen = [
      makeZahlung('z1', 1000, 'Miete'),
      makeZahlung('z2', 500, 'Miete'),
      makeZahlung('z3', 200, 'Nebenkosten'),
      makeZahlung('z4', 300, 'Rücklastschrift'),
      makeZahlung('z5', 100, null),
    ];
    expect(calculateMieteZahlungen(zahlungen)).toBe(1500);
  });

  it('returns 0 when no Miete payments exist', () => {
    const zahlungen = [
      makeZahlung('z1', 500, 'Nebenkosten'),
      makeZahlung('z2', 100, null),
    ];
    expect(calculateMieteZahlungen(zahlungen)).toBe(0);
  });

  it('handles non-numeric betrag gracefully (treats as 0)', () => {
    const zahlungen = [
      { id: 'z1', betrag: undefined, kategorie: 'Miete' },
      makeZahlung('z2', 300, 'Miete'),
    ];
    expect(calculateMieteZahlungen(zahlungen)).toBe(300);
  });

  it('does NOT count kategorie null as Miete', () => {
    const zahlungen = [makeZahlung('z1', 1000, null)];
    expect(calculateMieteZahlungen(zahlungen)).toBe(0);
  });

  it('does NOT count "Rücklastschrift" as Miete', () => {
    const zahlungen = [makeZahlung('z1', 25, 'Rücklastschrift')];
    expect(calculateMieteZahlungen(zahlungen)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateMietvertragRueckstand — guard clauses
// ---------------------------------------------------------------------------
describe('calculateMietvertragRueckstand — null/undefined guards', () => {
  it('returns zeros when mietvertrag is null', () => {
    const result = calculateMietvertragRueckstand(null, [], []);
    expect(result).toEqual({ gesamtForderungen: 0, gesamtZahlungen: 0, rueckstand: 0 });
  });

  it('returns zeros when forderungen is null', () => {
    const result = calculateMietvertragRueckstand(mockMietvertrag, null as any, []);
    expect(result).toEqual({ gesamtForderungen: 0, gesamtZahlungen: 0, rueckstand: 0 });
  });

  it('returns zeros when zahlungen is null', () => {
    const result = calculateMietvertragRueckstand(mockMietvertrag, [], null as any);
    expect(result).toEqual({ gesamtForderungen: 0, gesamtZahlungen: 0, rueckstand: 0 });
  });
});

// ---------------------------------------------------------------------------
// calculateMietvertragRueckstand — kein Rückstand (Zahlungen = Forderungen)
// ---------------------------------------------------------------------------
describe('calculateMietvertragRueckstand — kein Rückstand', () => {
  it('rueckstand is 0 when Miete payments exactly match demands', () => {
    const forderungen = [makeForderung('2025-01', 1000)];
    const zahlungen = [makeZahlung('z1', 1000, 'Miete', '2025-01')];

    const { gesamtForderungen, gesamtZahlungen, rueckstand } = calculateMietvertragRueckstand(
      mockMietvertrag, forderungen, zahlungen
    );

    expect(gesamtForderungen).toBe(1000);
    expect(gesamtZahlungen).toBe(1000);
    expect(rueckstand).toBe(0);
  });

  it('rueckstand is 0 with multiple matching months', () => {
    const forderungen = [
      makeForderung('2025-01', 1000),
      makeForderung('2025-02', 1000),
    ];
    const zahlungen = [
      makeZahlung('z1', 1000, 'Miete', '2025-01'),
      makeZahlung('z2', 1000, 'Miete', '2025-02'),
    ];

    const { rueckstand } = calculateMietvertragRueckstand(mockMietvertrag, forderungen, zahlungen);
    expect(rueckstand).toBe(0);
  });

  it('leere Forderungen und leere Zahlungen ergeben Null-Rückstand', () => {
    const result = calculateMietvertragRueckstand(mockMietvertrag, [], []);
    expect(result).toEqual({ gesamtForderungen: 0, gesamtZahlungen: 0, rueckstand: 0 });
  });
});

// ---------------------------------------------------------------------------
// calculateMietvertragRueckstand — Rückstand (Zahlungen < Forderungen)
// ---------------------------------------------------------------------------
describe('calculateMietvertragRueckstand — Rückstand', () => {
  it('positive rueckstand when Miete payments are less than demands', () => {
    const forderungen = [makeForderung('2025-01', 1000)];
    const zahlungen = [makeZahlung('z1', 600, 'Miete', '2025-01')];

    const { gesamtForderungen, gesamtZahlungen, rueckstand } = calculateMietvertragRueckstand(
      mockMietvertrag, forderungen, zahlungen
    );

    expect(gesamtForderungen).toBe(1000);
    expect(gesamtZahlungen).toBe(600);
    expect(rueckstand).toBe(400);
  });

  it('positive rueckstand when no payments at all', () => {
    const forderungen = [makeForderung('2025-01', 1000)];

    const { rueckstand } = calculateMietvertragRueckstand(mockMietvertrag, forderungen, []);
    expect(rueckstand).toBe(1000);
  });

  it('accumulates rueckstand across multiple months', () => {
    const forderungen = [
      makeForderung('2025-01', 1000),
      makeForderung('2025-02', 1000),
    ];
    const zahlungen = [makeZahlung('z1', 500, 'Miete', '2025-01')];

    const { rueckstand } = calculateMietvertragRueckstand(mockMietvertrag, forderungen, zahlungen);
    expect(rueckstand).toBe(1500);
  });
});

// ---------------------------------------------------------------------------
// calculateMietvertragRueckstand — Guthaben (Zahlungen > Forderungen)
// ---------------------------------------------------------------------------
describe('calculateMietvertragRueckstand — Guthaben', () => {
  it('negative rueckstand (Guthaben) when payments exceed demands', () => {
    const forderungen = [makeForderung('2025-01', 1000)];
    const zahlungen = [makeZahlung('z1', 1200, 'Miete', '2025-01')];

    const { rueckstand } = calculateMietvertragRueckstand(mockMietvertrag, forderungen, zahlungen);
    expect(rueckstand).toBe(-200);
  });

  it('Guthaben works when forderungen are empty but Miete payments exist', () => {
    const zahlungen = [makeZahlung('z1', 500, 'Miete', '2025-01')];

    const { gesamtForderungen, gesamtZahlungen, rueckstand } = calculateMietvertragRueckstand(
      mockMietvertrag, [], zahlungen
    );

    expect(gesamtForderungen).toBe(0);
    expect(gesamtZahlungen).toBe(500);
    expect(rueckstand).toBe(-500);
  });
});

// ---------------------------------------------------------------------------
// calculateMietvertragRueckstand — falsche Kategorie wird ignoriert
// ---------------------------------------------------------------------------
describe('calculateMietvertragRueckstand — Kategoriefilter', () => {
  it('does NOT count Nebenkosten payments toward rueckstand calculation', () => {
    const forderungen = [makeForderung('2025-01', 1000)];
    const zahlungen = [makeZahlung('z1', 1000, 'Nebenkosten', '2025-01')];

    const { gesamtZahlungen, rueckstand } = calculateMietvertragRueckstand(
      mockMietvertrag, forderungen, zahlungen
    );

    // Nebenkosten darf nicht gezählt werden
    expect(gesamtZahlungen).toBe(0);
    expect(rueckstand).toBe(1000);
  });

  it('does NOT count null-kategorie payments toward rueckstand calculation', () => {
    const forderungen = [makeForderung('2025-01', 1000)];
    const zahlungen = [makeZahlung('z1', 1000, null, '2025-01')];

    const { gesamtZahlungen, rueckstand } = calculateMietvertragRueckstand(
      mockMietvertrag, forderungen, zahlungen
    );

    expect(gesamtZahlungen).toBe(0);
    expect(rueckstand).toBe(1000);
  });

  it('DOES count Rücklastschrift payments (they reduce the debt balance)', () => {
    const forderungen = [makeForderung('2025-01', 1000)];
    const zahlungen = [
      makeZahlung('z1', 1000, 'Miete', '2025-01'),
      makeZahlung('z2', -25, 'Rücklastschrift', '2025-01'),
    ];

    const { gesamtZahlungen, rueckstand } = calculateMietvertragRueckstand(
      mockMietvertrag, forderungen, zahlungen
    );

    // Rücklastschrift (typically negative) is counted
    expect(gesamtZahlungen).toBe(975);
    expect(rueckstand).toBe(25);
  });

  it('ignores Mietkaution category', () => {
    const forderungen = [makeForderung('2025-01', 1000)];
    const zahlungen = [makeZahlung('z1', 1000, 'Mietkaution', '2025-01')];

    const { gesamtZahlungen } = calculateMietvertragRueckstand(
      mockMietvertrag, forderungen, zahlungen
    );
    expect(gesamtZahlungen).toBe(0);
  });

  it('ignores Ignorieren category', () => {
    const forderungen = [makeForderung('2025-01', 1000)];
    const zahlungen = [makeZahlung('z1', 1000, 'Ignorieren', '2025-01')];

    const { gesamtZahlungen } = calculateMietvertragRueckstand(
      mockMietvertrag, forderungen, zahlungen
    );
    expect(gesamtZahlungen).toBe(0);
  });

  it('ignores payments without buchungsdatum', () => {
    const forderungen = [makeForderung('2025-01', 1000)];
    const zahlungen = [
      { id: 'z1', betrag: 1000, kategorie: 'Miete', zugeordneter_monat: '2025-01', buchungsdatum: null },
    ];

    const { gesamtZahlungen } = calculateMietvertragRueckstand(
      mockMietvertrag, forderungen, zahlungen
    );
    expect(gesamtZahlungen).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateMietvertragRueckstand — Vorauszahlungs-Logik
// ---------------------------------------------------------------------------
describe('calculateMietvertragRueckstand — Vorauszahlungs-Verschiebung', () => {
  it('shifts a payment from a month with no demand to the next month with a demand', () => {
    // Forderung nur im Februar; Zahlung kam mit zugeordneter_monat = Januar (kein Bedarf in Jan)
    const forderungen = [makeForderung('2025-02', 1000)];
    const zahlungen = [makeZahlung('z1', 1000, 'Miete', '2025-01')];

    const { gesamtZahlungen, rueckstand } = calculateMietvertragRueckstand(
      mockMietvertrag, forderungen, zahlungen
    );

    // Payment should be shifted to 2025-02 and count toward that demand
    expect(gesamtZahlungen).toBe(1000);
    expect(rueckstand).toBe(0);
  });

  it('keeps payment in place when demand exists in same month', () => {
    const forderungen = [makeForderung('2025-01', 1000)];
    const zahlungen = [makeZahlung('z1', 1000, 'Miete', '2025-01')];

    const { rueckstand } = calculateMietvertragRueckstand(
      mockMietvertrag, forderungen, zahlungen
    );
    expect(rueckstand).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateMietvertragRueckstand — Forderungen ohne sollmonat werden ignoriert
// ---------------------------------------------------------------------------
describe('calculateMietvertragRueckstand — Forderungen ohne sollmonat', () => {
  it('excludes demands that have no sollmonat', () => {
    const forderungen = [
      { id: 'f-null', sollmonat: null, sollbetrag: 1000 },
      makeForderung('2025-01', 500),
    ];
    const zahlungen = [makeZahlung('z1', 500, 'Miete', '2025-01')];

    const { gesamtForderungen, rueckstand } = calculateMietvertragRueckstand(
      mockMietvertrag, forderungen, zahlungen
    );

    // Only the demand with a sollmonat is counted
    expect(gesamtForderungen).toBe(500);
    expect(rueckstand).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateRuecklastschriftGebuehren — bonus coverage
// ---------------------------------------------------------------------------
describe('calculateRuecklastschriftGebuehren', () => {
  it('returns 0 for empty array', () => {
    expect(calculateRuecklastschriftGebuehren([])).toBe(0);
  });

  it('sums ruecklastschrift_gebuehr only from Rücklastschrift entries', () => {
    const zahlungen = [
      { id: 'z1', kategorie: 'Rücklastschrift', ruecklastschrift_gebuehr: 25 },
      { id: 'z2', kategorie: 'Rücklastschrift', ruecklastschrift_gebuehr: 10 },
      { id: 'z3', kategorie: 'Miete', ruecklastschrift_gebuehr: 100 }, // should not count
    ];
    expect(calculateRuecklastschriftGebuehren(zahlungen)).toBe(35);
  });
});
