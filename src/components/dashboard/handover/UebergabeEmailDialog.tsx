 import { useState } from "react";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Textarea } from "@/components/ui/textarea";
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
 import { useToast } from "@/hooks/use-toast";
 import { supabase } from "@/integrations/supabase/client";
 import { Loader2, Mail, Send, AlertCircle, CheckCircle2 } from "lucide-react";
 import { format } from "date-fns";
 import { de } from "date-fns/locale";
 
 interface Mieter {
   id: string;
   vorname: string;
   nachname: string | null;
   hauptmail: string | null;
 }
 
 interface ContractInfo {
   id: string;
   einheit: {
     etage?: string | null;
     immobilie: {
       name: string;
       adresse: string;
     };
   };
 }
 
 interface UebergabeEmailDialogProps {
   isOpen: boolean;
   onClose: () => void;
   mieter: Mieter[];
   contracts: ContractInfo[];
   uebergabeDatum: Date;
   mieterName: string;
 }
 
 export const UebergabeEmailDialog = ({
   isOpen,
   onClose,
   mieter,
   contracts,
   uebergabeDatum,
   mieterName,
 }: UebergabeEmailDialogProps) => {
   const { toast } = useToast();
   const [isSending, setIsSending] = useState(false);
   const [emailsSent, setEmailsSent] = useState(false);
   
   // Initialize email addresses from mieter data
   const [emailAddresses, setEmailAddresses] = useState<{ [mieterId: string]: string }>(
     () => {
       const initial: { [key: string]: string } = {};
       mieter.forEach((m) => {
         initial[m.id] = m.hauptmail || "";
       });
       return initial;
     }
   );
 
   const propertyInfo = contracts.length > 0
     ? `${contracts[0].einheit.immobilie.name}, ${contracts[0].einheit.immobilie.adresse}`
     : "Ihre Wohnung";
 
   const [emailSubject, setEmailSubject] = useState(
     `Bestätigung Ihrer Wohnungsübergabe am ${format(uebergabeDatum, "dd.MM.yyyy", { locale: de })}`
   );
 
   const [emailBody, setEmailBody] = useState(
     `Sehr geehrte/r ${mieterName},
 
 hiermit bestätigen wir die erfolgreiche Übergabe der Wohnung in ${propertyInfo} am ${format(uebergabeDatum, "dd.MM.yyyy", { locale: de })}.
 
 Alle Zählerstände wurden dokumentiert und das Übergabeprotokoll wurde erstellt. Eine Kopie des Protokolls finden Sie im Anhang dieser E-Mail.
 
 Wir bedanken uns für das angenehme Mietverhältnis und wünschen Ihnen für die Zukunft alles Gute.
 
 Mit freundlichen Grüßen
 Ihre Hausverwaltung`
   );
 
   const updateEmailAddress = (mieterId: string, email: string) => {
     setEmailAddresses((prev) => ({
       ...prev,
       [mieterId]: email,
     }));
   };
 
   const hasValidEmails = Object.values(emailAddresses).some(
     (email) => email && email.includes("@")
   );
 
   const handleSendEmails = async () => {
     const validEmails = Object.entries(emailAddresses)
       .filter(([_, email]) => email && email.includes("@"))
       .map(([mieterId, email]) => ({
         mieterId,
         email,
         name: mieter.find((m) => m.id === mieterId)
           ? `${mieter.find((m) => m.id === mieterId)!.vorname} ${mieter.find((m) => m.id === mieterId)!.nachname || ""}`
           : "",
       }));
 
     if (validEmails.length === 0) {
       toast({
         title: "Keine E-Mail-Adressen",
         description: "Bitte geben Sie mindestens eine gültige E-Mail-Adresse ein.",
         variant: "destructive",
       });
       return;
     }
 
     setIsSending(true);
 
     try {
       const response = await supabase.functions.invoke("send-uebergabe-email", {
         body: {
           recipients: validEmails,
           subject: emailSubject,
           body: emailBody,
           contractIds: contracts.map((c) => c.id),
           uebergabeDatum: format(uebergabeDatum, "yyyy-MM-dd"),
         },
       });
 
       if (response.error) throw response.error;
 
       setEmailsSent(true);
       
       // Update email addresses in database if changed
       for (const [mieterId, email] of Object.entries(emailAddresses)) {
         const originalMieter = mieter.find((m) => m.id === mieterId);
         if (originalMieter && email && email !== originalMieter.hauptmail) {
           await supabase
             .from("mieter")
             .update({ hauptmail: email })
             .eq("id", mieterId);
         }
       }
 
       toast({
         title: "E-Mails versendet",
         description: `${validEmails.length} E-Mail(s) wurden erfolgreich versendet.`,
       });
     } catch (error) {
       console.error("Error sending emails:", error);
       toast({
         title: "Fehler beim Versenden",
         description: "Die E-Mails konnten nicht versendet werden. Bitte überprüfen Sie die SMTP-Konfiguration.",
         variant: "destructive",
       });
     } finally {
       setIsSending(false);
     }
   };
 
   return (
     <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
       <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <Mail className="h-5 w-5 text-blue-600" />
             E-Mail an Mieter senden
           </DialogTitle>
         </DialogHeader>
 
         {emailsSent ? (
           <div className="py-8 text-center">
             <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
             <h3 className="text-lg font-semibold text-gray-900 mb-2">
               E-Mails erfolgreich versendet!
             </h3>
             <p className="text-gray-600 mb-6">
               Die Mieter wurden über die Wohnungsübergabe informiert.
             </p>
             <Button onClick={onClose}>Schließen</Button>
           </div>
         ) : (
           <div className="space-y-4">
             {/* Email Recipients */}
             <div className="space-y-3">
               <Label className="text-sm font-medium">Empfänger</Label>
               {mieter.map((m) => (
                 <div key={m.id} className="flex items-center gap-2">
                   <div className="flex-1">
                     <Label className="text-xs text-muted-foreground">
                       {m.vorname} {m.nachname || ""}
                     </Label>
                     <Input
                       type="email"
                       placeholder="E-Mail-Adresse eingeben..."
                       value={emailAddresses[m.id] || ""}
                       onChange={(e) => updateEmailAddress(m.id, e.target.value)}
                       className="h-10"
                     />
                   </div>
                 </div>
               ))}
               
               {!hasValidEmails && (
                 <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 p-2 rounded-lg">
                   <AlertCircle className="h-4 w-4 flex-shrink-0" />
                   <span>Bitte geben Sie mindestens eine gültige E-Mail-Adresse ein.</span>
                 </div>
               )}
             </div>
 
             {/* Email Subject */}
             <div className="space-y-2">
               <Label className="text-sm font-medium">Betreff</Label>
               <Input
                 value={emailSubject}
                 onChange={(e) => setEmailSubject(e.target.value)}
                 className="h-10"
               />
             </div>
 
             {/* Email Body */}
             <div className="space-y-2">
               <Label className="text-sm font-medium">Nachricht</Label>
               <Textarea
                 value={emailBody}
                 onChange={(e) => setEmailBody(e.target.value)}
                 className="min-h-[200px] resize-none"
               />
             </div>
 
             <DialogFooter className="gap-2 sm:gap-0">
               <Button variant="outline" onClick={onClose} disabled={isSending}>
                 Abbrechen
               </Button>
               <Button
                 onClick={handleSendEmails}
                 disabled={isSending || !hasValidEmails}
               >
                 {isSending ? (
                   <>
                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                     Wird gesendet...
                   </>
                 ) : (
                   <>
                     <Send className="mr-2 h-4 w-4" />
                     E-Mail senden
                   </>
                 )}
               </Button>
             </DialogFooter>
           </div>
         )}
       </DialogContent>
     </Dialog>
   );
 };