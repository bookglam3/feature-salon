import { supabase } from './supabase';

export async function getCurrentUserProfile() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      *,
      salons (
        id,
        name,
        slug,
        plan
      )
    `)
    .eq('id', user.id)
    .single();

  return profile;
}

export async function requireAuth() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    throw new Error('Authentication required');
  }

  return profile;
}

export async function requireOwner() {
  const profile = await requireAuth();

  if (profile.role !== 'owner') {
    throw new Error('Owner access required');
  }

  return profile;
}