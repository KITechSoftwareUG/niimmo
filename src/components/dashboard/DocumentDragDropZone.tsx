import { useState, useCallback } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentDragDropZoneProps {
  onFileSelect: (file: File) => void;
  children?: React.ReactNode;
  className?: string;
  accept?: string;
  showOverlay?: boolean;
}

export function DocumentDragDropZone({
  onFileSelect,
  children,
  className,
  accept = ".pdf,.jpg,.jpeg,.png,.doc,.docx",
  showOverlay = true,
}: DocumentDragDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragCounter(prev => prev + 1);
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragCounter(prev => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setIsDragging(false);
      }
      return newCounter;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(false);
    setDragCounter(0);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      // Check if file type is accepted
      if (accept) {
        const acceptedTypes = accept.split(',').map(type => type.trim());
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        const fileMimeType = file.type;
        
        const isAccepted = acceptedTypes.some(acceptedType => {
          if (acceptedType.startsWith('.')) {
            return fileExtension === acceptedType.toLowerCase();
          }
          return fileMimeType.match(new RegExp(acceptedType.replace('*', '.*')));
        });
        
        if (!isAccepted) {
          return;
        }
      }
      
      onFileSelect(file);
    }
  }, [accept, onFileSelect]);

  return (
    <div
      className={cn("relative", className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
      
      {showOverlay && isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg">
          <div className="flex flex-col items-center gap-3 text-primary">
            <Upload className="h-12 w-12 animate-bounce" />
            <p className="text-lg font-semibold">Datei hier ablegen...</p>
            <p className="text-sm opacity-80">Um hochzuladen</p>
          </div>
        </div>
      )}
    </div>
  );
}
