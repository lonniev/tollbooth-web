/**
 * A Nostr direct message from the signed-in npub, sent from the browser.
 *
 * NIP-17: the message is a kind-14 rumor, sealed (kind 13) by the sender and
 * gift-wrapped (kind 1059) under a throwaway key, once to the recipient and
 * once to the sender, so the sender's own client shows what was sent. The
 * sender signs with the session key, or with a NIP-07 extension that can
 * encrypt NIP-44. No key leaves the page; relays see only ciphertext.
 *
 * Relays: the recipient's kind-10050 inbox relays, where it lists any, and
 * the shared `DM_RELAYS`.
 */

import { getEventHash, getPublicKey, nip19, type Event as NostrEvent } from "nostr-tools";
import { createRumor, createSeal, createWrap } from "nostr-tools/nip59";
import { SimplePool } from "nostr-tools/pool";
import { translate } from "./i18n/index.ts";
import { getSessionNsecBytes, hasSessionNsec } from "./sessionNsec.ts";

/** Public write relays every DM goes to. */
export const DM_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://offchain.pub",
] as const;

/** How long to wait for a recipient's inbox relay list. */
const INBOX_WAIT_MS = 3000;
/** NIP-59: a seal's time is blurred up to two days back. */
const TWO_DAYS_S = 2 * 24 * 60 * 60;

interface Nip07 {
  getPublicKey(): Promise<string>;
  signEvent(event: { kind: number; created_at: number; tags: string[][]; content: string; pubkey?: string }): Promise<NostrEvent>;
  nip44?: { encrypt(pubkey: string, plaintext: string): Promise<string> };
}

function nip07(): Nip07 | undefined {
  return (globalThis as { nostr?: Nip07 }).nostr;
}

/** The signed-in npub can sign a DM here: a session key, or a NIP-07 signer that encrypts NIP-44. */
export function canSendDm(): boolean {
  return hasSessionNsec() || typeof nip07()?.nip44?.encrypt === "function";
}

export function recipientPubkeyHex(npubBech32: string): string {
  const trimmed = npubBech32.trim();
  if (!trimmed.startsWith("npub1")) throw new Error(translate("dm.recipientMustBeNpub"));
  let decoded: ReturnType<typeof nip19.decode>;
  try {
    decoded = nip19.decode(trimmed);
  } catch {
    throw new Error(translate("dm.npubUnreadable"));
  }
  if (decoded.type === "npub" && typeof decoded.data === "string" && /^[0-9a-f]{64}$/i.test(decoded.data)) {
    return decoded.data;
  }
  throw new Error(translate("dm.npubUnreadable"));
}

export interface DmResult {
  ok: number;
  total: number;
  /** Relays that took the recipient's wrap. */
  accepted: string[];
  /** Short per-relay failure notes; never the message. */
  errors: string[];
}

export type Publish = (wrap: NostrEvent, relays: readonly string[]) => Promise<DmResult>;
export type InboxLookup = (pubkeyHex: string) => Promise<string[]>;

/** The recipient's message, and the sender's copy, both wrapped. */
async function wraps(body: string, to: string): Promise<{ toThem: NostrEvent; toMe: NostrEvent }> {
  const template = { kind: 14, content: body, tags: [["p", to]] };
  if (hasSessionNsec()) {
    const sk = getSessionNsecBytes();
    const rumor = createRumor(template, sk);
    return {
      toThem: createWrap(createSeal(rumor, sk, to), to),
      toMe: createWrap(createSeal(rumor, sk, getPublicKey(sk)), getPublicKey(sk)),
    };
  }
  const signer = nip07();
  if (!signer?.nip44) throw new Error(translate("dm.noSigner"));
  const me = await signer.getPublicKey();
  const rumor = { ...template, created_at: Math.floor(Date.now() / 1000), pubkey: me, id: "" };
  rumor.id = getEventHash(rumor);
  const seal = async (who: string) => signer.signEvent({
    kind: 13, tags: [], pubkey: me,
    created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * TWO_DAYS_S),
    content: await signer.nip44!.encrypt(who, JSON.stringify(rumor)),
  });
  return { toThem: createWrap(await seal(to), to), toMe: createWrap(await seal(me), me) };
}

async function inboxRelays(pubkeyHex: string): Promise<string[]> {
  const pool = new SimplePool();
  try {
    const found = await pool.querySync([...DM_RELAYS], { kinds: [10050], authors: [pubkeyHex], limit: 1 }, { maxWait: INBOX_WAIT_MS });
    const newest = found.sort((a, b) => b.created_at - a.created_at)[0];
    return (newest?.tags ?? []).filter((t) => t[0] === "relay" && /^wss:\/\//.test(t[1] ?? "")).map((t) => t[1]).slice(0, 5);
  } catch {
    return [];
  } finally {
    try { pool.close([...DM_RELAYS]); } catch { /* already quiet */ }
  }
}

async function poolPublish(wrap: NostrEvent, relays: readonly string[]): Promise<DmResult> {
  const pool = new SimplePool();
  const accepted: string[] = [];
  const errors: string[] = [];
  try {
    const settled = await Promise.allSettled(pool.publish([...relays], wrap));
    settled.forEach((r, i) => {
      const url = relays[i] ?? `relay-${i}`;
      if (r.status === "fulfilled") accepted.push(url);
      else errors.push(`${url}: refused`);
    });
  } finally {
    try { pool.close([...relays]); } catch { /* already quiet */ }
  }
  return { ok: accepted.length, total: relays.length, accepted, errors };
}

/**
 * Send `body` to `to` (an npub) as the signed-in npub. Throws on a bad npub or
 * no signer; a relay that refuses is reported in the result. The sender's copy
 * is best effort and never changes the result.
 */
export async function sendDm(opts: {
  to: string;
  body: string;
  /** Injected for tests; the real path fans out with a SimplePool. */
  publish?: Publish;
  lookup?: InboxLookup;
}): Promise<DmResult> {
  const to = recipientPubkeyHex(opts.to);
  const { toThem, toMe } = await wraps(opts.body, to);
  const publish = opts.publish ?? poolPublish;
  const lookup = opts.lookup ?? inboxRelays;
  const [theirs, mine] = await Promise.all([lookup(to), lookup(toMe.tags.find((t) => t[0] === "p")?.[1] ?? "")]);
  const relays = (extra: string[]) => [...new Set([...extra, ...DM_RELAYS])];
  const result = await publish(toThem, relays(theirs));
  await publish(toMe, relays(mine)).catch(() => undefined);
  return result;
}
