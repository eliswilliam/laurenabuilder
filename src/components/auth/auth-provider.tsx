"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Wraps the app with NextAuth's SessionProvider.
 * Session is populated after the OAuth2 callback from Laurena Studio.
 * Uses JWT strategy — no database round-trip on every render.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      {children}
    </SessionProvider>
  );
}