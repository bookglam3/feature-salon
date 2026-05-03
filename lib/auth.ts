import { supabase } from "./supabase";

export async function getCurrentUserProfile() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const user = session.user;

    const { data: salon, error } = await supabase
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
  } catch {
    return null;
  }
}