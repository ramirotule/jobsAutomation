import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function test() {
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    console.log("No auth session in test script, cannot test RLS properly. But let's check anon insert.")
  }
  
  const { data, error } = await supabase.from("search_profiles").select("*").limit(1)
  console.log("Search profiles fetch error:", error?.message || "Success")
}
test()
