import type { SupabaseClient, User } from '@supabase/supabase-js';

function slugifyUsername(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

function getPreferredUsername(user: User) {
  const raw =
    typeof user.user_metadata?.username === 'string'
      ? user.user_metadata.username
      : typeof user.email === 'string'
        ? user.email.split('@')[0]
        : 'midas-dj';

  return slugifyUsername(raw) || `midas-${user.id.slice(0, 6)}`;
}

export async function ensureProfile(supabase: SupabaseClient, user: User) {
  const baseUsername = getPreferredUsername(user);
  const candidates = [baseUsername, `${baseUsername}-${user.id.slice(0, 6)}`];

  for (const candidate of candidates) {
    const { error } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        username: candidate,
      },
      {
        onConflict: 'id',
      },
    );

    if (!error) {
      return;
    }

    if (!error.message.toLowerCase().includes('duplicate')) {
      throw error;
    }
  }
}
