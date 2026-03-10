import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  'https://immobilien-blick-dashboard.lovable.app',
  'https://id-preview--8e9e2f9b-7950-413f-adfd-90b0d2663ae1.lovable.app',
  'https://dashboard.niimmo.de',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  };
}

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
  pdfPath?: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { error: authError } = await authClient.auth.getUser();
  if (authError) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const { recipients, subject, body, pdfPath }: EmailRequest = await req.json();

    if (!recipients || recipients.length === 0) {
      throw new Error("Keine Empfänger angegeben");
    }
    if (!subject || !body) {
      throw new Error("Betreff und Nachricht sind erforderlich");
    }

    // SMTP config — dedicated Übergabe secrets with fallback
    const smtpHost = Deno.env.get("UEBERGABE_SMTP_HOST") || Deno.env.get("MAHNUNG_SMTP_HOST") || Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("UEBERGABE_SMTP_PORT") || Deno.env.get("MAHNUNG_SMTP_PORT") || Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("UEBERGABE_SMTP_USER") || Deno.env.get("MAHNUNG_SMTP_USER") || Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("UEBERGABE_SMTP_PASS") || Deno.env.get("MAHNUNG_SMTP_PASS") || Deno.env.get("SMTP_PASS");
    const smtpFromEmail = Deno.env.get("UEBERGABE_SMTP_FROM_EMAIL") || Deno.env.get("MAHNUNG_SMTP_FROM_EMAIL") || Deno.env.get("SMTP_FROM_EMAIL");
    const smtpFromName = Deno.env.get("UEBERGABE_SMTP_FROM_NAME") || Deno.env.get("MAHNUNG_SMTP_FROM_NAME") || Deno.env.get("SMTP_FROM_NAME") || "NilImmo Hausverwaltung";

    if (!smtpHost || !smtpUser || !smtpPass || !smtpFromEmail) {
      console.error("SMTP configuration missing for Übergabe");
      throw new Error("SMTP-Konfiguration unvollständig. Bitte UEBERGABE_SMTP_* oder MAHNUNG_SMTP_* Secrets konfigurieren.");
    }

    // Load PDF attachment if path provided
    let pdfAttachment: { content: Uint8Array; filename: string } | null = null;
    if (pdfPath) {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      console.log('Loading PDF from storage:', pdfPath);
      const { data: fileData, error: fileError } = await supabase.storage
        .from('dokumente')
        .download(pdfPath);

      if (fileError) {
        console.error('PDF download error:', fileError);
      } else if (fileData) {
        const arrayBuffer = await fileData.arrayBuffer();
        pdfAttachment = {
          content: new Uint8Array(arrayBuffer),
          filename: `Uebergabeprotokoll_${new Date().toISOString().split('T')[0]}.pdf`,
        };
        console.log('PDF loaded successfully, size:', pdfAttachment.content.length);
      }
    }

    // Create SMTP client
    const client = new SmtpClient();

    const connectConfig: any = {
      hostname: smtpHost,
      port: smtpPort,
      username: smtpUser,
      password: smtpPass,
    };

    if (smtpPort === 465) {
      await client.connectTLS(connectConfig);
    } else {
      await client.connect(connectConfig);
    }

    const sentEmails: string[] = [];
    const failedEmails: { email: string; error: string }[] = [];
    const htmlBody = body.replace(/\n/g, "<br>");

    for (const recipient of recipients) {
      try {
        const boundary = "----=_Part_" + Date.now().toString(36) + Math.random().toString(36);

        if (pdfAttachment) {
          // Multipart message with PDF attachment
          const base64Content = btoa(String.fromCharCode(...pdfAttachment.content));
          const contentBody = [
            `--${boundary}`,
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: 7bit',
            '',
            htmlBody,
            '',
            `--${boundary}`,
            `Content-Type: application/pdf; name="${pdfAttachment.filename}"`,
            'Content-Transfer-Encoding: base64',
            `Content-Disposition: attachment; filename="${pdfAttachment.filename}"`,
            '',
            base64Content,
            '',
            `--${boundary}--`,
          ].join('\r\n');

          await client.send({
            from: `${smtpFromName} <${smtpFromEmail}>`,
            to: recipient.email,
            subject: subject,
            headers: {
              'MIME-Version': '1.0',
              'Content-Type': `multipart/mixed; boundary="${boundary}"`,
            },
            content: contentBody,
          });
        } else {
          await client.send({
            from: `${smtpFromName} <${smtpFromEmail}>`,
            to: recipient.email,
            subject: subject,
            content: body,
            html: htmlBody,
          });
        }

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
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("Error in send-uebergabe-email function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
