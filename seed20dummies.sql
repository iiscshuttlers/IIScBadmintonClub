DO $$
DECLARE
    dept TEXT[] := ARRAY['Computer Science', 'Physics', 'Chemistry', 'Mathematics', 'Electrical Comm', 'Mechanical', 'Materials Engg', 'Aerospace', 'DesE', 'BioSystems'];
    lvl TEXT[] := ARRAY['Beginner', 'Intermediate', 'Advanced', 'Pro'];
    style TEXT[] := ARRAY['Aggressive', 'Defensive', 'Balanced', 'Tricky'];
    hand TEXT[] := ARRAY['Right-handed', 'Left-handed'];
    shot TEXT[] := ARRAY['Smash', 'Drop', 'Clear', 'Net Shot', 'Drive'];
    fmt TEXT[] := ARRAY['Singles', 'Doubles', 'Mixed Doubles'];
    
    fn_m TEXT[] := ARRAY['Aarav', 'Rohan', 'Vikram', 'Sanjay', 'Rahul', 'Karthik', 'Arjun', 'Aditya', 'Varun', 'Prakash'];
    fn_f TEXT[] := ARRAY['Priya', 'Anjali', 'Sneha', 'Kavya', 'Deepa', 'Divya', 'Neha', 'Meera', 'Swati', 'Pooja'];
    ln TEXT[] := ARRAY['Sharma', 'Patel', 'Reddy', 'Kumar', 'Iyer', 'Nair', 'Singh', 'Gupta', 'Rao', 'Das'];
    
    i INT;
    is_m BOOLEAN;
    r_fn TEXT;
    r_ln TEXT;
    elo INT;
BEGIN
    FOR i IN 1..20 LOOP
        is_m := (i % 2 = 0);
        IF is_m THEN
            r_fn := fn_m[floor(random() * 10 + 1)::int];
        ELSE
            r_fn := fn_f[floor(random() * 10 + 1)::int];
        END IF;
        
        r_ln := ln[floor(random() * 10 + 1)::int];
        elo := floor(random() * 800 + 1000)::int;
        
        INSERT INTO players (
            id,
            full_name,
            nickname,
            email,
            department,
            playing_level,
            playing_style,
            dominant_hand,
            favorite_shot,
            favorite_format,
            current_racket,
            elo_rating,
            singles_elo,
            doubles_elo,
            mixed_elo,
            gender,
            started_playing_year,
            role,
            is_guest,
            is_approved
        ) VALUES (
            gen_random_uuid(),
            r_fn || ' ' || r_ln,
            r_fn,
            lower(r_fn || '.' || r_ln || i::text || '@example.com'),
            dept[floor(random() * 10 + 1)::int],
            lvl[floor(random() * 4 + 1)::int],
            style[floor(random() * 4 + 1)::int],
            hand[floor(random() * 2 + 1)::int],
            shot[floor(random() * 5 + 1)::int],
            fmt[floor(random() * 3 + 1)::int],
            'Yonex Astrox ' || floor(random() * 30 + 70)::text,
            elo,
            elo,
            elo + floor(random() * 100 - 50)::int,
            elo + floor(random() * 100 - 50)::int,
            CASE WHEN is_m THEN 'Male' ELSE 'Female' END,
            floor(random() * 15 + 2010)::int,
            'player',
            true, -- Creating them as guests so they don't need auth.users rows
            true
        );
    END LOOP;
END $$;
