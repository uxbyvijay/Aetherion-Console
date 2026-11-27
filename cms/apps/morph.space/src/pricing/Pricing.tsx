import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { ANNUAL_SAVING, periods, plans as defaultPlans, setAnnualSaving, type Period, type Plan } from "../lib/content";
import { CURRENCIES, currencyName, loadLiveRates, quote, setCurrency, usd, useRates } from "../lib/pricing";
import { Check as Tick, ChevronDown, Search } from "lucide-react";
import { asWords, edit, mediaUrl, Sections, slugify, useSections, wordsOf, type Sec } from "../lib/cms";
import Icon from "../components/Icon";
import CtaBand from "../components/CtaBand";
import Faq, { faqNote, Gate, siteFaqDefaults } from "../components/Faq";
import { Scene } from "../components/Scene";
import { RollText } from "../components/Morph";
import { onSpotMove, Reveal, useHashScroll } from "../lib/motion";

const registerHref = (p: Plan, period: Period) => `/contact?plan=${p.id}&billing=${period}#register`;

const Check = (props: Record<string, string>) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

function BillingToggle({ value, onChange, s }: { value: Period; onChange: (p: Period) => void; s?: Sec }) {
  const i = periods.findIndex((p) => p.id === value);
  return (
    <div className="billing" role="radiogroup" aria-label="Billing period" style={{ "--i": i, "--n": periods.length } as CSSProperties}>
      <span className="billing-thumb" aria-hidden />
      {periods.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={value === p.id}
          className={value === p.id ? "on" : ""}
          onClick={() => onChange(p.id)}
          {...(s ? edit(s, p.id === "yearly" ? "annualLabel" : "monthlyLabel") : {})}
        >
          {(p.id === "yearly" ? s?.annualLabel : s?.monthlyLabel) || p.label}
          {p.id === "yearly" && <span className="billing-save">Save {ANNUAL_SAVING}%</span>}
        </button>
      ))}
    </div>
  );
}

/** Which currency prices are shown in. US dollars by default; other currencies are converted at current rates. */
const POPULAR = ["USD", "EUR", "GBP", "INR"];

/** The short sign for a currency, e.g. $, €, ₹ (falls back to the code). */
function symbolOf(code: string) {
  try {
    const part = new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value ?? code;
  } catch {
    return code;
  }
}

/** Shared currencies whose code doesn't start with a country: shown with the flag of their largest user. */
const FLAG_OF: Record<string, string> = {
  XAF: "cm", // Central African CFA franc: Cameroon
  XOF: "ci", // West African CFA franc: Côte d'Ivoire
  XCD: "lc", // East Caribbean dollar: Saint Lucia
  XPF: "pf", // CFP franc: French Polynesia
  ANG: "cw", // Netherlands Antillean guilder: Curaçao
};

/** Flag for a currency: an ISO 4217 code starts with its country code (EUR → eu). Images, since Windows has no flag emoji. */
function Flag({ code }: { code: string }) {
  return (
    <img
      className="currency-flag"
      src={`https://flagcdn.com/${FLAG_OF[code] ?? code.slice(0, 2).toLowerCase()}.svg`}
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
      width={22}
      height={16}
      onError={(e) => e.currentTarget.classList.add("none")}
    />
  );
}

