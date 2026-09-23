/**
 * Who is signed in, in one place, so every screen re-renders when it changes.
 *
 * Two ways to be signed in, and they are not the same: a session nsec that
 * signs a fresh proof per call and never lapses while the tab lives, or a
 * cached DM proof that expires. `canSign` tells them apart for the pages that
 * need to.
 */

import { useCallback, useEffect, useState } from "react";
import { onProofExpired } from "../client.ts";
import { currentClaim, logOut } from "../identity.ts";
import { canSignFor, isProven } from "../signedIn.ts";

export interface Session {
  npub: string;
  signedIn: boolean;
  canSign: boolean;
  /** Set when a cached proof lapses: a calm prompt to sign in again. */
  notice: string;
  /** Call after a successful sign-in so the whole app notices. */
  refresh: () => void;
  signOut: () => void;
}

function read() {
  if (typeof globalThis.localStorage === "undefined") return { npub: "", signedIn: false, canSign: false };
  const claim = currentClaim();
  return { npub: claim.npub, signedIn: isProven(claim), canSign: canSignFor(claim) };
}

export function useSession(): Session {
  const [state, setState] = useState(read);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(() => {
    setState(read());
    setNotice("");
  }, []);

  const signOut = useCallback(() => {
    logOut();
    setState(read());
    setNotice("");
  }, []);

  useEffect(
    () =>
      onProofExpired(() => {
        // A tab that can sign for THIS npub lost nothing.
        if (canSignFor(currentClaim())) return;
        setNotice("Your session lapsed while you were away. Sign in again to carry on.");
        setState(read());
      }),
    [],
  );

  return { ...state, notice, refresh, signOut };
}
