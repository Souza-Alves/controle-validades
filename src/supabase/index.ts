import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// A anon key é pública por natureza (feita para ficar embutida no app cliente).
// Pode ser sobrescrita por variáveis de ambiente EXPO_PUBLIC_* em build.
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://snmbifulthaouoywugrb.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNubWJpZnVsdGhhb3VveXd1Z3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MTE4NTksImV4cCI6MjA5NjE4Nzg1OX0.2IRdjrtx_GKBgEgmOfeGXwgAdBXUJ1bmhIJQj_Fsir0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
