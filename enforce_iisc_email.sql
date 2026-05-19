-- The ultimate security lockdown:
-- This completely prevents ANYONE from creating a profile if their email doesn't end in @iisc.ac.in
-- Even if they bypass the website and try to hack the database directly, this will block them!

ALTER TABLE players 
ADD CONSTRAINT enforce_iisc_domain 
CHECK (email LIKE '%@iisc.ac.in');
