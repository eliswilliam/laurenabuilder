/**
 * src/lib/auth-mock.ts
 *
 * Wrapper autour de getServerSession (NextAuth) pour les Server Actions.
 * Le nom "mock" est un vestige historique — en production cette fonction
 * retourne la vraie session NextAuth.
 *
 * SECURITY: Ne jamais retourner de session fictive en production.
 * Toute session null/undefined doit être traitée comme "non authentifié".
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import type { Session } from "next-auth";

/**
 * Récupère la session authentifiée depuis NextAuth.
 * Retourne null si l'utilisateur n'est pas connecté.
 */
export async function getMockSession(): Promise<Session | null> {
  return getServerSession(authOptions);
}
