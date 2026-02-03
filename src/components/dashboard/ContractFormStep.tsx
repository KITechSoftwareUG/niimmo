import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Euro, Calendar, CreditCard, AlertCircle } from "lucide-react";

interface ContractData {
  kaltmiete: string;
  betriebskosten: string;
  kaution_betrag: string;
  start_datum: string;
  ende_datum: string;
  lastschrift: boolean;
  bankkonto_mieter: string;
  ruecklastschrift_gebuehr: string;
}

interface ContractFormStepProps {
  contractData: ContractData;
  onChange: (data: Partial<ContractData>) => void;
  errors?: Partial<Record<keyof ContractData, string>>;
}

export const ContractFormStep = ({ contractData, onChange, errors }: ContractFormStepProps) => {
  
  const updateField = (field: keyof ContractData, value: string | boolean) => {
    onChange({ [field]: value });
  };

  const calculateWarmmiete = () => {
    const kaltmiete = parseFloat(contractData.kaltmiete) || 0;
    const betriebskosten = parseFloat(contractData.betriebskosten) || 0;
    return (kaltmiete + betriebskosten).toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Rent Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            Mietinformationen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kaltmiete">
                Kaltmiete (€) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="kaltmiete"
                type="number"
                step="0.01"
                min="0"
                value={contractData.kaltmiete}
                onChange={(e) => updateField('kaltmiete', e.target.value)}
                placeholder="800.00"
                className={errors?.kaltmiete ? 'border-destructive' : ''}
              />
              {errors?.kaltmiete && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.kaltmiete}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="betriebskosten">
                Betriebskosten (€) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="betriebskosten"
                type="number"
                step="0.01"
                min="0"
                value={contractData.betriebskosten}
                onChange={(e) => updateField('betriebskosten', e.target.value)}
                placeholder="150.00"
                className={errors?.betriebskosten ? 'border-destructive' : ''}
              />
              {errors?.betriebskosten && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.betriebskosten}
                </p>
              )}
            </div>
          </div>

          {/* Calculated Warmmiete */}
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-medium text-primary">Warmmiete gesamt:</span>
              <span className="text-lg font-bold text-primary">{calculateWarmmiete()}€</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kaution_betrag">Kaution (€)</Label>
              <Input
                id="kaution_betrag"
                type="number"
                step="0.01"
                min="0"
                value={contractData.kaution_betrag}
                onChange={(e) => updateField('kaution_betrag', e.target.value)}
                placeholder="1500.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ruecklastschrift_gebuehr">Rücklastschrift-Gebühr (€)</Label>
              <Input
                id="ruecklastschrift_gebuehr"
                type="number"
                step="0.01"
                min="0"
                value={contractData.ruecklastschrift_gebuehr}
                onChange={(e) => updateField('ruecklastschrift_gebuehr', e.target.value)}
                placeholder="7.50"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contract Dates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Vertragslaufzeit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_datum">
                Mietbeginn <span className="text-destructive">*</span>
              </Label>
              <Input
                id="start_datum"
                type="date"
                value={contractData.start_datum}
                onChange={(e) => updateField('start_datum', e.target.value)}
                className={errors?.start_datum ? 'border-destructive' : ''}
              />
              {errors?.start_datum && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.start_datum}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ende_datum">Mietende (optional)</Label>
              <Input
                id="ende_datum"
                type="date"
                value={contractData.ende_datum}
                onChange={(e) => updateField('ende_datum', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leer lassen für unbefristeten Vertrag
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Zahlungsinformationen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bankkonto_mieter">IBAN / Bankverbindung Mieter</Label>
            <Input
              id="bankkonto_mieter"
              value={contractData.bankkonto_mieter}
              onChange={(e) => updateField('bankkonto_mieter', e.target.value)}
              placeholder="DE89 3704 0044 0532 0130 00"
            />
            <p className="text-xs text-muted-foreground">
              Wird für Zahlungszuordnung und Lastschrifteinzug verwendet
            </p>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="lastschrift" className="text-base font-medium">
                SEPA-Lastschrift aktivieren
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatischer Einzug der Miete
              </p>
            </div>
            <Switch
              id="lastschrift"
              checked={contractData.lastschrift}
              onCheckedChange={(checked) => updateField('lastschrift', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};