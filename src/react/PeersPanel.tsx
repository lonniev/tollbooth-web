/**
 * Peers: who may see and fund this account here, and whose accounts this npub
 * may see and fund. A peer (a parent, a supervisor) never spends the balance;
 * it reads it and pays for it. Each grant is the patron's own approval of a
 * Nostr DM, so asking only sends that DM — the patron decides in their app.
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
import { afterApproval, afterAsk, grantEndsText, peerTarget, type AskPhase } from "../peers.ts";
import { formatSats } from "../wallet.ts";
import TopUp from "./TopUp.tsx";

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
  const [peers, setPeers] = useState<PeerGrant[]>([]);
  const [patrons, setPatrons] = useState<PatronGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listPeerGrants({ bestEffort: true });
      if (r.success === false) setProblem(r.error ?? "Peers could not be read.");
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
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, npub]);

  async function end(peer: string, patron?: string) {
    try {
      const r = await revokePeerGrant(peer, patron, { bestEffort: true });
      if (r.success === false) setProblem(r.error ?? "That grant could not be ended.");
      else void refresh();
    } catch (e) {
      setProblem((e as Error).message);
    }
  }

  return (
    <div className="tb-wallet tb-peers" data-tour="tb.account.peers">
      <section className="tb-wallet-section">
        <h2 className="tb-wallet-title">Who may see and fund you</h2>
        <p className="tb-wallet-note">They can read your balance and pay for you here. They cannot spend it.</p>
        {loading ? (
          <p className="tb-wallet-note">Loading…</p>
        ) : peers.length === 0 ? (
          <p className="tb-wallet-note">Nobody yet. A peer asks from their own account, and you approve the DM.</p>
        ) : (
          <ul className="tb-wallet-list">
            {peers.map((p) => (
              <li key={p.peer_npub} className="tb-wallet-coupon">
                <div>
                  <Who npub={p.peer_npub} />
                  <div className="tb-wallet-note">{grantEndsText(p.expires_at)}</div>
                </div>
                <button type="button" onClick={() => void end(p.peer_npub)} className="tb-wallet-action">
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="tb-wallet-section">
        <h2 className="tb-wallet-title">Accounts you fund</h2>
        {!loading && patrons.length === 0 && <p className="tb-wallet-note">None yet.</p>}
        {patrons.length > 0 && (
          <ul className="tb-wallet-list">
            {patrons.map((p) => (
              <FundedAccount key={p.patron_npub} grant={p} onStop={() => void end(npub, p.patron_npub)} />
            ))}
          </ul>
        )}
        <AskToFund npub={npub} onGranted={() => void refresh()} />
      </section>

      {problem && <p className="tb-wallet-error">{problem}</p>}
    </div>
  );
}

function FundedAccount({ grant, onStop }: { grant: PatronGrant; onStop: () => void }) {
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
            {formatSats(balance)} sats · {grantEndsText(grant.expires_at)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setToppingUp((v) => !v)}
          aria-expanded={toppingUp}
          className="tb-wallet-action tb-wallet-primary"
        >
          Top up
        </button>
        <button type="button" onClick={onStop} title="Stop seeing and funding this account" className="tb-wallet-action">
          Stop
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

function AskToFund({ npub, onGranted }: { npub: string; onGranted: () => void }) {
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

  const ask = () =>
    "npub" in target &&
    attempt(async () => {
      const next = afterAsk(target.npub, await requestPeerGrant(target.npub, npub));
      setPhase(next.phase);
      setProblem(next.problem);
    });

  const collect = () =>
    phase.kind === "sent" &&
    attempt(async () => {
      const next = afterApproval(phase, await receivePeerGrant(phase.patron, npub, phase.nonce));
      setPhase(next.phase);
      setProblem(next.problem);
      if (next.granted) {
        setTyped("");
        onGranted();
      }
    });

  return (
    <div className="tb-peers-ask">
      <h3 className="tb-wallet-subtitle">Fund another account</h3>
      {phase.kind === "idle" ? (
        <>
          <div className="tb-wallet-row">
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void ask();
              }}
              placeholder="Their npub1…"
              aria-label="The npub of the account to fund"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={busy}
              className="tb-wallet-input tb-peers-grow"
            />
            <button
              type="button"
              onClick={() => void ask()}
              disabled={busy || !("npub" in target)}
              className="tb-wallet-action tb-wallet-primary"
            >
              {busy ? "Asking…" : "Ask"}
            </button>
          </div>
          {"problem" in target && target.problem && <p className="tb-wallet-error">{target.problem}</p>}
        </>
      ) : (
        <>
          <p className="tb-wallet-note">
            <Who npub={phase.patron} /> gets a DM marked <span className="tb-peers-phrase">{phase.nonce}</span>.
            Once they approve it, collect the grant.
          </p>
          <div className="tb-wallet-row">
            <button type="button" onClick={() => void collect()} disabled={busy} className="tb-wallet-action tb-wallet-primary">
              {busy ? "Looking…" : "They approved"}
            </button>
            <button type="button" onClick={() => setPhase({ kind: "idle" })} disabled={busy} className="tb-wallet-action">
              Cancel
            </button>
          </div>
        </>
      )}
      {problem && <p className="tb-wallet-error">{problem}</p>}
    </div>
  );
}
