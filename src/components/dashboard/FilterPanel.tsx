
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";

interface FilterPanelProps {
  filters: {
    mietstatus: string;
    zahlungsstatus: string;
  };
  onFiltersChange: (filters: { mietstatus: string; zahlungsstatus: string }) => void;
}

export const FilterPanel = ({ filters, onFiltersChange }: FilterPanelProps) => {
  const resetFilters = () => {
    onFiltersChange({ mietstatus: "all", zahlungsstatus: "all" });
  };

  const hasActiveFilters = filters.mietstatus !== "all" && filters.mietstatus !== "" && 
                          filters.zahlungsstatus !== "all" && filters.zahlungsstatus !== "";

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Filter:</span>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="min-w-[180px]">
              <Select
                value={filters.mietstatus || "all"}
                onValueChange={(value) => 
                  onFiltersChange({ ...filters, mietstatus: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Mietstatus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Mietstatuse</SelectItem>
                  <SelectItem value="aktiv">Aktiv</SelectItem>
                  <SelectItem value="gekündigt">Gekündigt</SelectItem>
                  <SelectItem value="beendet">Beendet</SelectItem>
                  <SelectItem value="leerstehend">Leerstehend</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[180px]">
              <Select
                value={filters.zahlungsstatus || "all"}
                onValueChange={(value) => 
                  onFiltersChange({ ...filters, zahlungsstatus: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Zahlungsstatus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Zahlungsstatuse</SelectItem>
                  <SelectItem value="bezahlt">Bezahlt</SelectItem>
                  <SelectItem value="offen">Offen</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={resetFilters}
                className="flex items-center space-x-1"
              >
                <X className="h-3 w-3" />
                <span>Zurücksetzen</span>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
