import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

export function createServerClient(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Extract the authorization token from the request header
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // If we have a token, set it as the session
  if (token) {
    supabase.auth.setSession({
      access_token: token,
      refresh_token: '', // We don't need refresh token for this use case
    });
  }

  return supabase;
}
