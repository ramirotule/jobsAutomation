-- Update View for available vacancies: Exclude Brazil/Brasil as requested
CREATE OR REPLACE VIEW v_available_vacancies AS
SELECT jp.*
FROM job_posts jp
WHERE NOT EXISTS (
  SELECT 1 FROM applications a WHERE a.job_id = jp.id
)
AND (jp.location IS NULL OR (
    LOWER(jp.location) NOT LIKE '%brazil%' AND 
    LOWER(jp.location) NOT LIKE '%brasil%'
));
