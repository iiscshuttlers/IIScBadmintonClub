import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://htejmhsqqlfedlajqqyv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZWptaHNxcWxmZWRsYWpxcXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTc1NjAsImV4cCI6MjA5ODkzMzU2MH0.2HhspVm0_ncPvEsv7-qET_6SYtjTP1s6nUbwuy30FRk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from("elo_calculation_logs")
    .select(`*, player:players!player_id(id, full_name)`)
    .limit(1);
    
  console.log("With !player_id:", error ? error.message : "Success");

  const { data: d2, error: e2 } = await supabase
    .from("elo_calculation_logs")
    .select(`*, player:players(id, full_name)`)
    .limit(1);

  console.log("Without !player_id:", e2 ? e2.message : "Success");
}
main();
