import { env } from "@anchor/env/server";
import { createClient, type User } from "@supabase/supabase-js";

export type AuthSession = {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
};

function mapUser(user: User): AuthSession["user"] {
  const metadata = user.user_metadata as
    | {
        name?: string;
        avatar_url?: string;
        picture?: string;
      }
    | undefined;

  return {
    id: user.id,
    name: metadata?.name ?? user.email?.split("@")[0] ?? "Anonymous",
    email: user.email ?? "",
    image: metadata?.avatar_url ?? metadata?.picture ?? null,
  };
}

function getSupabaseConfig() {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_ANON_KEY in apps/server/.env. Supabase auth cannot be initialized.",
    );
  }

  return {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
  };
}

export function createServerAuthClient() {
  const { url, anonKey } = getSupabaseConfig();

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function getSessionFromAccessToken(accessToken: string): Promise<AuthSession | null> {
  const authClient = createServerAuthClient();
  const { data, error } = await authClient.auth.getUser(accessToken);

  if (error || !data.user) {
    return null;
  }

  return {
    accessToken,
    user: mapUser(data.user),
  };
}
