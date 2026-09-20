// ============================================================
// Supabase Client Configuration
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// URL و KEY باید از همان پروژه Supabase باشند
// ref در KEY: tyzrexkneoexmcegaxlc → URL باید همین باشد
const SUPABASE_URL      = 'https://tyzrexkneoexmcegaxlc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5enJleGtuZW9leG1jZWdheGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MTcwMjMsImV4cCI6MjEwNTM5MzAyM30.xw_dY8jT13Kt0G1JCg3HaiL5l_0fgVE-9POkxn8jLOU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY };
