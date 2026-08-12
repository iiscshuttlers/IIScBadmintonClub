SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM
    pg_constraint c
JOIN
    pg_class t ON c.conrelid = t.oid
JOIN
    pg_namespace n ON t.relnamespace = n.oid
WHERE
    t.relname = 'players' AND n.nspname = 'public';
