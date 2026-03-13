// DEV-ONLY: helper script to get a Supabase access token for curl testing.

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";



const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

async function main() {
  const { data, error } = await supabase.auth.signInWithPassword({
  
    email: "test@guslift.edu",
    password: "test",
  });

  if (error) {
    console.error("Login error:", error);
  } else {
    console.log("ACCESS TOKEN:", data.session?.access_token);
  }
}

main();