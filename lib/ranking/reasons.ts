import type { Profile } from "@/lib/schemas/profile";
import { toolNoun } from "@/lib/taxonomy/tools";
import { getUseCase } from "@/lib/taxonomy/useCases";
import { industryById } from "@/lib/taxonomy/industries";
import type { FactorId, Scored } from "./score";

const list = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

type Bullet = { factor: FactorId; good: boolean; strength: number; text: string };

/** 3 plain-language bullets from the strongest and weakest factors. Deterministic; no LLM. */
export function buildReasons(s: Scored, p: Profile): string[] {
  const t = s.tool;
  const f = Object.fromEntries(s.factors.map((x) => [x.id, x])) as Record<FactorId, Scored["factors"][number]>;
  const bullets: Bullet[] = [];

  const uc = getUseCase(s.matched_use_case);
  const primary = t.use_cases[0] === s.matched_use_case;
  bullets.push({
    factor: "use_case",
    good: primary,
    strength: f.use_case.f * f.use_case.weight,
    text: primary ? `Built for ${uc?.reason}` : `Also helps with ${uc?.reason}`,
  });

  const ind = industryById(p.industry);
  if (s.industry_fit === "match" && ind) {
    bullets.push({ factor: "use_case", good: true, strength: 13, text: `Made for ${ind.label.toLowerCase()} businesses like yours` });
  } else if (s.industry_fit === "other_industries" && ind) {
    bullets.push({ factor: "use_case", good: false, strength: 9, text: `Not made specifically for ${ind.label.toLowerCase()} businesses` });
  }

  if (s.relevant_tools.length) {
    bullets.push(
      s.matched_tools.length
        ? {
            factor: "works_with",
            good: true,
            strength: f.works_with.f * f.works_with.weight,
            text: `Works with your ${list(s.matched_tools.map(toolNoun))}`,
          }
        : {
            factor: "works_with",
            good: false,
            strength: f.works_with.weight,
            text: `We couldn't confirm it works with your ${list(s.relevant_tools.map(toolNoun))}`,
          },
    );
  } else if (t.works_standalone) {
    bullets.push({ factor: "works_with", good: true, strength: 12, text: "Works on its own, no other apps needed" });
  }

  if (s.price === null) {
    bullets.push({ factor: "affordability", good: false, strength: 10, text: "Price isn't listed. Ask before signing up" });
  } else if (s.price === 0) {
    bullets.push({ factor: "affordability", good: true, strength: 15, text: "Has a free plan to start" });
  } else if (s.over_budget_by !== null) {
    bullets.push({
      factor: "affordability",
      good: false,
      strength: 15 - f.affordability.points,
      text: `Over your budget by ${money(s.over_budget_by)}/month (about ${money(s.price)}/month)`,
    });
  } else {
    bullets.push({
      factor: "affordability",
      good: true,
      strength: 14,
      text: `Fits your ${money(p.budget_usd)} budget at about ${money(s.price)}/month`,
    });
  }

  if (t.setup_complexity === "low") {
    bullets.push({ factor: "ease", good: true, strength: 13, text: "Easy setup you can do yourself" });
  } else if (t.setup_complexity === "high") {
    bullets.push({ factor: "ease", good: false, strength: 12, text: "Setup takes more work; plan for help" });
  }

  const failed = Object.entries(t.vendor_checks).filter(([, c]) => !c.pass).map(([k]) => k);
  if (failed.includes("privacy_policy")) {
    bullets.push({ factor: "trust", good: false, strength: 14, text: "No privacy policy found" });
  } else if (t.trust_level === "verified" || t.trust_level === "checks_passed") {
    bullets.push({ factor: "trust", good: true, strength: 9, text: "Vendor passed our safety checks" });
  }

  const good = bullets.filter((b) => b.good).sort((a, b) => b.strength - a.strength);
  const bad = bullets.filter((b) => !b.good).sort((a, b) => b.strength - a.strength);
  const picked = [...good.slice(0, bad.length ? 2 : 3), ...bad.slice(0, 1)];
  for (const b of [...good, ...bad]) {
    if (picked.length >= 3) break;
    if (!picked.includes(b)) picked.push(b);
  }
  return picked.slice(0, 3).map((b) => b.text);
}

/**
 * P1 break-even line: how many extra customers a month cover the cost, at a typical sale for the
 * owner's industry. Returns null for free tools or unknown prices.
 */
export function breakEven(price: number | null, industry: Profile["industry"]): string | null {
  if (!price) return null;
  const ind = industryById(industry);
  if (!ind) return null;
  const n = Math.max(1, Math.ceil(price / ind.typicalSale));
  const who = n === 1 ? "1 extra customer" : `${n} extra customers`;
  return `Pays for itself if it brings in about ${who} a month (based on a typical $${ind.typicalSale} ${ind.saleWord}).`;
}
