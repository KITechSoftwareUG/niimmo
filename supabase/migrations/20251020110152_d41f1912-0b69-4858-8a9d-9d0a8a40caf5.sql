-- Create table for WhatsApp messages
CREATE TABLE public.whatsapp_nachrichten (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telefonnummer TEXT NOT NULL,
  nachricht TEXT NOT NULL,
  zeitstempel TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  richtung TEXT NOT NULL CHECK (richtung IN ('eingehend', 'ausgehend')),
  mieter_id UUID REFERENCES public.mieter(id),
  mietvertrag_id UUID REFERENCES public.mietvertrag(id),
  gelesen BOOLEAN NOT NULL DEFAULT false,
  absender_name TEXT,
  empfaenger_name TEXT,
  media_url TEXT,
  erstellt_am TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.whatsapp_nachrichten ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Authenticated users can view WhatsApp messages"
ON public.whatsapp_nachrichten
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert WhatsApp messages"
ON public.whatsapp_nachrichten
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update WhatsApp messages"
ON public.whatsapp_nachrichten
FOR UPDATE
USING (auth.role() = 'authenticated');

-- Create index for better performance
CREATE INDEX idx_whatsapp_nachrichten_zeitstempel ON public.whatsapp_nachrichten(zeitstempel DESC);
CREATE INDEX idx_whatsapp_nachrichten_telefonnummer ON public.whatsapp_nachrichten(telefonnummer);
CREATE INDEX idx_whatsapp_nachrichten_mieter ON public.whatsapp_nachrichten(mieter_id);