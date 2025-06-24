
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Filter } from "lucide-react";

interface FilterPanelProps {
  filters: {
    mietstatus: string;
    zahlungsstatus: string;
  };
  onFilterChange: (key: string, value: string) => void;
  activeFiltersCount: number;
}

export const FilterPanel = ({ filters, onFilterChange, activeFiltersCount }: FilterPanelProps) => {
  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filter
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFiltersCount} aktiv
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Mietstatus</label>
            <Select value={filters.mietstatus} onValueChange={(value) => onFilterChange('mietstatus', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Alle Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="aktiv">Aktiv</SelectItem>
                <SelectItem value="gekündigt">Gekündigt</SelectItem>
                <SelectItem value="leerstehend">Leerstehend</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Zahlungsstatus</label>
            <Select value={filters.zahlungsstatus} onValueChange={(value) => onFilterChange('zahlungsstatus', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Alle Zahlungen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Zahlungen</SelectItem>
                <SelectItem value="bezahlt">Bezahlt</SelectItem>
                <SelectItem value="offen">Offen</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
