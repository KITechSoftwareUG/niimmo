import { cn } from "@/lib/utils";

interface MahnstufeIndicatorProps {
  stufe: number;
  className?: string;
}

export const MahnstufeIndicator = ({ stufe, className }: MahnstufeIndicatorProps) => {
  return (
    <div className={cn("flex items-center space-x-1", className)}>
      {[1, 2, 3].map((level) => (
        <div
          key={level}
          className={cn(
            "w-2 h-6 rounded-sm transition-colors",
            level <= stufe
              ? level === 1
                ? "bg-yellow-500"
                : level === 2
                ? "bg-orange-500"
                : "bg-red-500"
              : "bg-muted/30"
          )}
        />
      ))}
    </div>
  );
};