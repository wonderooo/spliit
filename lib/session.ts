import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

/** Returns the current session (or null). Memoized per request. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Returns the current user or redirects to the landing page. */
export async function requireUser() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/");
  }
  return session.user;
}
