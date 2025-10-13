import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, Building2, Square, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEditableField } from "@/hooks/useEditableField";

interface MietvertragTenantInfoProps {
  mieter: any[];
  immobilie?: any;
  einheit?: any;
  isGlobalEditMode?: boolean;
  editedValues?: Record<string, any>;
  onUpdateEditedValue?: (key: string, value: any) => void;
}

export function MietvertragTenantInfo({
  mieter,
  immobilie,
  einheit,
  isGlobalEditMode = false,
  editedValues = {},
  onUpdateEditedValue
}: MietvertragTenantInfoProps) {
  const {
    startEditing,
    updateValue,
    cancelEdit,
    getEditingValue,
    isFieldEditing,
    saveSingleField
  } = useEditableField();

  const handleSave = async (mieterId: string, field: string) => {
    await saveSingleField(mieterId, field, { table: 'mieter' });
  };
  
  const getValue = (mieterId: string, field: string, originalValue: any) => {
    const key = `mieter_${mieterId}_${field}`;
    if (isGlobalEditMode && editedValues[key] !== undefined) {
      return editedValues[key];
    }
    if (isFieldEditing(mieterId, field)) {
      return getEditingValue(mieterId, field);
    }
    return originalValue;
  };
  
  const handleChange = (mieterId: string, field: string, value: any) => {
    if (isGlobalEditMode) {
      onUpdateEditedValue?.(`mieter_${mieterId}_${field}`, value);
    } else {
      updateValue(mieterId, field, value);
    }
  };

  const isEditing = (mieterId: string, field: string) => {
    return isGlobalEditMode || isFieldEditing(mieterId, field);
  };

  return (
    <Card>
      <CardHeader className="pb-3 md:pb-6">
        <CardTitle className="text-base md:text-lg">Mieter Informationen</CardTitle>
      </CardHeader>
      <CardContent>
        {mieter && mieter.length > 0 ? (
          <div className="space-y-3 md:space-y-4">
            {mieter.map((m: any) => (
              <div key={m.id} className="p-3 md:p-4 border rounded-lg">
                <div className="space-y-2 md:space-y-3">
                  {/* Name Fields */}
                  <div className="space-y-2">
                    {/* Vorname Field */}
                    <div className="flex items-center space-x-2">
                      {isEditing(m.id, 'vorname') ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            type="text"
                            value={getValue(m.id, 'vorname', m.vorname) || ''}
                            onChange={(e) => handleChange(m.id, 'vorname', e.target.value)}
                            className="flex-1"
                            placeholder="Vorname"
                          />
                          {!isGlobalEditMode && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSave(m.id, 'vorname')}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => cancelEdit(m.id, 'vorname')}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-sm md:text-base font-semibold">
                            {getValue(m.id, 'vorname', m.vorname)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Nachname Field */}
                    <div className="flex items-center space-x-2">
                      {isEditing(m.id, 'nachname') ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            type="text"
                            value={getValue(m.id, 'nachname', m.nachname) || ''}
                            onChange={(e) => handleChange(m.id, 'nachname', e.target.value)}
                            className="flex-1"
                            placeholder="Nachname"
                          />
                          {!isGlobalEditMode && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSave(m.id, 'nachname')}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => cancelEdit(m.id, 'nachname')}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-sm md:text-base font-semibold">
                            {getValue(m.id, 'nachname', m.nachname)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Email Field */}
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {isEditing(m.id, 'hauptmail') ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          type="email"
                          value={getValue(m.id, 'hauptmail', m.hauptmail) || ''}
                          onChange={(e) => handleChange(m.id, 'hauptmail', e.target.value)}
                          className="flex-1"
                        />
                        {!isGlobalEditMode && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSave(m.id, 'hauptmail')}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => cancelEdit(m.id, 'hauptmail')}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-sm text-muted-foreground">
                          {getValue(m.id, 'hauptmail', m.hauptmail) || 'Keine E-Mail'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Phone Field */}
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {isEditing(m.id, 'telnr') ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          type="tel"
                          value={getValue(m.id, 'telnr', m.telnr) || ''}
                          onChange={(e) => handleChange(m.id, 'telnr', e.target.value)}
                          className="flex-1"
                        />
                        {!isGlobalEditMode && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSave(m.id, 'telnr')}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => cancelEdit(m.id, 'telnr')}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-sm text-muted-foreground">
                          {getValue(m.id, 'telnr', m.telnr) || 'Keine Telefonnummer'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">Keine Mieter gefunden</p>
        )}
        
        {/* Immobilie und Einheit Informationen */}
        <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t">
          <div className="space-y-3 md:space-y-4">
            {immobilie && (
              <div className="flex items-start space-x-2">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="text-sm md:text-base">
                  <span className="font-medium">Immobilie: </span>
                  <span className="text-foreground">{immobilie.name}</span>
                  {immobilie.adresse && (
                    <span className="text-muted-foreground text-xs md:text-sm block md:inline md:ml-2">
                      ({immobilie.adresse})
                    </span>
                  )}
                </div>
              </div>
            )}
            {einheit && (
              <div className="flex items-start space-x-2">
                <Square className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="text-sm md:text-base">
                  <span className="font-medium">Einheit: </span>
                  <span className="text-foreground">
                    {einheit.einheitentyp} - {einheit.id?.slice(-2) || 'N/A'}
                  </span>
                  {einheit.qm && (
                    <span className="text-muted-foreground text-xs md:text-sm block md:inline md:ml-2">
                      ({Number(einheit.qm).toFixed(2)} m²)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
