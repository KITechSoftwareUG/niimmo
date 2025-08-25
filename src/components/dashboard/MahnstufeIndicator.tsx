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
            "w-3 h-8 rounded-md border transition-all duration-300 shadow-sm",
            level <= stufe
              ? level === 1
                ? "bg-gradient-to-t from-yellow-400 to-yellow-500 border-yellow-300 shadow-yellow-200"
                : level === 2
                ? "bg-gradient-to-t from-orange-400 to-orange-500 border-orange-300 shadow-orange-200"
                : "bg-gradient-to-t from-red-400 to-red-500 border-red-300 shadow-red-200"
              : "bg-gradient-to-t from-gray-100 to-gray-200 border-gray-300"
          )}
        />
      ))}
    </div>
  );
};