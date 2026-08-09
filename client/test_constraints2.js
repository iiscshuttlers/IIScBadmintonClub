import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envStr = fs.readFileSync(path.resolve('../.env.local'), 'utf-8');
const envVars = {};
envStr.split('\n').forEach(line => {
  if (line.includes('=')) {
    const [key, ...rest] = line.split('=');
    envVars[key.trim()] = rest.join('=').trim().replace(/^['"](.*)['"]$/, '$1');
  }
});

const supabase = createClient(
  envVars['VITE_SUPABASE_URL'],
  envVars['VITE_SUPABASE_ANON_KEY'] // intentionally use anon key
);

async function run() {
  // Sign up user 1
  const email1 = `test1_${Date.now()}@example.com`;
  const { data: auth1, error: err1 } = await supabase.auth.signUp({
    email: email1,
    password: 'password123'
  });
  console.log("Signup 1:", err1 || "Success");

  const { data: insert1, error: insErr1 } = await supabase.from('players').insert({
    id: auth1.user.id,
    full_name: 'DuplicateNameTest',
    email: email1
  });
  console.log("Insert 1 (DuplicateNameTest):", insErr1?.message || "Success");

  // Sign out
  await supabase.auth.signOut();

  // Sign up user 2
  const email2 = `test2_${Date.now()}@example.com`;
  const { data: auth2, error: err2 } = await supabase.auth.signUp({
    email: email2,
    password: 'password123'
  });
  console.log("Signup 2:", err2 || "Success");

  // Try to insert same name
  const { data: insert2, error: insErr2 } = await supabase.from('players').insert({
    id: auth2.user.id,
    full_name: 'DuplicateNameTest',
    email: email2
  });
  console.log("Insert 2 (DuplicateNameTest, diff email):", insErr2?.message || insErr2?.code || "Success");
  
  if (insErr2?.code === '23505') {
    console.log("YES! full_name is UNIQUE!");
  } else if (!insErr2) {
    console.log("NO! full_name is NOT UNIQUE!");
  }
}

run();
