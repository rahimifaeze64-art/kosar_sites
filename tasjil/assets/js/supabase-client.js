// ============================================================
// Supabase Client Configuration
// ============================================================
// مقادیر زیر رو از Supabase Dashboard پر کن:
//   Settings → API → Project URL   →  SUPABASE_URL
//   Settings → API → anon public   →  SUPABASE_ANON_KEY
// ============================================================

const SUPABASE_URL      = 'https://xqcsmtqcaqucszapimmr.supabase.co';   // ← اینجا جایگذاری کن
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxY3NtdHFjYXF1Y3N6YXBpbW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2OTcyNzgsImV4cCI6MjA5OTI3MzI3OH0.YOfigH9Bjk8WtXSmscvA3Z7z3y0zm5W2SUJtmEt_XUk';                  // ← اینجا جایگذاری کن

// Initialize Supabase client (از CDN لود می‌شه)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY };
