
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImmobilienSortingProps {
  onSortChange: (field: string, order: 'asc' | 'desc') => void;
}

export const ImmobilienSorting = ({ onSortChange }: ImmobilienSortingProps) => {
  const [sortField, setSortField] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSortFieldChange = (field: string) => {
    setSortField(field);
    onSortChange(field, sortOrder);
  };

  const handleSortOrderToggle = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    onSortChange(sortField, newOrder);
  };

  const getSortIcon = () => {
    if (sortOrder === 'asc') {
      return <ArrowUp className="h-4 w-4" />;
    } else {
      return <ArrowDown className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex items-center gap-4 mb-6">
      <span className="text-sm font-medium text-gray-700">Sortieren nach:</span>
      
      <Select value={sortField} onValueChange={handleSortFieldChange}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name">Name</SelectItem>
          <SelectItem value="einheiten_anzahl">Einheitenanzahl</SelectItem>
          <SelectItem value="auslastung">Auslastung</SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="sm"
        onClick={handleSortOrderToggle}
        className="flex items-center gap-2"
      >
        {getSortIcon()}
        {sortOrder === 'asc' ? 'Aufsteigend' : 'Absteigend'}
      </Button>
    </div>
  );
};
