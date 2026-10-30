// ============================================================
// Supabase Client Configuration
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// URL و KEY باید از همان پروژه Supabase باشند
// self-hosted: https://supa.alkawthar.info (HTTPS → Realtime خودکار WSS)
const SUPABASE_URL      = (window.SB_ENV && window.SB_ENV.url) || 'https://supa.alkawthar.info';
const SUPABASE_ANON_KEY = (window.SB_ENV && window.SB_ENV.publishableKey) || 'sb_publishable_tnnaReMVB5S47UOmxy3_Cp_AuJ9aanV';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY };
