/**
 * Sponsors: who may see and fund this account here, and whose accounts this
 * npub sponsors. A sponsor (a parent, a supervisor, an employer) never spends
 * the balance; it reads it and pays for it. Either side asks, and the other
 * approves a Nostr DM in their own app.
 *
 * Laid out by `wallet.css`, like the wallet: it is the brand.
 */

import { useCallback, useEffect, useState } from "react";
import {
  checkBalance,
  getNostrProfile,
  listPeerGrants,
  receivePeerGrant,
  requestPeerGrant,
  revokePeerGrant,
  type PatronGrant,
  type PeerGrant,
} from "../standardTools.ts";
import { shortNpub } from "../avatar.ts";
import { afterApproval, afterAsk, askSides, grantEndsText, peerTarget, type AskPhase } from "../peers.ts";
import { formatSats } from "../wallet.ts";
import TopUp from "./TopUp.tsx";
import Tx from "./Tx.tsx";
import { useT } from "./useT.ts";

/** A Nostr name for an npub when it has one, else the short npub. */
function useName(npub: string): string {
  const [name, setName] = useState("");
  useEffect(() => {
    let live = true;
    getNostrProfile(npub, { bestEffort: true }).then(
      (r) => live && setName(r.profile?.display_name || r.profile?.name || ""),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [npub]);
  return name || shortNpub(npub);
}

function Who({ npub }: { npub: string }) {
  const name = useName(npub);
  return (
    <span title={npub}>
      <b>{name}</b>
      {name !== shortNpub(npub) && <span className="tb-wallet-note"> {shortNpub(npub)}</span>}
    </span>
  );
}

export interface PeersPanelProps {
  /** The signed-in npub. */
  npub: string;
}

export default function PeersPanel({ npub }: PeersPanelProps) {
  const t = useT();
  const [peers, setPeers] = useState<PeerGrant[]>([]);
  const [patrons, setPatrons] = useState<PatronGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listPeerGrants({ bestEffort: true });
      if (r.success === false) setProblem(r.error ?? t("peers.unreadable"));
      else {
        setPeers(r.peers ?? []);
        setPatrons(r.patrons ?? []);
        setProblem("");
      }
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh, npub]);

  async function end(peer: string, patron?: string) {
    try {
      const r = await revokePeerGrant(peer, patron, { bestEffort: true });
      if (r.success === false) setProblem(r.error ?? t("peers.notEnded"));
      else void refresh();
    } catch (e) {
      setProblem((e as Error).message);
    }
  }

  return (
    <div className="tb-wallet tb-peers" data-tour="tb.account.peers">
      <section className="tb-wallet-section">
        <h2 className="tb-wallet-title">{t("peers.title")}</h2>
        <p className="tb-wallet-note">{t("peers.canRead")}</p>
        <p className="tb-wallet-note">{t("peers.cannotSpend")}</p>

        <div className="tb-peers-part">
          <h3 className="tb-wallet-subtitle">
            {loading ? t("peers.yourSponsors") : t("peers.yourSponsorsCounted", { n: peers.length })}
          </h3>
          {loading ? (
            <p className="tb-wallet-note">{t("peers.loading")}</p>
          ) : peers.length === 0 ? (
            <p className="tb-wallet-note">{t("peers.noSponsors")}</p>
          ) : (
            <ul className="tb-wallet-list">
              {peers.map((p) => (
                <li key={p.peer_npub} className="tb-wallet-coupon">
                  <div>
                    <Who npub={p.peer_npub} />
                    <div className="tb-wallet-note">{grantEndsText(p.expires_at)}</div>
                  </div>
                  <button type="button" onClick={() => void end(p.peer_npub)} className="tb-wallet-action">
                    {t("peers.revoke")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="tb-peers-part">
          <h3 className="tb-wallet-subtitle">
            {loading ? t("peers.sponsored") : t("peers.sponsoredCounted", { n: patrons.length })}
          </h3>
          {!loading && patrons.length === 0 && <p className="tb-wallet-note">{t("peers.noneYet")}</p>}
          {patrons.length > 0 && (
            <ul className="tb-wallet-list">
              {patrons.map((p) => (
                <FundedAccount key={p.patron_npub} grant={p} onStop={() => void end(npub, p.patron_npub)} />
              ))}
            </ul>
          )}
        </div>

        <div className="tb-peers-part">
          <AskByNpub npub={npub} onGranted={() => void refresh()} />
        </div>

        {problem && <p className="tb-wallet-error">{problem}</p>}
      </section>
    </div>
  );
}

function FundedAccount({ grant, onStop }: { grant: PatronGrant; onStop: () => void }) {
  const t = useT();
  const [balance, setBalance] = useState<number | null>(null);
  const [toppingUp, setToppingUp] = useState(false);

  const read = useCallback(async () => {
    try {
      const r = await checkBalance({ forNpub: grant.patron_npub });
      setBalance(typeof r.balance_api_sats === "number" ? r.balance_api_sats : null);
    } catch {
      setBalance(null);
    }
  }, [grant.patron_npub]);

  useEffect(() => {
    void read();
  }, [read]);

  return (
    <li className="tb-wallet-line">
      <div className="tb-wallet-row">
        <div className="tb-peers-grow">
          <Who npub={grant.patron_npub} />
          <div className="tb-wallet-note">
            {t("peers.fundedNote", { sats: formatSats(balance), ends: grantEndsText(grant.expires_at) })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setToppingUp((v) => !v)}
          aria-expanded={toppingUp}
          className="tb-wallet-action tb-wallet-primary"
        >
          {t("peers.topUp")}
        </button>
        <button type="button" onClick={onStop} title={t("peers.stopTitle")} className="tb-wallet-action">
          {t("peers.stop")}
        </button>
      </div>
      {toppingUp && (
        <TopUp
          forNpub={grant.patron_npub}
          onSettled={() => {
            void read();
          }}
        />
      )}
    </li>
  );
}

function AskByNpub({ npub, onGranted }: { npub: string; onGranted: () => void }) {
  const t = useT();
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<AskPhase>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const target = peerTarget(typed, npub);

  async function attempt(step: () => Promise<void>) {
    setBusy(true);
    setProblem("");
    try {
      await step();
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Offer to sponsor them, or ask them to sponsor me. */
  const ask = (offer: boolean) =>
    "npub" in target &&
    attempt(async () => {
      const sides = askSides(npub, target.npub, offer);
      const next = afterAsk(sides, target.npub, await requestPeerGrant(sides.patron, sides.peer));
      setPhase(next.phase);
      setProblem(next.problem);
    });

  const collect = () =>
    phase.kind === "sent" &&
    attempt(async () => {
      const next = afterApproval(phase, await receivePeerGrant(phase.patron, phase.peer, phase.nonce));
      setPhase(next.phase);
      setProblem(next.problem);
      if (next.granted) {
        setTyped("");
        onGranted();
      }
    });

  const ready = !busy && "npub" in target;
  return (
    <div className="tb-peers-ask">
      <h3 className="tb-wallet-subtitle">{t("peers.askByNpub")}</h3>
      {phase.kind === "idle" ? (
        <>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t("peers.theirNpubPlaceholder")}
            aria-label={t("peers.theirNpub")}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
            className="tb-wallet-input tb-wallet-custom"
          />
          <div className="tb-wallet-row">
            <button type="button" onClick={() => void ask(false)} disabled={!ready} className="tb-wallet-action tb-wallet-primary">
              {t("peers.askThem")}
            </button>
            <button type="button" onClick={() => void ask(true)} disabled={!ready} className="tb-wallet-action">
              {t("peers.offerThem")}
            </button>
          </div>
          {"problem" in target && target.problem && <p className="tb-wallet-error">{target.problem}</p>}
        </>
      ) : (
        <>
          <p className="tb-wallet-note">
            <Tx
              k="peers.dmSent"
              vars={{ nonce: phase.nonce }}
              components={{ who: <Who npub={phase.other} />, phrase: <span className="tb-peers-phrase" /> }}
            />
          </p>
          <div className="tb-wallet-row">
            <button type="button" onClick={() => void collect()} disabled={busy} className="tb-wallet-action tb-wallet-primary">
              {busy ? t("peers.looking") : t("peers.theyApproved")}
            </button>
            <button type="button" onClick={() => setPhase({ kind: "idle" })} disabled={busy} className="tb-wallet-action">
              {t("peers.cancel")}
            </button>
          </div>
        </>
      )}
      {problem && <p className="tb-wallet-error">{problem}</p>}
    </div>
  );
}
