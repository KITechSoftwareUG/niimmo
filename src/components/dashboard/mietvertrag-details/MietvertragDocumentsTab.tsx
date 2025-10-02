import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Edit3, X, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PdfPreviewModal } from "../PdfPreviewModal";

interface MietvertragDocumentsTabProps {
  dokumente: any[];
  formatDatum: (datum: string) => string;
  onDocumentsChange?: () => void; // Callback for refreshing after category changes
}

type SortBy = 'kategorie' | 'titel' | 'datum';
type SortDirection = 'asc' | 'desc';

const DOCUMENT_CATEGORIES = [
  'Mietvertrag',
  'Kündigung', 
  'Übergabeprotokoll',
  'Sonstiges',
  'Mietkaution',
  'Mieterunterlagen',
  'Schriftverkehr'
];

export function MietvertragDocumentsTab({
  dokumente,
  formatDatum,
  onDocumentsChange
}: MietvertragDocumentsTabProps) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('kategorie');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [updatingCategory, setUpdatingCategory] = useState<string | null>(null);
  const [previewDokument, setPreviewDokument] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  const handlePreview = (dokument: any) => {
    setPreviewDokument(dokument);
    setIsPreviewOpen(true);
  };

  // Sort documents
  const sortedDokumente = useMemo(() => {
    if (!dokumente || dokumente.length === 0) return [];
    
    const sorted = [...dokumente].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'kategorie':
          comparison = (a.kategorie || '').localeCompare(b.kategorie || '');
          break;
        case 'titel':
          comparison = (a.titel || '').localeCompare(b.titel || '');
          break;
        case 'datum':
          const dateA = new Date(a.hochgeladen_am || 0).getTime();
          const dateB = new Date(b.hochgeladen_am || 0).getTime();
          comparison = dateA - dateB;
          break;
        default:
          return 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [dokumente, sortBy, sortDirection]);

  // Group documents by category for better overview
  const groupedDokumente = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    
    sortedDokumente.forEach(doc => {
      const kategorie = doc.kategorie || 'Sonstiges';
      if (!groups[kategorie]) {
        groups[kategorie] = [];
      }
      groups[kategorie].push(doc);
    });
    
    return groups;
  }, [sortedDokumente]);

  const handleSort = (newSortBy: SortBy) => {
    if (sortBy === newSortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortBy) => {
    if (sortBy !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const handleCategoryChange = async (dokumentId: string, newCategory: string) => {
    setUpdatingCategory(dokumentId);
    try {
      const { error } = await supabase
        .from('dokumente')
        .update({ kategorie: newCategory as any }) // Cast to avoid TypeScript enum issues
        .eq('id', dokumentId);

      if (error) {
        console.error('Error updating category:', error);
        toast({
          title: "Fehler",
          description: "Kategorie konnte nicht geändert werden.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erfolg",
          description: "Kategorie wurde erfolgreich geändert.",
        });
        // Trigger refresh if callback provided
        onDocumentsChange?.();
      }
    } catch (error) {
      console.error('Error updating category:', error);
      toast({
        title: "Fehler", 
        description: "Ein Fehler ist aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setUpdatingCategory(null);
      setEditingCategory(null);
    }
  };

  const handleDownload = async (dokument: any) => {
    if (!dokument || !dokument.pfad) {
      toast({
        title: "Fehler",
        description: "Dokument-Pfad nicht gefunden.",
        variant: "destructive",
      });
      return;
    }

    setDownloading(dokument.id);
    try {
      // Create a signed URL for private bucket access
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('dokumente')
        .createSignedUrl(dokument.pfad, 60); // Valid for 60 seconds

      if (signedUrlError) {
        console.error('Signed URL Error:', signedUrlError);
        toast({
          variant: "destructive",
          title: "Download fehlgeschlagen",
          description: `Fehler beim Download: ${signedUrlError.message}`
        });
        return;
      }

      // Download using the signed URL
      const response = await fetch(signedUrlData.signedUrl);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = dokument.titel || 'dokument';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download erfolgreich",
        description: `${dokument.titel} wurde heruntergeladen.`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Fehler",
        description: "Dokument konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Dokumente</span>
              <Badge variant="secondary" className="ml-2">
                {dokumente?.length || 0}
              </Badge>
            </div>
            
            {/* Sorting Controls */}
            {dokumente && dokumente.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sortieren:</span>
                <Button
                  variant={sortBy === 'kategorie' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSort('kategorie')}
                  className="gap-1"
                >
                  Kategorie {getSortIcon('kategorie')}
                </Button>
                <Button
                  variant={sortBy === 'titel' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSort('titel')}
                  className="gap-1"
                >
                  Titel {getSortIcon('titel')}
                </Button>
                <Button
                  variant={sortBy === 'datum' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSort('datum')}
                  className="gap-1"
                >
                  Datum {getSortIcon('datum')}
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dokumente && dokumente.length > 0 ? (
            <div className="space-y-4">
              {sortBy === 'kategorie' ? (
                // Group by category when sorting by category
                Object.entries(groupedDokumente).map(([kategorie, docs]) => (
                  <div key={kategorie} className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Badge variant="outline" className="px-3 py-1">
                        {kategorie}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        ({docs.length} Dokument{docs.length !== 1 ? 'e' : ''})
                      </span>
                    </div>
                    
                    {docs.map((dok) => (
                      <div
                        key={dok.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium">{dok.titel}</p>
                              
                              {/* Editable Category */}
                              <div className="flex items-center gap-1">
                                {editingCategory === dok.id ? (
                                  <div className="flex items-center gap-1">
                                    <Select
                                      value={dok.kategorie}
                                      onValueChange={(value) => handleCategoryChange(dok.id, value)}
                                      disabled={updatingCategory === dok.id}
                                    >
                                      <SelectTrigger className="w-40 h-7">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {DOCUMENT_CATEGORIES.map((cat) => (
                                          <SelectItem key={cat} value={cat}>
                                            {cat}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingCategory(null)}
                                      className="h-7 w-7 p-0"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <Badge variant="secondary" className="text-xs">
                                      {dok.kategorie}
                                    </Badge>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingCategory(dok.id)}
                                      className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                                    >
                                      <Edit3 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <p className="text-sm text-muted-foreground">
                              {formatDatum(dok.hochgeladen_am)}
                              {dok.groesse_bytes && ` • ${Math.round(dok.groesse_bytes / 1024)}KB`}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handlePreview(dok)}
                            size="sm"
                            variant="outline"
                            disabled={updatingCategory === dok.id}
                            className="flex items-center space-x-2"
                          >
                            <Eye className="h-4 w-4" />
                            <span>Vorschau</span>
                          </Button>
                          
                          <Button
                            onClick={() => handleDownload(dok)}
                            size="sm"
                            variant="outline"
                            disabled={downloading === dok.id || updatingCategory === dok.id}
                            className="flex items-center space-x-2"
                          >
                            {downloading === dok.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                            <span>{downloading === dok.id ? 'Lädt...' : 'Download'}</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                // Linear list for other sorting
                sortedDokumente.map((dok) => (
                  <div
                    key={dok.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{dok.titel}</p>
                          
                          {/* Editable Category */}
                          <div className="flex items-center gap-1">
                            {editingCategory === dok.id ? (
                              <div className="flex items-center gap-1">
                                <Select
                                  value={dok.kategorie}
                                  onValueChange={(value) => handleCategoryChange(dok.id, value)}
                                  disabled={updatingCategory === dok.id}
                                >
                                  <SelectTrigger className="w-40 h-7">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {DOCUMENT_CATEGORIES.map((cat) => (
                                      <SelectItem key={cat} value={cat}>
                                        {cat}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingCategory(null)}
                                  className="h-7 w-7 p-0"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Badge variant="secondary" className="text-xs">
                                  {dok.kategorie}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingCategory(dok.id)}
                                  className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <p className="text-sm text-muted-foreground">
                          {dok.kategorie} • {formatDatum(dok.hochgeladen_am)}
                          {dok.groesse_bytes && ` • ${Math.round(dok.groesse_bytes / 1024)}KB`}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handlePreview(dok)}
                        size="sm"
                        variant="outline"
                        disabled={updatingCategory === dok.id}
                        className="flex items-center space-x-2"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Vorschau</span>
                      </Button>
                      
                      <Button
                        onClick={() => handleDownload(dok)}
                        size="sm"
                        variant="outline"
                        disabled={downloading === dok.id || updatingCategory === dok.id}
                        className="flex items-center space-x-2"
                      >
                        {downloading === dok.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        <span>{downloading === dok.id ? 'Lädt...' : 'Download'}</span>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Keine Dokumente vorhanden</p>
            </div>
          )}
        </CardContent>
      </Card>
      <PdfPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => { setIsPreviewOpen(false); setPreviewDokument(null); }}
        dokument={previewDokument}
      />
    </div>
  );
}