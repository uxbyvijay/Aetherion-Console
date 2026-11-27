// Price maths shared by the pricing page and the register form.
import { useSyncExternalStore } from "react";
import { ANNUAL_SAVING, type Period, type Plan } from "./content";

export const round2 = (n: number) => Math.round(n * 100) / 100;

// Prices are set in US dollars and shown in dollars by default. Visitors can pick another currency from the
// dropdown on the pricing page; that choice is remembered in their browser. ?cur=EUR in the URL picks one too.
// Rates below are fallbacks; live rates replace them once fetched.
const RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, INR: 84, AUD: 1.52, CAD: 1.37, JPY: 150, SGD: 1.34, AED: 3.67,
  CHF: 0.88, SEK: 10.5, NOK: 10.7, DKK: 6.9, NZD: 1.65, ZAR: 18.2, BRL: 5.5, MXN: 18.5, PLN: 4,
  SAR: 3.75, MYR: 4.4, PHP: 57, IDR: 16000, THB: 35, KRW: 1350, TRY: 34,
};

const PICK_KEY = "morph-currency";
const CACHE_KEY = "morph-rates-v2";

/** Codes the browser can format and name (Intl), so the dropdown never offers one it can't show. */
const known = (() => {
  try {
    return new Set((Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("currency"));
  } catch {
    return null;
  }
})();
/** Not money people pay in: IMF drawing rights and other accounting units. */
const SKIP = new Set(["XDR", "XAG", "XAU", "XPD", "XPT", "XSU", "XUA", "XTS", "XXX"]);
const isKnown = (code: string) => /^[A-Z]{3}$/.test(code) && !SKIP.has(code) && (!known || known.has(code));

/** Adds every usable rate from a rates table (USD base) to RATES. */
function mergeRates(rates: unknown) {
  if (!rates || typeof rates !== "object") return false;
  for (const [code, r] of Object.entries(rates as Record<string, unknown>)) {
    if (isKnown(code) && typeof r === "number" && isFinite(r) && r > 0) RATES[code] = r;
  }
  return true;
}

// Seed from the last fetched table (even if old), so a remembered pick like KES still resolves on load.
try {
  mergeRates(JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null")?.rates);
} catch {
  /* no cache */
}

/** Every currency offered in the dropdown (all the live feed covers, ~160, once loaded). */
export let CURRENCIES = Object.keys(RATES);

function initialCurrency(): string {
  try {
    const forced = new URLSearchParams(window.location.search).get("cur")?.toUpperCase();
    if (forced && RATES[forced]) return forced;
    const picked = localStorage.getItem(PICK_KEY);
    if (picked && RATES[picked]) return picked;
  } catch {
    /* storage blocked */
  }
  return "USD";
}

let currency = initialCurrency();
export const getCurrency = () => currency;

// Live rates (open.er-api.com, no key, refreshed daily upstream), cached in the browser for 6 hours.
const RATES_URL = "https://open.er-api.com/v6/latest/USD";
const CACHE_MS = 6 * 60 * 60 * 1000;
const listeners = new Set<() => void>();
let version = 0;
let live = false;
const notify = () => {
  version++;
  listeners.forEach((l) => l());
};

function applyRates(rates: unknown) {
  if (!mergeRates(rates)) return;
  CURRENCIES = Object.keys(RATES);
  live = true;
  notify();
}

/** Fetches live rates (and with them the full currency list). Called when the dropdown opens or a currency is picked. */
export async function loadLiveRates() {
  if (live) return;
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
    if (cached && Date.now() - cached.at < CACHE_MS) return applyRates(cached.rates);
  } catch {
    /* no cache */
  }
  try {
    const res = await fetch(RATES_URL);
    const rates = (await res.json())?.rates;
    applyRates(rates);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ rates, at: Date.now() }));
    } catch {
      /* storage blocked */
    }
  } catch {
    /* offline or blocked: keep the fallback rates */
  }
}
if (currency !== "USD") void loadLiveRates();

/** Switch the currency prices are shown in, and remember the visitor's choice. */
export function setCurrency(code: string) {
  if (!RATES[code] || code === currency) return;
  currency = code;
  try {
    if (code === "USD") localStorage.removeItem(PICK_KEY);
    else localStorage.setItem(PICK_KEY, code);
  } catch {
    /* storage blocked */
  }
  notify();
  if (code !== "USD") void loadLiveRates();
}

/** Call in any component that shows prices; returns the current currency and re-renders when it or a rate changes. */
export const useRates = () => {
  useSyncExternalStore(
    (cb) => (listeners.add(cb), () => void listeners.delete(cb)),
    () => version,
  );
  return currency;
};

/** Large-unit currencies shown without decimals (INR by choice; the rest have no minor unit in practice). */
const WHOLE = new Set(["JPY", "KRW", "IDR", "INR", "VND", "CLP", "ISK", "HUF", "COP", "PYG", "UGX", "IRR", "LAK", "KHR", "MMK", "UZS", "TZS", "NGN", "PKR", "LKR"]);

/** Formats a USD amount in the chosen currency: "$27", "£21.60", "₹10,286" */
export const usd = (n: number) => {
  const v = n * RATES[currency];
  const whole = WHOLE.has(currency) || RATES[currency] >= 50 || Number.isInteger(round2(v));
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    currencyDisplay: currency === "USD" ? "symbol" : "narrowSymbol",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(v);
};

/** "US dollar", "Indian rupee"… for the dropdown. */
export const currencyName = (code: string) => {
  try {
    const n = new Intl.DisplayNames(["en"], { type: "currency" }).of(code);
    return n ? n.charAt(0).toUpperCase() + n.slice(1) : code;
  } catch {
    return code;
  }
};

export type Quote = {
  /** null = priced on request, 0 = free */
  perMonth: number | null;
  /** amount charged each billing cycle (one month, or one year up front) */
  charge: number | null;
  /** what a year costs on this billing period */
  perYear: number | null;
  /** how much a year of annual billing saves compared with paying monthly */
  yearlySaving: number;
  cycle: "month" | "year";
};

export function quote(plan: Plan, period: Period): Quote {
  const cycle = period === "yearly" ? "year" : "month";
  const m = plan.monthly;
  if (m === null) return { perMonth: null, charge: null, perYear: null, yearlySaving: 0, cycle };
  if (m === 0) return { perMonth: 0, charge: 0, perYear: 0, yearlySaving: 0, cycle };

  const annualPerMonth = round2((m * (100 - ANNUAL_SAVING)) / 100);
  const annualTotal = round2(annualPerMonth * 12);
  const yearlySaving = round2(m * 12 - annualTotal);

  return period === "yearly"
    ? { perMonth: annualPerMonth, charge: annualTotal, perYear: annualTotal, yearlySaving, cycle }
    : { perMonth: m, charge: m, perYear: round2(m * 12), yearlySaving, cycle };
}
