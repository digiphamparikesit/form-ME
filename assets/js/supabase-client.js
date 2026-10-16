// ============================================================
// SUPABASE CLIENT - RSUD AM PARIKESIT
// ============================================================

const SUPABASE_URL = 'https://jjtlyzqttoiwtmhyzyxb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqdGx5enF0dG9pd3RtaHl6eXhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMDg5MjYsImV4cCI6MjEwNzY4NDkyNn0.tG3P7bEyhYjmJDSyQmMJHZoNwfwQ_HOFh35Wx0H1HI4';

// Inisialisasi client global
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

// Expose ke global
window.db = supabaseClient;
