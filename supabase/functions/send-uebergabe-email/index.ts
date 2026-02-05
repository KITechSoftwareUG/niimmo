 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
     "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
 interface EmailRecipient {
   mieterId: string;
   email: string;
   name: string;
 }
 
 interface EmailRequest {
   recipients: EmailRecipient[];
   subject: string;
   body: string;
   contractIds: string[];
   uebergabeDatum: string;
 }
 
 const handler = async (req: Request): Promise<Response> => {
   // Handle CORS preflight requests
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const { recipients, subject, body }: EmailRequest = await req.json();
 
     // Validate required fields
     if (!recipients || recipients.length === 0) {
       throw new Error("Keine Empfänger angegeben");
     }
 
     if (!subject || !body) {
       throw new Error("Betreff und Nachricht sind erforderlich");
     }
 
     // Get SMTP configuration from environment
     const smtpHost = Deno.env.get("SMTP_HOST");
     const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
     const smtpUser = Deno.env.get("SMTP_USER");
     const smtpPass = Deno.env.get("SMTP_PASS");
     const smtpFromEmail = Deno.env.get("SMTP_FROM_EMAIL");
     const smtpFromName = Deno.env.get("SMTP_FROM_NAME") || "Hausverwaltung";
 
     if (!smtpHost || !smtpUser || !smtpPass || !smtpFromEmail) {
       console.error("SMTP configuration missing:", {
         hasHost: !!smtpHost,
         hasUser: !!smtpUser,
         hasPass: !!smtpPass,
         hasFromEmail: !!smtpFromEmail,
       });
       throw new Error(
         "SMTP-Konfiguration unvollständig. Bitte SMTP_HOST, SMTP_USER, SMTP_PASS und SMTP_FROM_EMAIL konfigurieren."
       );
     }
 
     // Create SMTP client
     const client = new SMTPClient({
       connection: {
         hostname: smtpHost,
         port: smtpPort,
         tls: smtpPort === 465,
         auth: {
           username: smtpUser,
           password: smtpPass,
         },
       },
     });
 
     const sentEmails: string[] = [];
     const failedEmails: { email: string; error: string }[] = [];
 
     // Send email to each recipient
     for (const recipient of recipients) {
       try {
         await client.send({
           from: `${smtpFromName} <${smtpFromEmail}>`,
           to: recipient.email,
           subject: subject,
           content: body,
           html: body.replace(/\n/g, "<br>"),
         });
 
         console.log(`Email sent successfully to: ${recipient.email}`);
         sentEmails.push(recipient.email);
       } catch (emailError) {
         console.error(`Failed to send email to ${recipient.email}:`, emailError);
         failedEmails.push({
           email: recipient.email,
           error: emailError instanceof Error ? emailError.message : "Unknown error",
         });
       }
     }
 
     // Close SMTP connection
     await client.close();
 
     if (sentEmails.length === 0 && failedEmails.length > 0) {
       throw new Error(
         `Alle E-Mails konnten nicht versendet werden: ${failedEmails.map((f) => f.error).join(", ")}`
       );
     }
 
     return new Response(
       JSON.stringify({
         success: true,
         sentEmails,
         failedEmails,
         message: `${sentEmails.length} E-Mail(s) erfolgreich versendet${
           failedEmails.length > 0 ? `, ${failedEmails.length} fehlgeschlagen` : ""
         }`,
       }),
       {
         status: 200,
         headers: {
           "Content-Type": "application/json",
           ...corsHeaders,
         },
       }
     );
   } catch (error) {
     console.error("Error in send-uebergabe-email function:", error);
     return new Response(
       JSON.stringify({
         error: error instanceof Error ? error.message : "Unknown error",
         success: false,
       }),
       {
         status: 500,
         headers: { "Content-Type": "application/json", ...corsHeaders },
       }
     );
   }
 };
 
 serve(handler);