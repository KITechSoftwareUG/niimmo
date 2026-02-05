 import { useState, useRef } from "react";
 import { Button } from "@/components/ui/button";
 import { Camera, X, Image as ImageIcon, Loader2 } from "lucide-react";
 import { supabase } from "@/integrations/supabase/client";
 import { useToast } from "@/hooks/use-toast";
 
 interface NotizenPhotoUploadProps {
   contractId: string;
   isEinzug: boolean;
   onPhotosChange: (photos: string[]) => void;
   existingPhotos?: string[];
 }
 
 export const NotizenPhotoUpload = ({
   contractId,
   isEinzug,
   onPhotosChange,
   existingPhotos = [],
 }: NotizenPhotoUploadProps) => {
   const [uploading, setUploading] = useState(false);
   const [photos, setPhotos] = useState<string[]>(existingPhotos);
   const inputRef = useRef<HTMLInputElement>(null);
   const { toast } = useToast();
 
   const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const files = e.target.files;
     if (!files || files.length === 0) return;
 
     setUploading(true);
 
     try {
       const newPhotos: string[] = [];
       
       for (let i = 0; i < files.length; i++) {
         const file = files[i];
         const fileExt = file.name.split(".").pop();
         const uebergabeTyp = isEinzug ? "einzug" : "auszug";
         const fileName = `notizen_${uebergabeTyp}_${Date.now()}_${i}.${fileExt}`;
         const filePath = `uebergabefotos/${contractId}/${fileName}`;
 
         const { error: uploadError } = await supabase.storage
           .from("dokumente")
           .upload(filePath, file, { upsert: true });
 
         if (uploadError) throw uploadError;
 
         newPhotos.push(filePath);
       }
 
       const updatedPhotos = [...photos, ...newPhotos];
       setPhotos(updatedPhotos);
       onPhotosChange(updatedPhotos);
 
       toast({
         title: "Fotos hochgeladen",
         description: `${files.length} Foto(s) wurden gespeichert.`,
       });
     } catch (error) {
       console.error("Upload error:", error);
       toast({
         title: "Fehler",
         description: "Fotos konnten nicht hochgeladen werden.",
         variant: "destructive",
       });
     } finally {
       setUploading(false);
       if (inputRef.current) {
         inputRef.current.value = "";
       }
     }
   };
 
   const removePhoto = (index: number) => {
     const updatedPhotos = photos.filter((_, i) => i !== index);
     setPhotos(updatedPhotos);
     onPhotosChange(updatedPhotos);
   };
 
   const getPublicUrl = (path: string) => {
     const { data } = supabase.storage.from("dokumente").getPublicUrl(path);
     return data.publicUrl;
   };
 
   return (
     <div className="space-y-2">
       <input
         ref={inputRef}
         type="file"
         accept="image/*"
         capture="environment"
         multiple
         onChange={handleCapture}
         className="hidden"
       />
 
       {photos.length > 0 && (
         <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
           {photos.map((photoPath, index) => (
             <div
               key={index}
               className="relative aspect-square rounded-lg overflow-hidden bg-gray-100"
             >
               <img
                 src={getPublicUrl(photoPath)}
                 alt={`Übergabe Foto ${index + 1}`}
                 className="w-full h-full object-cover"
               />
               <button
                 type="button"
                 onClick={() => removePhoto(index)}
                 className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md"
               >
                 <X className="h-3 w-3" />
               </button>
             </div>
           ))}
         </div>
       )}
 
       <Button
         type="button"
         variant="outline"
         size="sm"
         onClick={() => inputRef.current?.click()}
         disabled={uploading}
         className="w-full h-10 border-dashed"
       >
         {uploading ? (
           <Loader2 className="h-4 w-4 animate-spin mr-2" />
         ) : (
           <Camera className="h-4 w-4 mr-2" />
         )}
         {uploading ? "Wird hochgeladen..." : "Fotos hinzufügen"}
       </Button>
     </div>
   );
 };