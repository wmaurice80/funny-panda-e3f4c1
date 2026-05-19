-- CalSnap — Fix permissions (GRANT manquants)
-- Coller dans SQL Editor → Run

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles   TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meals      TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weights    TO anon, authenticated;
