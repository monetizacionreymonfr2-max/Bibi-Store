import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fwuocaigfkdgitivbngh.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_BDWOHEY-6gVHoVqy4lEFsA_v0JnZJCH';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
