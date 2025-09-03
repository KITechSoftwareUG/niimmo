-- Force August demands to be marked as overdue for testing
UPDATE mietforderungen 
SET 
    ist_faellig = true,
    faellig_seit = CURRENT_TIMESTAMP
WHERE 
    sollmonat = '2025-08' 
    AND ist_faellig = false;