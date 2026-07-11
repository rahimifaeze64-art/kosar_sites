// ============================================================
// Supabase Client Configuration
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL      = 'https://xqcsmtqcaqucszapimmr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxY3NtdHFjYXF1Y3N6YXBpbW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2OTcyNzgsImV4cCI6MjA5OTI3MzI3OH0.YOfigH9Bjk8WtXSmscvA3Z7z3y0zm5W2SUJtmEt_XUk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY };
