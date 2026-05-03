import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getCurrentUserProfile() {
  const { data: { user } } = await supabaseAdmin.auth.getUser();
  if (!user) return null;

  const { data: salon, error } = await supabaseAdmin
    .from("salons")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (error || !salon) return null;

  return {
    user,
    salon,
    salon_id: salon.id,
  };
}