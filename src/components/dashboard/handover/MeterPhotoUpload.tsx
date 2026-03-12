import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MeterPhotoUploadProps {
  contractId: string;
  meterType: "strom" | "gas" | "wasser" | "warmwasser";
  isEinzug: boolean;
  onPhotoUploaded: (url: string) => void;
  existingPhotoUrl?: string;
}

export const MeterPhotoUpload = ({
  contractId,
  meterType,
  isEinzug,
  onPhotoUploaded,
  existingPhotoUrl,
}: MeterPhotoUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(existingPhotoUrl || null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const meterLabels: Record<string, string> = {
    strom: "Strom",
    gas: "Gas",
    wasser: "Kaltwasser",
    warmwasser: "Warmwasser",
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const uebergabeTyp = isEinzug ? "einzug" : "auszug";
      const fileName = `${meterType}_${uebergabeTyp}_${Date.now()}.${fileExt}`;
      const filePath = `zaehlerfotos/${contractId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("dokumente")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = await supabase.storage
        .from("dokumente")
        .createSignedUrl(filePath, 3600);

      setPhotoUrl(urlData?.signedUrl || null);
      onPhotoUploaded(filePath);

      toast({
        title: "Foto gespeichert",
        description: `${meterLabels[meterType]}-Zählerfoto wurde hochgeladen.`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Fehler",
        description: "Foto konnte nicht hochgeladen werden.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = () => {
    setPhotoUrl(null);
    onPhotoUploaded("");
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
      />

      {photoUrl ? (
        <div className="relative w-full h-20 rounded-lg overflow-hidden bg-gray-100">
          <img
            src={photoUrl}
            alt={`${meterLabels[meterType]} Zähler`}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={removePhoto}
            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-10 border-dashed"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Camera className="h-4 w-4 mr-1" />
              Foto
            </>
          )}
        </Button>
      )}
    </div>
  );
};
