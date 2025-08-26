-- Add column for last rent increase date to mietvertrag table
ALTER TABLE public.mietvertrag 
ADD COLUMN letzte_mieterhoehung_am date;