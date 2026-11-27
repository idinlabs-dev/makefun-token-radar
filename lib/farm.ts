// lib/farm.ts — compositional farm-plan engine (SPEC §5).
// Chain fee/latency lookup + 10 category playbooks + conditional modifiers.
// Per-step economics: direct fee + 4.5% T-bill opportunity cost + active
// minutes + EV vs the modelled pool. Bankroll default $2,500 in board.json;
// the dashboard recomputes the same steps live for $500 / $10,000.
// Language rule: never promise an airdrop; a protocol "records no token".
import type { Proto, Scored } from "./model.ts";

export type ChainInfo = { fee: number; confirmMin: number; bridgeMin: number };

const NAMED_CHAINS: Record<string, ChainInfo> = {
  Ethereum: { fee: 2.5, confirmMin: 3, bridgeMin: 20 },
  Solana: { fee: 0.02, confirmMin: 1, bridgeMin: 5 },
  Base: { fee: 0.05, confirmMin: 1, bridgeMin: 10 },
  Arbitrum: { fee: 0.08, confirmMin: 1, bridgeMin: 12 },
  Optimism: { fee: 0.1, confirmMin: 1, bridgeMin: 12 },
  Polygon: { fee: 0.05, confirmMin: 1, bridgeMin: 10 },
  Binance: { fee: 0.15, confirmMin: 1, bridgeMin: 10 },
  "BNB Chain": { fee: 0.15, confirmMin: 1, bridgeMin: 10 },
  Avalanche: { fee: 0.2, confirmMin: 1, bridgeMin: 10 },
  Hyperliquid: { fee: 0.05, confirmMin: 1, bridgeMin: 8 },
  "Hyperliquid L1": { fee: 0.05, confirmMin: 1, bridgeMin: 8 },
  Monad: { fee: 0.03, confirmMin: 1, bridgeMin: 8 },
  Unichain: { fee: 0.04, confirmMin: 1, bridgeMin: 10 },
  Sui: { fee: 0.03, confirmMin: 1, bridgeMin: 8 },
  Aptos: { fee: 0.03, confirmMin: 1, bridgeMin: 8 },
  Sei: { fee: 0.03, confirmMin: 1, bridgeMin: 8 },
  Berachain: { fee: 0.1, confirmMin: 1, bridgeMin: 10 },
  Plasma: { fee: 0.08, confirmMin: 1, bridgeMin: 10 },
  Linea: { fee: 0.06, confirmMin: 1, bridgeMin: 10 },
  Scroll: { fee: 0.08, confirmMin: 1, bridgeMin: 10 },
  zkSync: { fee: 0.08, confirmMin: 1, bridgeMin: 12 },
  Starknet: { fee: 0.1, confirmMin: 1, bridgeMin: 12 },
  Mantle: { fee: 0.06, confirmMin: 1, bridgeMin: 10 },
  Blast: { fee: 0.06, confirmMin: 1, bridgeMin: 10 },
  Mode: { fee: 0.05, confirmMin: 1, bridgeMin: 10 },
  Fantom: { fee: 0.1, confirmMin: 1, bridgeMin: 10 },
  Cronos: { fee: 0.1, confirmMin: 1, bridgeMin: 10 },
  Gnosis: { fee: 0.08, confirmMin: 1, bridgeMin: 10 },
  Celo: { fee: 0.05, confirmMin: 1, bridgeMin: 10 },
  Near: { fee: 0.03, confirmMin: 1, bridgeMin: 8 },
  Cosmos: { fee: 0.05, confirmMin: 1, bridgeMin: 10 },
  Bitcoin: { fee: 1.2, confirmMin: 10, bridgeMin: 30 },
  Tron: { fee: 0.1, confirmMin: 1, bridgeMin: 10 },
  Ton: { fee: 0.05, confirmMin: 1, bridgeMin: 8 },
  Flare: { fee: 0.05, confirmMin: 1, bridgeMin: 10 },
  Movement: { fee: 0.04, confirmMin: 1, bridgeMin: 10 },
  MegaETH: { fee: 0.02, confirmMin: 1, bridgeMin: 8 },
  Abstract: { fee: 0.04, confirmMin: 1, bridgeMin: 10 },
  Katana: { fee: 0.05, confirmMin: 1, bridgeMin: 10 },
  Ink: { fee: 0.05, confirmMin: 1, bridgeMin: 10 },
  Sonic: { fee: 0.05, confirmMin: 1, bridgeMin: 10 },
  Worldchain: { fee: 0.05, confirmMin: 1, bridgeMin: 10 },
  Kava: { fee: 0.08, confirmMin: 1, bridgeMin: 10 },
  SeiChain: { fee: 0.03, confirmMin: 1, bridgeMin: 8 },
};

