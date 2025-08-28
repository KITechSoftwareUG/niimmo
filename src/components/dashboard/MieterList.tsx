
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User, Mail, UserCheck, Copy, Phone, Edit2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

interface MieterListProps {
  mieter: any[];
}

export const MieterList = ({ mieter }: MieterListProps) => {
  const { toast } = useToast();
  const [editingMieter, setEditingMieter] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    hauptmail: string;
    telnr: string;
    weitere_mails: string;
  }>({ hauptmail: '', telnr: '', weitere_mails: '' });

  // Debug: Console log um die Datenstruktur zu sehen
  console.log('MieterList mieter data:', mieter);

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Kopiert!",
        description: `${type} wurde in die Zwischenablage kopiert.`,
      });
    } catch (err) {
      toast({
        title: "Fehler",
        description: `${type} konnte nicht kopiert werden.`,
        variant: "destructive",
      });
    }
  };

  const startEditing = (mieterData: any) => {
    console.log('Starting edit for mieter:', mieterData);
    // Handle different data structures - either direct mieter object or nested mieter.mieter
    const mieterObj = mieterData.mieter || mieterData;
    const mieterId = mieterObj.id;
    
    if (!mieterId) {
      console.error('No mieter ID found in:', mieterData);
      return;
    }
    
    setEditingMieter(mieterId);
    setEditValues({
      hauptmail: mieterObj.hauptmail || '',
      telnr: mieterObj.telnr || '',
      weitere_mails: mieterObj.weitere_mails || ''
    });
  };

  const cancelEditing = () => {
    setEditingMieter(null);
    setEditValues({ hauptmail: '', telnr: '', weitere_mails: '' });
  };

  const saveChanges = async (mieterId: string) => {
    console.log('Saving changes for mieter ID:', mieterId, 'with values:', editValues);
    try {
      const { error } = await supabase
        .from('mieter')
        .update({
          hauptmail: editValues.hauptmail || null,
          telnr: editValues.telnr || null,
          weitere_mails: editValues.weitere_mails || null
        })
        .eq('id', mieterId);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      toast({
        title: "Erfolgreich gespeichert",
        description: "Die Kontaktdaten wurden aktualisiert.",
      });

      setEditingMieter(null);
      setEditValues({ hauptmail: '', telnr: '', weitere_mails: '' });
      
      // Seite neu laden, um die Änderungen anzuzeigen
      window.location.reload();
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      toast({
        title: "Fehler",
        description: "Die Kontaktdaten konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  if (!mieter || mieter.length === 0) {
    return null;
  }

  return (
    <Card className="elegant-card border-0 shadow-lg rounded-2xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
        <CardTitle className="flex items-center space-x-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <User className="h-5 w-5 text-green-600" />
          </div>
          <span className="text-xl font-semibold text-gray-800">Mieter</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <div className="grid gap-6">
          {mieter.map((m, index) => {
            // Handle different data structures - either direct mieter object or nested mieter.mieter
            const mieterObj = m.mieter || m;
            const mieterId = mieterObj.id;
            
            return (
              <div key={mieterId || index} className="p-6 bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 hover:shadow-md transition-all duration-200">
                <div className="flex justify-between items-start">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full">
                      <UserCheck className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                          {mieterObj?.vorname} {mieterObj?.nachname}
                        </h3>
                        {m.rolle && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {m.rolle}
                          </Badge>
                        )}
                      </div>
                    
                    <div className="space-y-2">
                      {/* Hauptmail */}
                      <div className="flex items-center justify-between group">
                        <div className="flex items-center space-x-2 flex-1">
                          <Mail className="h-4 w-4 text-gray-500" />
                          {editingMieter === mieterId ? (
                            <Input
                              value={editValues.hauptmail}
                              onChange={(e) => setEditValues(prev => ({ ...prev, hauptmail: e.target.value }))}
                              placeholder="E-Mail-Adresse"
                              className="text-sm"
                            />
                          ) : (
                            <span className="text-gray-700 bg-gray-100 px-3 py-1 rounded-full text-sm">
                              {mieterObj?.hauptmail || 'Keine E-Mail'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {editingMieter === mieterId ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => saveChanges(mieterId)}
                                className="h-6 w-6 p-0"
                              >
                                <Check className="h-3 w-3 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEditing}
                                className="h-6 w-6 p-0"
                              >
                                <X className="h-3 w-3 text-red-600" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (mieterObj?.hauptmail) {
                                    copyToClipboard(mieterObj.hauptmail, 'E-Mail-Adresse');
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded"
                                title="E-Mail-Adresse kopieren"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => startEditing(m)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded"
                                title="Bearbeiten"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Telefonnummer */}
                      <div className="flex items-center justify-between group">
                        <div className="flex items-center space-x-2 flex-1">
                          <Phone className="h-4 w-4 text-gray-500" />
                          {editingMieter === mieterId ? (
                            <Input
                              value={editValues.telnr}
                              onChange={(e) => setEditValues(prev => ({ ...prev, telnr: e.target.value }))}
                              placeholder="Telefonnummer"
                              className="text-sm"
                            />
                          ) : (
                            <span className="text-gray-700 bg-gray-100 px-3 py-1 rounded-full text-sm">
                              {mieterObj?.telnr || 'Keine Telefonnummer'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {editingMieter !== mieterId && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (mieterObj?.telnr) {
                                    copyToClipboard(mieterObj.telnr, 'Telefonnummer');
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded"
                                title="Telefonnummer kopieren"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Weitere E-Mails */}
                      <div className="flex items-center justify-between group">
                        <div className="flex items-center space-x-2 flex-1">
                          <Mail className="h-4 w-4 text-gray-400" />
                          {editingMieter === mieterId ? (
                            <Input
                              value={editValues.weitere_mails}
                              onChange={(e) => setEditValues(prev => ({ ...prev, weitere_mails: e.target.value }))}
                              placeholder="Weitere E-Mail-Adressen"
                              className="text-sm"
                            />
                          ) : (
                            <span className="text-gray-600 bg-gray-50 px-3 py-1 rounded-full text-sm">
                              {mieterObj?.weitere_mails || 'Keine weiteren E-Mails'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {editingMieter !== mieterId && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (mieterObj?.weitere_mails) {
                                    copyToClipboard(mieterObj.weitere_mails, 'Alternative E-Mail-Adresse');
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded"
                                title="Alternative E-Mail-Adresse kopieren"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
