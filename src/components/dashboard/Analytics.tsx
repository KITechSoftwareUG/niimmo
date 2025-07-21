import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Area, AreaChart } from 'recharts';
import { Euro, TrendingUp, TrendingDown, Building, Users } from 'lucide-react';

// Platzhalter-Daten
const monatlicheEinnahmen = [
  { monat: 'Jan', kaltmiete: 15800, betriebskosten: 3200, gesamt: 19000 },
  { monat: 'Feb', kaltmiete: 15800, betriebskosten: 3200, gesamt: 19000 },
  { monat: 'Mär', kaltmiete: 16200, betriebskosten: 3300, gesamt: 19500 },
  { monat: 'Apr', kaltmiete: 16200, betriebskosten: 3300, gesamt: 19500 },
  { monat: 'Mai', kaltmiete: 16200, betriebskosten: 3300, gesamt: 19500 },
  { monat: 'Jun', kaltmiete: 16600, betriebskosten: 3400, gesamt: 20000 },
  { monat: 'Jul', kaltmiete: 16600, betriebskosten: 3400, gesamt: 20000 },
  { monat: 'Aug', kaltmiete: 16600, betriebskosten: 3400, gesamt: 20000 },
  { monat: 'Sep', kaltmiete: 17000, betriebskosten: 3500, gesamt: 20500 },
  { monat: 'Okt', kaltmiete: 17000, betriebskosten: 3500, gesamt: 20500 },
  { monat: 'Nov', kaltmiete: 17000, betriebskosten: 3500, gesamt: 20500 },
  { monat: 'Dez', kaltmiete: 17400, betriebskosten: 3600, gesamt: 21000 },
];

const verteilungEinnahmen = [
  { name: 'Kaltmiete', value: 198800, color: '#3B82F6' },
  { name: 'Betriebskosten', value: 40800, color: '#10B981' },
  { name: 'Sonderkosten', value: 8400, color: '#F59E0B' },
];

const preiserhöhungen = [
  { quartal: 'Q1 2024', erhöhung: 2.1, anzahlEinheiten: 8 },
  { quartal: 'Q2 2024', erhöhung: 1.8, anzahlEinheiten: 12 },
  { quartal: 'Q3 2024', erhöhung: 2.5, anzahlEinheiten: 6 },
  { quartal: 'Q4 2024', erhöhung: 3.2, anzahlEinheiten: 15 },
];

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

export const Analytics = () => {
  // Berechnete Kennzahlen
  const gesamtKaltmiete = monatlicheEinnahmen.reduce((sum, item) => sum + item.kaltmiete, 0);
  const gesamtBetriebskosten = monatlicheEinnahmen.reduce((sum, item) => sum + item.betriebskosten, 0);
  const durchschnittlichePreiserhöhung = preiserhöhungen.reduce((sum, item) => sum + item.erhöhung, 0) / preiserhöhungen.length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
          <p className="text-gray-600">Übersicht über Mieteinnahmen, Preiserhöhungen und finanzielle Kennzahlen</p>
        </div>

        {/* Kennzahlen Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gesamt Kaltmiete 2024</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{gesamtKaltmiete.toLocaleString('de-DE')}€</div>
              <p className="text-xs text-muted-foreground">
                +12.5% vom Vorjahr
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Betriebskosten 2024</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{gesamtBetriebskosten.toLocaleString('de-DE')}€</div>
              <p className="text-xs text-muted-foreground">
                +5.2% vom Vorjahr
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ø Preiserhöhung</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{durchschnittlichePreiserhöhung.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                Pro Quartal 2024
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vermietungsgrad</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">94.2%</div>
              <p className="text-xs text-muted-foreground">
                41 von 43 Einheiten
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Monatliche Einnahmen */}
          <Card>
            <CardHeader>
              <CardTitle>Monatliche Einnahmen 2024</CardTitle>
              <CardDescription>Entwicklung der Kalt- und Betriebskosten</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monatlicheEinnahmen}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="monat" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value}€`, 'Betrag']} />
                    <Area type="monotone" dataKey="kaltmiete" stackId="1" stroke="#3B82F6" fill="#3B82F6" />
                    <Area type="monotone" dataKey="betriebskosten" stackId="1" stroke="#10B981" fill="#10B981" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Einnahmenverteilung */}
          <Card>
            <CardHeader>
              <CardTitle>Einnahmenverteilung 2024</CardTitle>
              <CardDescription>Aufschlüsselung nach Kostenarten</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={verteilungEinnahmen}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {verteilungEinnahmen.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value.toLocaleString('de-DE')}€`, 'Betrag']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Weitere Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preiserhöhungen */}
          <Card>
            <CardHeader>
              <CardTitle>Quartalsweise Preiserhöhungen</CardTitle>
              <CardDescription>Prozentuale Erhöhungen und betroffene Einheiten</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={preiserhöhungen}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="quartal" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === 'erhöhung' ? `${value}%` : `${value} Einheiten`,
                        name === 'erhöhung' ? 'Erhöhung' : 'Anzahl Einheiten'
                      ]} 
                    />
                    <Bar dataKey="erhöhung" fill="#F59E0B" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Einnahmen-Trend</CardTitle>
              <CardDescription>Monatliche Gesamteinnahmen mit Trendlinie</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monatlicheEinnahmen}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="monat" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value}€`, 'Gesamteinnahmen']} />
                    <Line 
                      type="monotone" 
                      dataKey="gesamt" 
                      stroke="#3B82F6" 
                      strokeWidth={3}
                      dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Zusätzliche Informationen */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Wichtige Kennzahlen</CardTitle>
              <CardDescription>Weitere relevante Metriken für das Immobilienportfolio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-lg">Jahresertrag</h3>
                  <p className="text-2xl font-bold text-blue-600">{(gesamtKaltmiete + gesamtBetriebskosten).toLocaleString('de-DE')}€</p>
                  <p className="text-sm text-gray-600">Brutto 2024</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <h3 className="font-semibold text-lg">Durchschn. Miete/m²</h3>
                  <p className="text-2xl font-bold text-green-600">12,45€</p>
                  <p className="text-sm text-gray-600">Kaltmiete</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <h3 className="font-semibold text-lg">Leerstandsrate</h3>
                  <p className="text-2xl font-bold text-orange-600">5,8%</p>
                  <p className="text-sm text-gray-600">2 von 43 Einheiten</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};