// Long-tail chains (303 in the snapshot) fall back to this median bucket.
export const DEFAULT_CHAIN: ChainInfo = { fee: 0.3, confirmMin: 2, bridgeMin: 15 };

export function chainInfo(chain: string): ChainInfo {
  return NAMED_CHAINS[chain] ?? DEFAULT_CHAIN;
}

export const TBILL_RATE = 0.045; // 4.5% annual, stated assumption.
export const DEFAULT_BANKROLL = 2500;

export function money(n: number): string {
  if (n >= 1000) return "$" + Math.round(n).toLocaleString("en-US");
  if (n >= 1) return "$" + n.toFixed(2).replace(/\.00$/, "");
  return "$" + n.toFixed(2);
}

export type StepDef = {
  text: (p: Proto, chain: string, amt: number, fee: number, mins: number) => string;
  tx: number;
  manualMin: number;
  deployFrac: number;
  holdDays: number;
  share: number;
};

function step(
  text: (p: Proto, chain: string, amt: number, fee: number, mins: number) => string,
  tx: number, manualMin: number, deployFrac: number, holdDays: number, share: number,
): StepDef {
  return { text, tx, manualMin, deployFrac, holdDays, share };
}

// 10 playbooks: 7 core steps each. {amt} is the step's deployed dollars at
// the $2,500 bankroll; {fee}/{mins} are computed per step at build time.
const PLAYBOOKS: Record<string, StepDef[]> = {
  Dexs: [
    step((p, c, a, f, m) => `Swap ${money(a)} of USDC for the pool's base asset on ${p.name} (${c}) in two trades so slippage stays low (about ${money(f)} in fees, about ${m} min active).`, 2, 6, 0.2, 30, 0.18),
    step((p, c, a, f, m) => `Add ${money(a)} as liquidity to ${p.name}'s deepest ${c} pool and keep the LP receipt in the same wallet (about ${money(f)} in fees, about ${m} min active).`, 2, 8, 0.3, 60, 0.22),
    step((p, c, a, f, m) => `Route one real swap a week through ${p.name} on ${c} instead of your usual DEX, about ${money(a / 5)} each, so the wallet shows repeat usage (about ${money(f)} in fees, about ${m} min active).`, 1, 4, 0.04, 30, 0.12),
    step((p, c, a, f, m) => `Stake or lock the LP position on ${p.name} for at least 30 days if the app offers a lock, and screenshot the lock receipt (about ${money(f)} in fees, about ${m} min active).`, 1, 5, 0.2, 30, 0.16),
    step((p, c, a, f, m) => `Provide ${money(a)} of liquidity to a second, smaller ${c} pool on ${p.name} to widen your footprint beyond the top pair (about ${money(f)} in fees, about ${m} min active).`, 2, 8, 0.12, 45, 0.1),
    step((p, c, a, f, m) => `Claim any trading-fee accrual on ${p.name} weekly and re-add it to the pool instead of withdrawing it (about ${money(f)} in fees, about ${m} min active).`, 1, 5, 0.02, 30, 0.08),
    step((p, c, a, f, m) => `Leave the ${p.name} position open for 60 days, then withdraw half and keep half running so the wallet history shows a long-lived position (about ${money(f)} in fees, about ${m} min active).`, 2, 6, 0.1, 60, 0.14),
  ],
  Lending: [
    step((p, c, a, f, m) => `Supply ${money(a)} of USDC to ${p.name} on ${c} as collateral and confirm the deposit receipt in the app (about ${money(f)} in fees, about ${m} min active).`, 1, 5, 0.3, 60, 0.2),
    step((p, c, a, f, m) => `Borrow ${money(a * 0.4)} against that collateral on ${p.name}, keeping health factor above 2 so no liquidation risk appears (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.3, 30, 0.16),
    step((p, c, a, f, m) => `Swap the borrowed funds into a stable asset and re-supply ${money(a * 0.3)} to ${p.name} on ${c} for a second loop (about ${money(f)} in fees, about ${m} min active).`, 2, 8, 0.12, 45, 0.16),
    step((p, c, a, f, m) => `Repay ${money(a * 0.2)} of the ${p.name} loan after two weeks to show a full borrow-and-repay cycle (about ${money(f)} in fees, about ${m} min active).`, 1, 5, 0.08, 14, 0.12),
    step((p, c, a, f, m) => `Top up the ${p.name} collateral by ${money(a * 0.2)} when the market dips, keeping the health factor above 2 on ${c} (about ${money(f)} in fees, about ${m} min active).`, 1, 5, 0.06, 30, 0.1),
    step((p, c, a, f, m) => `Hold the remaining ${p.name} supply position untouched for 60 days so the wallet shows a long-lived lender, not a one-day farmer (about ${money(f)} in fees, about ${m} min active).`, 0, 3, 0.1, 60, 0.12),
    step((p, c, a, f, m) => `Repay the rest of the ${p.name} loan in full and withdraw half the collateral, leaving half supplied (about ${money(f)} in fees, about ${m} min active).`, 2, 6, 0.08, 60, 0.14),
  ],
  RWA: [
    step((p, c, a, f, m) => `Complete the eligibility and KYC check on ${p.name} first, before sending any funds, and save the approval screen (about ${money(f)} in fees, about ${m} min active).`, 0, 15, 0, 0, 0.08),
    step((p, c, a, f, m) => `Buy ${money(a)} of the tokenised asset on ${p.name} (${c}) in one order and confirm the on-chain receipt (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.3, 90, 0.22),
    step((p, c, a, f, m) => `Hold the ${p.name} position for at least 90 days to match the asset's own term, and record each yield payout (about ${money(f)} in fees, about ${m} min active).`, 0, 3, 0.3, 90, 0.18),
    step((p, c, a, f, m) => `Reinvest the first yield payout, about ${money(a * 0.05)}, back into the same ${p.name} asset on ${c} (about ${money(f)} in fees, about ${m} min active).`, 1, 5, 0.015, 30, 0.12),
    step((p, c, a, f, m) => `Add a second ${money(a * 0.5)} purchase on ${p.name} after 30 days if the first position is paying as stated (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.15, 60, 0.14),
    step((p, c, a, f, m) => `Check the underlying asset documents on ${p.name} each month and note the maturity date in your own records (about ${money(f)} in fees, about ${m} min active).`, 0, 10, 0, 30, 0.08),
    step((p, c, a, f, m) => `Exit half the ${p.name} position at maturity and keep half running, so the wallet shows a completed full-term cycle (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.15, 90, 0.18),
  ],
  "Risk Curators": [
    step((p, c, a, f, m) => `Deposit ${money(a)} into a ${p.name} curated vault on ${c} and confirm the vault share receipt (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.3, 60, 0.2),
    step((p, c, a, f, m) => `Read the vault's risk parameters on ${p.name} (caps, curator fee, rebalancing rules) and note them before adding more (about ${money(f)} in fees, about ${m} min active).`, 0, 12, 0, 0, 0.08),
    step((p, c, a, f, m) => `Add ${money(a * 0.5)} to a second ${p.name} vault with a different curator on ${c} to spread curator risk (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.15, 45, 0.16),
    step((p, c, a, f, m) => `Leave the ${p.name} vault deposits untouched for 60 days so the wallet shows a long-lived allocation, not a flash deposit (about ${money(f)} in fees, about ${m} min active).`, 0, 3, 0.3, 60, 0.16),
    step((p, c, a, f, m) => `Claim and re-deposit the vault yield on ${p.name} monthly, about ${money(a * 0.03)} each time, instead of withdrawing it (about ${money(f)} in fees, about ${m} min active).`, 1, 5, 0.01, 30, 0.12),
    step((p, c, a, f, m) => `Test a small ${money(a * 0.2)} withdrawal from ${p.name} after 30 days to confirm the exit path works on ${c} (about ${money(f)} in fees, about ${m} min active).`, 1, 5, 0.06, 30, 0.12),
    step((p, c, a, f, m) => `Rebalance between the two ${p.name} vaults after 60 days, moving ${money(a * 0.2)} toward the better-performing curator (about ${money(f)} in fees, about ${m} min active).`, 2, 8, 0.06, 60, 0.16),
  ],
  Yield: [
    step((p, c, a, f, m) => `Deposit ${money(a)} into the highest-yield ${p.name} strategy on ${c} and confirm the position receipt (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.3, 60, 0.2),
    step((p, c, a, f, m) => `Harvest the first yield on ${p.name} after two weeks and compound it back into the same strategy (about ${money(f)} in fees, about ${m} min active).`, 1, 5, 0.02, 14, 0.14),
    step((p, c, a, f, m) => `Split ${money(a * 0.5)} into a second ${p.name} strategy on ${c} so the wallet shows two live strategies (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.15, 45, 0.16),
    step((p, c, a, f, m) => `Auto-compound weekly on ${p.name} for 60 days, spending about ${m} min a week on claims and re-deposits (about ${money(f)} in fees per claim, about ${m} min active).`, 1, 5, 0.02, 60, 0.14),
    step((p, c, a, f, m) => `Move ${money(a * 0.3)} between ${p.name} strategies once when yields shift, and note why you moved it (about ${money(f)} in fees, about ${m} min active).`, 2, 8, 0.09, 30, 0.12),
    step((p, c, a, f, m) => `Keep a ${money(a * 0.2)} reserve in the ${p.name} strategy untouched for the full 60 days as the long-lived anchor position (about ${money(f)} in fees, about ${m} min active).`, 0, 3, 0.06, 60, 0.1),
    step((p, c, a, f, m) => `Withdraw half the ${p.name} yield position after 60 days and leave half compounding, showing a completed cycle (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.15, 60, 0.14),
  ],
  "Basis Trading": [
    step((p, c, a, f, m) => `Open a ${money(a)} delta-neutral basis position on ${p.name} (${c}) and confirm both legs filled (about ${money(f)} in fees, about ${m} min active).`, 2, 10, 0.3, 30, 0.2),
    step((p, c, a, f, m) => `Check the funding rate on ${p.name} daily for the first week and log it, so you can prove the basis was actually captured (about ${money(f)} in fees, about ${m} min active).`, 0, 5, 0, 7, 0.1),
    step((p, c, a, f, m) => `Roll the ${p.name} basis position after 30 days into the next funding window instead of closing it outright (about ${money(f)} in fees, about ${m} min active).`, 2, 8, 0.3, 30, 0.18),
    step((p, c, a, f, m) => `Add ${money(a * 0.5)} to the ${p.name} position when the funding rate turns in your favour on ${c} (about ${money(f)} in fees, about ${m} min active).`, 2, 8, 0.15, 30, 0.14),
    step((p, c, a, f, m) => `Hedge the spot leg of the ${p.name} trade once a week and keep the hedge ratio near 1:1 (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.05, 30, 0.12),
    step((p, c, a, f, m) => `Close one third of the ${p.name} basis position after 45 days and bank the captured funding (about ${money(f)} in fees, about ${m} min active).`, 2, 8, 0.1, 45, 0.12),
    step((p, c, a, f, m) => `Close the remaining ${p.name} position after 60 days and record the net funding earned versus fees paid (about ${money(f)} in fees, about ${m} min active).`, 2, 8, 0.2, 60, 0.14),
  ],
  "Onchain Capital Allocator": [
    step((p, c, a, f, m) => `Allocate ${money(a)} through ${p.name} on ${c} to its flagship allocation and confirm the receipt (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.3, 60, 0.2),
    step((p, c, a, f, m) => `Read the allocation mandate on ${p.name} (what it may and may not buy) before committing a second tranche (about ${money(f)} in fees, about ${m} min active).`, 0, 12, 0, 0, 0.08),
    step((p, c, a, f, m) => `Send a second ${money(a * 0.5)} allocation via ${p.name} after 30 days, to a different strategy in the same allocator (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.15, 30, 0.16),
    step((p, c, a, f, m) => `Track the ${p.name} allocation's monthly report and compare its stated return with the on-chain balance (about ${money(f)} in fees, about ${m} min active).`, 0, 10, 0, 30, 0.1),
    step((p, c, a, f, m) => `Reallocate ${money(a * 0.3)} inside ${p.name} after 60 days toward the strategy that actually delivered (about ${money(f)} in fees, about ${m} min active).`, 2, 8, 0.09, 60, 0.16),
    step((p, c, a, f, m) => `Test a ${money(a * 0.2)} redemption from ${p.name} after 30 days to confirm the exit path and its delay on ${c} (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.06, 30, 0.12),
    step((p, c, a, f, m) => `Leave the remaining ${p.name} allocation running for 90 days, then redeem half and keep half allocated (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.15, 90, 0.18),
  ],
  Chain: [
    step((p, c, a, f, m) => `Bridge ${money(a)} to ${p.name} (${c}) with the protocol's own bridge and confirm arrival before doing anything else (about ${money(f)} in fees, about ${m} min active).`, 1, 8, 0.3, 30, 0.18),
    step((p, c, a, f, m) => `Make three small everyday transactions on ${p.name} — a swap, a transfer and a contract call — across three different days (about ${money(f)} in fees, about ${m} min active).`, 3, 9, 0.06, 14, 0.16),
    step((p, c, a, f, m) => `Stake or delegate ${money(a * 0.6)} on ${p.name} for at least 30 days and keep the delegation receipt (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.18, 30, 0.18),
    step((p, c, a, f, m) => `Use one native ${p.name} app each week for four weeks, about ${money(a * 0.1)} per app, so activity spans the chain's ecosystem (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.04, 28, 0.14),
    step((p, c, a, f, m) => `Provide ${money(a * 0.4)} of liquidity on ${p.name}'s main DEX on ${c} and hold the LP for 60 days (about ${money(f)} in fees, about ${m} min active).`, 2, 8, 0.12, 60, 0.14),
    step((p, c, a, f, m) => `Vote in one on-chain governance proposal on ${p.name} if a vote opens, and keep the vote receipt (about ${money(f)} in fees, about ${m} min active).`, 1, 5, 0, 7, 0.08),
    step((p, c, a, f, m) => `Unstake half the ${p.name} position after 60 days and bridge half back, leaving the rest active on the chain (about ${money(f)} in fees, about ${m} min active).`, 2, 8, 0.09, 60, 0.12),
  ],
  CeDeFi: [
    step((p, c, a, f, m) => `Create and verify your ${p.name} account, including any identity check, before depositing anything (about ${money(f)} in fees, about ${m} min active).`, 0, 15, 0, 0, 0.08),
    step((p, c, a, f, m) => `Deposit ${money(a)} into ${p.name} on ${c} and confirm the balance shows in the app and on-chain (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.3, 60, 0.2),
    step((p, c, a, f, m) => `Earn yield on the ${p.name} deposit for 30 days and record each payout in your own notes (about ${money(f)} in fees, about ${m} min active).`, 0, 4, 0.3, 30, 0.14),
    step((p, c, a, f, m) => `Move ${money(a * 0.5)} of the ${p.name} balance into a second product on the same platform to show breadth (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.15, 30, 0.16),
    step((p, c, a, f, m) => `Test a ${money(a * 0.2)} withdrawal from ${p.name} after two weeks to confirm the withdrawal delay and fee on ${c} (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.06, 14, 0.12),
    step((p, c, a, f, m) => `Re-deposit the withdrawn ${money(a * 0.2)} into ${p.name} after the test so the net position stays invested (about ${money(f)} in fees, about ${m} min active).`, 1, 5, 0.06, 30, 0.1),
    step((p, c, a, f, m) => `Withdraw half the ${p.name} balance after 60 days and leave half earning, closing the first full cycle (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.15, 60, 0.2),
  ],
  Generic: [
    step((p, c, a, f, m) => `Connect your wallet to ${p.name} on ${c} and complete any profile or verification step before depositing (about ${money(f)} in fees, about ${m} min active).`, 0, 10, 0, 0, 0.08),
    step((p, c, a, f, m) => `Deposit ${money(a)} into the main ${p.name} product on ${c} and confirm the on-chain receipt (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.3, 60, 0.22),
    step((p, c, a, f, m) => `Use the ${p.name} product once a week for four weeks, about ${money(a * 0.1)} per use, so the wallet shows repeat usage (about ${money(f)} in fees, about ${m} min active).`, 1, 5, 0.04, 28, 0.16),
    step((p, c, a, f, m) => `Add a second ${money(a * 0.5)} position in a different ${p.name} feature on ${c} after 30 days (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.15, 30, 0.14),
    step((p, c, a, f, m) => `Claim any rewards or yield on ${p.name} after two weeks and re-deposit them instead of withdrawing (about ${money(f)} in fees, about ${m} min active).`, 1, 5, 0.02, 14, 0.12),
    step((p, c, a, f, m) => `Hold the main ${p.name} position untouched for 60 days so the wallet shows a long-lived position, not a one-day farm (about ${money(f)} in fees, about ${m} min active).`, 0, 3, 0.3, 60, 0.12),
    step((p, c, a, f, m) => `Withdraw half the ${p.name} position after 60 days and leave half running, completing the first full cycle (about ${money(f)} in fees, about ${m} min active).`, 1, 6, 0.15, 60, 0.16),
  ],
};

export function playbookFor(category: string | null): StepDef[] {
  if (category && PLAYBOOKS[category]) return PLAYBOOKS[category];
  return PLAYBOOKS.Generic;
}

export type FarmStep = { text: string; feeUsd: number; oppUsd: number; minutes: number; evUsd: number };
export type FarmPlan = { steps: FarmStep[]; totalFeeUsd: number; totalOppUsd: number; totalMinutes: number; totalEvUsd: number };

export function buildFarmPlan(p: Proto, scored: Scored, bankroll = DEFAULT_BANKROLL, asOf = "2026-11-14"): FarmPlan {
  const chain = p.chains[0] ?? "Ethereum";
  const info = chainInfo(chain);
  const core = playbookFor(p.category);
  const ageKnown = p.listed_at !== null;
  const ageDays = ageKnown
    ? Math.max(0, Math.floor((Date.parse(asOf + "T00:00:00Z") - Date.parse(p.listed_at + "T00:00:00Z")) / 86400000))
    : 9999;
  const defs: StepDef[] = [...core];
  // Conditional modifiers (each adds one step; total stays <= 12).
  if (p.chains.length > 1) {
    const second = p.chains[1];
    const info2 = chainInfo(second);
    void info2;
    defs.push(step((pp, _c, a, f, m) => `Bridge ${money(a)} of your ${pp.name} position to ${second} and use the protocol there once, so activity spans two of its chains (about ${money(f)} in fees, about ${m} min active).`, 2, 10, 0.1, 30, 0.05));
  }
  // The dashboard only sees change_7d rounded to tenths (data.js packs
  // Math.round(change*10)); a -0.04% move packs as 0.0, so the modifier
  // must decide on the same rounded value or board and dashboard disagree.
  const chgR = p.change_7d == null ? 0 : Math.round(p.change_7d * 10) / 10;
  if (chgR < 0) {
    defs.push(step((pp, _c, a, f, m) => `${pp.name}'s TVL fell ${chgR.toFixed(1)}% in 7 days, so farm with half size — ${money(a * 0.5)} instead of ${money(a)} — and watch the exit before adding more (about ${money(f)} in fees, about ${m} min active).`, 0, 8, 0, 14, 0.04));
  }
  if (ageDays < 180) {
    defs.push(step((pp, _c, a, f, m) => `${pp.name} has only run about ${ageDays} days, so expect UI churn and contract upgrades; re-check the app each week before transacting (about ${money(f)} in fees, about ${m} min active).`, 0, 6, 0, 7, 0.03));
  }
  if ((p.category ?? "") === "RWA") {
    defs.push(step((pp, _c, a, f, m) => `Re-check ${pp.name}'s eligibility rules before each new deposit, since RWA access depends on your jurisdiction and can change (about ${money(f)} in fees, about ${m} min active).`, 0, 8, 0, 7, 0.03));
  }
  // Closing steps: review + disclaimer. Added last, dropped first if over 12.
  const closing: StepDef[] = [
    step((pp, c, a, f, m) => `Review the ${pp.name} position weekly on ${c}: check TVL, fees paid so far and whether the position is still worth ${money(a)} tied up (about ${money(f)} in fees, about ${m} min active).`, 0, 5, 0, 60, 0.02),
    step((pp, _c, a, f, m) => `Remember ${pp.name} records no token, so nothing here is guaranteed: only farm with ${money(a)} you can afford to leave locked, and never borrow to farm it (about ${money(f)} in fees, about ${m} min active).`, 0, 3, 0, 0, 0.01),
  ];
  let all = [...defs, ...closing];
  if (all.length > 12) all = all.slice(0, 12);
  // Normalise shares to sum to 1 across the final step list.
  const shareSum = all.reduce((s, d) => s + d.share, 0) || 1;
  // Small-IV warning: if modelled pool share at the $500 bankroll is eaten by
  // fees, say so in the last step instead of hiding it.
  const steps: FarmStep[] = [];
  let totalFee = 0, totalOpp = 0, totalMin = 0, totalEv = 0;
  for (const d of all) {
    const fee = Math.round(d.tx * info.fee * 100) / 100;
    const deployed = bankroll * d.deployFrac;
    const opp = Math.round(deployed * TBILL_RATE * (d.holdDays / 365) * 100) / 100;
    const mins = d.tx * info.confirmMin + d.manualMin;
    const share = d.share / shareSum;
    const ev = Math.round((scored.poolUsd * share - fee - opp) * 100) / 100;
    // Steps that deploy nothing (checks, reviews, disclaimers) still need a
    // sensible dollar figure in their text: use 10% of the bankroll.
    const amt = deployed > 0 ? Math.round(deployed) : Math.round(bankroll * 0.1);
    let text = d.text(p, chain, amt, fee, mins);
    // Keep every step inside the 20–600 char gate, trimming long tails.
    if (text.length > 600) text = text.slice(0, 597) + "...";
    if (text.length < 20) text = text + " Do it once, confirm the receipt, and log the cost.";
    steps.push({ text, feeUsd: fee, oppUsd: opp, minutes: mins, evUsd: ev });
    totalFee += fee; totalOpp += opp; totalMin += mins; totalEv += ev;
  }
  // Fee warning at the small bankroll, appended to the disclaimer step text.
  const feeAt500 = steps.reduce((s, st) => s + st.feeUsd, 0);
  if (scored.poolUsd > 0 && feeAt500 > scored.poolUsd * 0.5 && steps.length > 0) {
    const last = steps[steps.length - 1];
    const note = ` At the $500 bankroll the plan's ${money(feeAt500)} in fees eats most of the modelled ${money(scored.poolUsd)} pool share — use $2,500 or more, or skip this one.`;
    if ((last.text + note).length <= 600) last.text = last.text + note;
  }
  return {
    steps,
    totalFeeUsd: Math.round(totalFee * 100) / 100,
    totalOppUsd: Math.round(totalOpp * 100) / 100,
    totalMinutes: totalMin,
    totalEvUsd: Math.round(totalEv * 100) / 100,
  };
}
