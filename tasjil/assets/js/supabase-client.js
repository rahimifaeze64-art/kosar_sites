// ============================================================
// Supabase Client Configuration
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// URL و KEY باید از همان پروژه Supabase باشند
// self-hosted: http://62.60.194.98:8000 — از publishable key استفاده می‌شود
const SUPABASE_URL      = 'http://62.60.194.98:8000';
const SUPABASE_ANON_KEY = 'sb_publishable_tnnaReMVB5S47UOmxy3_Cp_AuJ9aanV';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY };
