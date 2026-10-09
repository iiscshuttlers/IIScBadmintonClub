CREATE OR REPLACE FUNCTION is_tournament_manager(t_id uuid) RETURNS boolean 
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM tournaments t
        WHERE t.id = t_id 
        AND (
            t.created_by = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM players p WHERE p.id = auth.uid() AND p.role IN ('admin', 'master_admin')
            )
        )
    );
$$;
