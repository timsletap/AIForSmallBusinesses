import type { Tool } from "@/lib/schemas/tool";
import { toolLabel } from "@/lib/taxonomy/tools";
import { getUseCase } from "@/lib/taxonomy/useCases";
import { monthlyPrice } from "./score";

/** Browse page keyword search + filters. Tools with no industry listed work for any business. */
export function filterTools(
  tools: Tool[],
  f: { q?: string; industry?: string; use_case?: string; max_price?: number | null },
): Tool[] {
  const words = (f.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return tools.filter((t) => {
    if (f.use_case && !t.use_cases.includes(f.use_case as Tool["use_cases"][number])) return false;
    // Tools with no industry listed work for any business.
    if (f.industry && t.industries.length && !t.industries.includes(f.industry as Tool["industries"][number])) return false;
    if (f.max_price != null) {
      const p = monthlyPrice(t);
      if (p === null || p > f.max_price) return false;
    }
    if (words.length) {
      const hay = [
        t.name,
        t.vendor ?? "",
        t.description,
        ...t.use_cases.map((u) => getUseCase(u)?.label ?? ""),
        ...t.integrations.map(toolLabel),
      ]
        .join(" ")
        .toLowerCase();
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
}
