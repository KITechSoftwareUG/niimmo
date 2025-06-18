
import { CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, X, Sparkles } from "lucide-react";

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
    <div className="elegant-card rounded-2xl p-6 mb-8">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 accent-red rounded-xl modern-shadow">
              <Filter className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-display font-semibold text-gray-800">Filter & Ansichten</h3>
              <p className="text-sm text-gray-500">Verfeinern Sie Ihre Suche</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 ml-auto">
            <div className="min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-2">Mietstatus</label>
              <Select
                value={filters.mietstatus || "all"}
                onValueChange={(value) => 
                  onFiltersChange({ ...filters, mietstatus: value })
                }
              >
                <SelectTrigger className="modern-input border-0 modern-shadow">
                  <SelectValue placeholder="Mietstatus wählen" />
                </SelectTrigger>
                <SelectContent className="elegant-card border-0 modern-shadow-lg">
                  <SelectItem value="all">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="h-4 w-4 text-gray-400" />
                      <span>Alle Mietstatuse</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="aktiv">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>Aktiv</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="gekündigt">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span>Gekündigt</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="beendet">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                      <span>Beendet</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="leerstehend">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span>Leerstehend</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-2">Zahlungsstatus</label>
              <Select
                value={filters.zahlungsstatus || "all"}
                onValueChange={(value) => 
                  onFiltersChange({ ...filters, zahlungsstatus: value })
                }
              >
                <SelectTrigger className="modern-input border-0 modern-shadow">
                  <SelectValue placeholder="Zahlungsstatus wählen" />
                </SelectTrigger>
                <SelectContent className="elegant-card border-0 modern-shadow-lg">
                  <SelectItem value="all">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="h-4 w-4 text-gray-400" />
                      <span>Alle Zahlungsstatuse</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="bezahlt">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>Bezahlt</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="offen">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span>Offen</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={resetFilters}
                  className="modern-input border-0 modern-shadow hover:bg-red-50 transition-all duration-300"
                >
                  <X className="h-4 w-4 mr-2" />
                  <span>Filter zurücksetzen</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </div>
  );
};
