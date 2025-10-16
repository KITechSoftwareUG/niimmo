import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Check, X } from "lucide-react";

interface MietvertragEditableFieldProps {
  label: string;
  value: string | number;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (value: string) => void;
  onCancel: () => void;
  type?: "text" | "number" | "textarea" | "date";
  step?: string;
  className?: string;
  formatter?: (value: string | number) => string;
  showLastUpdate?: string;
  placeholder?: string;
  hideEditButton?: boolean;
}

export function MietvertragEditableField({
  label,
  value,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  type = "text",
  step,
  className = "",
  formatter,
  showLastUpdate,
  placeholder,
  hideEditButton = false
}: MietvertragEditableFieldProps) {
  const [editValue, setEditValue] = useState(value?.toString() || "");

  const handleEdit = () => {
    setEditValue(value?.toString() || "");
    onEdit();
  };

  const handleSave = () => {
    onSave(editValue);
  };

  const displayValue = formatter ? formatter(value) : value?.toString() || "N/A";

  return (
    <div>
      <p className="text-xs md:text-sm font-medium text-muted-foreground">{label}</p>
      {isEditing ? (
        <div className={`flex ${type === "textarea" ? "flex-col" : "flex-wrap items-center"} gap-2`}>
          {type === "textarea" ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="min-h-[80px] resize-none text-sm"
              placeholder={placeholder || ""}
              rows={3}
            />
          ) : (
            <Input
              type={type}
              step={step}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className={`w-full h-8 text-sm ${type === 'date' ? 'sm:w-44' : 'sm:w-32'}`}
              placeholder={type === "number" ? "0.00" : placeholder || ""}
            />
          )}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              size="sm"
              className="h-8 w-8 p-0"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              onClick={onCancel}
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <p className={`text-sm md:text-lg ${className}`}>{displayValue}</p>
            {!hideEditButton && (
              <Button
                onClick={handleEdit}
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 opacity-60 hover:opacity-100 flex-shrink-0"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          {showLastUpdate && (
            <p className="text-xs text-muted-foreground">
              Letzte Erhöhung: {showLastUpdate}
            </p>
          )}
        </div>
      )}
    </div>
  );
}