function CurrencyPicker() {
  const current = useRates();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const q = query.trim().toLowerCase();
  const matches = (c: string) => !q || c.toLowerCase().includes(q) || currencyName(c).toLowerCase().includes(q);
  const popular = q ? [] : POPULAR.filter((c) => CURRENCIES.includes(c));
  const rest = CURRENCIES.filter((c) => matches(c) && !popular.includes(c)).sort((a, b) =>
    currencyName(a).localeCompare(currencyName(b)),
  );
  const options = [...popular, ...rest];

  const close = (refocus = true) => {
    setOpen(false);
    setQuery("");
    if (refocus) btn.current?.focus();
  };
  const pick = (c: string) => {
    setCurrency(c);
    close();
  };

  useEffect(() => {
    if (!open) return;
    void loadLiveRates();
    setCursor(Math.max(0, options.indexOf(current)));
    search.current?.focus({ preventScroll: true });
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) setCursor(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor, open]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") setCursor((i) => Math.min(options.length - 1, i + 1));
    else if (e.key === "ArrowUp") setCursor((i) => Math.max(0, i - 1));
    else if (e.key === "Enter" && options[cursor]) pick(options[cursor]);
    else if (e.key === "Escape") close();
    else return;
    e.preventDefault();
  };

  const row = (c: string) => {
    const i = options.indexOf(c);
    const on = c === current;
    return (
      <li
        key={c}
        id={`cur-${c}`}
        data-i={i}
        role="option"
        aria-selected={on}
        className={`currency-opt ${i === cursor ? "active" : ""} ${on ? "on" : ""}`}
        onPointerMove={() => setCursor(i)}
        onClick={() => pick(c)}
      >
        <Flag code={c} />
        <span className="currency-name">{currencyName(c)}</span>
        <span className="currency-code">
          {symbolOf(c) !== c && <b>{symbolOf(c)}</b>}
          {c}
        </span>
        <Tick className="currency-check" size={16} strokeWidth={2.4} aria-hidden />
      </li>
    );
  };

  return (
    <div className={`currency ${open ? "open" : ""}`} ref={root}>
      <button
        ref={btn}
        type="button"
        className="currency-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Currency: ${currencyName(current)}`}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Flag code={current} />
        <span className="currency-btn-label">
          {symbolOf(current) !== current && <b>{symbolOf(current)}</b>}
          {current}
        </span>
        <ChevronDown className="currency-chev" size={16} strokeWidth={2} aria-hidden />
      </button>
      {open && (
        <div className="currency-pop">
          <label className="currency-search">
            <Search size={16} strokeWidth={2} aria-hidden />
            <input
              ref={search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKey}
              placeholder={`Search ${CURRENCIES.length} currencies`}
              aria-label="Search currency"
              role="combobox"
              aria-expanded
              aria-controls="currency-list"
              aria-activedescendant={options[cursor] ? `cur-${options[cursor]}` : undefined}
            />
          </label>
          <ul className="currency-list" id="currency-list" role="listbox" aria-label="Currencies" ref={list} data-lenis-prevent>
            {popular.length > 0 && <li className="currency-group" role="presentation">Popular</li>}
            {popular.map(row)}
            {rest.length > 0 && !q && <li className="currency-group" role="presentation">All currencies</li>}
            {rest.map(row)}
            {options.length === 0 && <li className="currency-empty" role="presentation">No currency matches “{query}”</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function Plans({ plans, period, selected, onSelect, s }: { plans: Plan[]; period: Period; selected: string; onSelect: (id: string) => void; s?: Sec }) {
  useRates();
  const at = (field: string) => (s ? edit(s, field) : {});
  const onKey = (e: KeyboardEvent<HTMLElement>, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (step) {
      e.preventDefault();
      const next = plans[(i + step + plans.length) % plans.length];
      onSelect(next.id);
      document.getElementById(`plan-${next.id}`)?.focus();
    } else if ((e.key === " " || e.key === "Enter") && e.target === e.currentTarget) {
      e.preventDefault();
      onSelect(plans[i].id);
    }
  };

  return (
    <div className="plans" role="radiogroup" aria-label="Plans">
      {plans.map((p, i) => {
        const q = quote(p, period);
        const on = selected === p.id;
        const paid = !!p.monthly;
        const annual = period === "yearly" && paid;
        return (
          <Reveal key={p.id} delay={i * 0.05} className="plan-wrap">
            <article
              id={`plan-${p.id}`}
              className={`plan ${on ? "selected" : ""} ${p.popular ? "is-popular" : ""}`}
              role="radio"
              aria-checked={on}
              aria-label={p.name}
              tabIndex={on ? 0 : -1}
              onClick={() => onSelect(p.id)}
              onKeyDown={(e) => onKey(e, i)}
              onPointerMove={onSpotMove}
            >
              {p.popular && <span className="plan-flag" {...at("popularLabel")}>{s?.popularLabel || "Most popular"}</span>}
              <div className="plan-top">
                <h3 {...at(`plans.${i}.name`)}>{p.name}</h3>
                <span className="plan-radio" aria-hidden>
                  <Check />
                </span>
              </div>

              {/* annual compares with the real monthly price; monthly has no discount */}
              <div className="plan-was">
                {annual ? (
                  <>
                    <s>{usd(p.monthly!)}</s>
                    <span className="plan-off">{ANNUAL_SAVING}% off</span>
                  </>
                ) : null}
              </div>
              <div className="plan-price">
                {q.perMonth === null ? (
                  <span className="amount amount-text">Contact us</span>
                ) : q.perMonth === 0 ? (
                  <span className="amount">Free</span>
                ) : (
                  <>
                    <span className="amount" key={`${p.id}-${period}`} {...at(`plans.${i}.monthly`)}>{usd(q.perMonth)}</span>
                    <span className="per">/mo</span>
                  </>
                )}
              </div>
              <div className="plan-billed">
                {!paid ? null : annual ? (
                  <>
                    <span className="plan-billed-main">{usd(q.charge!)} billed yearly</span>
                    <span className="plan-save">Save {usd(q.yearlySaving)}</span>
                  </>
                ) : (
                  <>
                    <span className="plan-billed-main">Billed monthly</span>
                    <span className="plan-billed-sub"><strong>{usd(q.perYear!)}</strong> a year</span>
                  </>
                )}
              </div>

              <ul className="plan-specs" {...at(`plans.${i}.specs`)}>
                {p.specs.map((spec) => (
                  <li key={spec}>
                    <Icon value={s?.specIcon} attrs={at("specIcon")} fallback={<Check {...at("specIcon")} />} />
                    {spec}
                  </li>
                ))}
              </ul>

              {p.monthly === null ? (
                <a href={registerHref(p, period)} className={`gbtn ${on ? "gbtn-light" : ""} plan-cta`} {...at("contactLabel")}>
                  {s?.contactLabel || "Contact us"}
                </a>
              ) : (
                <a href={registerHref(p, period)} className={`gbtn ${on ? "gbtn-light" : ""} plan-cta`} {...at("ctaLabel")}>
                  {s?.ctaLabel || "Choose plan"}
                </a>
              )}
            </article>
          </Reveal>
        );
      })}
    </div>
  );
}

/** What the prices mean, in the chosen currency. */
function PriceNote() {
  const cur = useRates();
  return (
    <p className="price-note">
      {cur === "USD"
        ? "Prices are in US dollars and exclude taxes."
        : `Prices are set in US dollars and shown in ${cur} at current exchange rates, so the amount you pay may differ slightly. They exclude taxes.`}
    </p>
  );
}

/** Plans as the CMS stores them (specs one per line, no price = "Contact us") become the shape the cards use. */
const toPlans = (s: Sec): Plan[] =>
  ((s.plans ?? []) as { name?: string; monthly?: number; popular?: boolean; specs?: string }[]).map((p, i) => ({
    id: slugify(p.name ?? "") || `plan-${i}`,
    name: p.name ?? "",
    monthly: typeof p.monthly === "number" ? p.monthly : null,
    popular: !!p.popular,
    specs: (p.specs ?? "").split("\n").map((x) => x.trim()).filter(Boolean),
  }));

/** What the page shows when the CMS has nothing for it. The CMS "Pricing" page mirrors these. */
const defaults: Sec[] = [
  {
    _key: "hero", _type: "page-hero", title: "Plans that grow as your space", words: asWords(["takes shape", "connects", "scales"]),
    text: "Start free in a shared space, or move to your own private Morph Space when you're ready.",
  },
  {
    _key: "plans", _type: "plans", heading: "Choose your plan", annualSaving: ANNUAL_SAVING, specIcon: "",
    monthlyLabel: "Monthly", annualLabel: "Annual", popularLabel: "Most popular", ctaLabel: "Choose plan", contactLabel: "Contact us",
    plans: defaultPlans.map((p) => ({ name: p.name, monthly: p.monthly ?? undefined, popular: p.popular, specs: p.specs.join("\n") })),
  },
  ...siteFaqDefaults,
  {
    _key: "cta", _type: "cta-band", heading: "Not sure which plan fits?", text: "Tell us what you need and we'll help you choose.",
    secondaryLabel: "Talk to us", secondaryUrl: "/contact",
  },
];

function Hero({ s }: { s: Sec }) {
  return (
    <Scene video short bgVideo={mediaUrl(s.backgroundVideo)} bgImage={mediaUrl(s.backgroundImage)} id="top" className="scene--hero">
      <h1 className="scene-title scene-title--hero fade-up" {...edit(s, "title")}>
        {s.title}
        <br />
        <RollText words={wordsOf(s.words, ["takes shape"])} />
      </h1>
      <p className="scene-sub fade-up" style={{ animationDelay: "0.3s" }} {...edit(s, "text")}>
        {s.text}
      </p>
    </Scene>
  );
}

function PlansSection({ s }: { s: Sec }) {
  if (typeof s.annualSaving === "number") setAnnualSaving(s.annualSaving);
  const plans = toPlans(s);
  const [period, setPeriod] = useState<Period>("monthly");
  const [picked, setPicked] = useState("");
  const selected = plans.some((p) => p.id === picked) ? picked : (plans.find((p) => p.popular) ?? plans[0])?.id ?? "";
  return (
    <section className="wrap wrap-plans mplans" id="plans">
      <div className="choose-row choose-row--center">
        <h2 {...edit(s, "heading")}>{s.heading}</h2>
        <div className="choose-billing">
          <BillingToggle value={period} onChange={setPeriod} s={s} />
          <CurrencyPicker />
        </div>
      </div>
      {/* the summary only sticks (on phones) while this block is on screen */}
      <div className="plans-area">
        <Plans plans={plans} period={period} selected={selected} onSelect={setPicked} s={s} />
      </div>
      <PriceNote />
    </section>
  );
}

export default function Pricing() {
  useHashScroll();
  const list = useSections(defaults);
  return (
    <main className="inner live">
      <Sections
        list={list}
        registry={{
          "page-hero": (s) => <Hero s={s} />,
          plans: (s) => <PlansSection s={s} />,
          gateway: (s) => <Gate s={s} />,
          faq: (s) => <Faq id="faq" title={s.heading} items={s.items ?? []} paper={!!s.light} note={faqNote(s.note)} editKey={s._key} />,
          "cta-band": (s) => <CtaBand s={s} />,
        }}
      />
    </main>
  );
}
