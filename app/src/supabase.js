import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// import.meta.env is replaced at Vite build time; fall back to inlined values
// for static-file deployments (GitHub Pages). Anon key is a publishable client key.
const url = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL)
  || 'https://ueupqkxdqjusfxtjaflq.supabase.co';
const key = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY)
  || 'sb_publishable_yQZKuKK95O-2iGzNnfrQqg_cUlv2DZV';

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});
