/** The npub's avatar, following the picker (same-tab event) and the npub. */

import { useEffect, useState } from "react";
import { AVATAR_EVENT, avatarFor } from "../avatar.ts";

export function useAvatar(npub: string): string {
  const [avatar, setAvatar] = useState(() => avatarFor(npub));
  useEffect(() => {
    setAvatar(avatarFor(npub));
    const changed = () => setAvatar(avatarFor(npub));
    window.addEventListener(AVATAR_EVENT, changed);
    return () => window.removeEventListener(AVATAR_EVENT, changed);
  }, [npub]);
  return avatar;
}
