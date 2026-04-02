import { env } from "@anchor/env/web";
import { createClient, type Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

type BrowserAuthSession = {
  accessToken: string;
  user: AuthUser;
  raw: Session;
};

let authClient: ReturnType<typeof createClient> | null = null;

function getSupabaseConfig() {
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in apps/web/.env. Supabase auth cannot be initialized.",
    );
  }

  return {
    url: env.VITE_SUPABASE_URL,
    anonKey: env.VITE_SUPABASE_ANON_KEY,
  };
}

export function getAuthClient() {
  if (!authClient) {
    const { url, anonKey } = getSupabaseConfig();

    authClient = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    });
  }

  return authClient;
}

function mapSession(session: Session | null): BrowserAuthSession | null {
  if (!session?.user) {
    return null;
  }

  const metadata = session.user.user_metadata as
    | {
        name?: string;
        avatar_url?: string;
        picture?: string;
      }
    | undefined;

  return {
    accessToken: session.access_token,
    raw: session,
    user: {
      id: session.user.id,
      name: metadata?.name ?? session.user.email?.split("@")[0] ?? "Anonymous",
      email: session.user.email ?? "",
      image: metadata?.avatar_url ?? metadata?.picture ?? null,
    },
  };
}

export async function getAuthSession() {
  const client = getAuthClient();
  const { data, error } = await client.auth.getSession();

  if (error) {
    throw error;
  }

  return {
    data: mapSession(data.session),
  };
}

export async function getAccessToken() {
  const session = await getAuthSession();
  return session.data?.accessToken ?? null;
}

export function useAuthSession() {
  const [data, setData] = useState<BrowserAuthSession | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const client = getAuthClient();

    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) {
          return;
        }

        if (error) {
          setData(null);
          setIsPending(false);
          return;
        }

        setData(mapSession(data.session));
        setIsPending(false);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setIsPending(false);
        }
      });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        setData(mapSession(session));
        setIsPending(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { data, isPending };
}
