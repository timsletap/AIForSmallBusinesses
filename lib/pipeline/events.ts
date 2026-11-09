/**
 * Turns pipeline log lines into structured progress events for the live Discover view.
 * Kept next to the pipeline so the log wording and the parser change together.
 */
export type Stage = "search" | "site" | "extract" | "verify" | "save";

export type DiscoverEvent =
  | { type: "stage"; stage: Stage; message: string }
  | { type: "candidates"; names: string[] }
  | { type: "candidate"; name: string; url: string; stage: Stage; message: string }
  | { type: "result"; name: string; status: "published" | "draft" | "rejected" | "failed" | "skipped"; detail: string; slug?: string; checks?: number; price?: string }
  | { type: "done"; approved: number; held: number; message: string }
  | { type: "error"; message: string };

export function parseLogLine(line: string, current: { name: string; url: string } | null): DiscoverEvent | null {
  let m: RegExpMatchArray | null;
  if ((m = line.match(/^search: "(.*)"$/))) return { type: "stage", stage: "search", message: `Searching the web for “${m[1]}”` };
  if ((m = line.match(/^skipping (\d+) vendor/))) return { type: "stage", stage: "search", message: `Skipped ${m[1]} tool(s) already in the directory` };
  if ((m = line.match(/^found \d+ candidate\(s\): (.*)$/)))
    return { type: "candidates", names: m[1] === "no new vendors this time" ? [] : m[1].split(", ") };
  if ((m = line.match(/^→ (.+) \((https?:\/\/[^)]+)\)/))) return { type: "candidate", name: m[1], url: m[2], stage: "site", message: "Opening the official website" };
  if (!current) return null;
  if ((m = line.match(/^ {2}found pages: (.*)$/)))
    return { type: "candidate", ...current, stage: "site", message: m[1] === "none" ? "Reading the homepage" : `Found ${m[1]} pages` };
  if ((m = line.match(/^ {2}fetched (\d+) page/))) return { type: "candidate", ...current, stage: "extract", message: `Reading ${m[1]} official page(s) and extracting facts` };
  if (/^ {2}dropped unverified fields/.test(line))
    return { type: "candidate", ...current, stage: "extract", message: "Removed facts we couldn't find word-for-word on their site" };
  if ((m = line.match(/^ {2}domain age: (.*)$/))) return { type: "candidate", ...current, stage: "verify", message: `Checking track record: website age ${m[1]}` };
  if ((m = line.match(/^✓ (.+?): (published|draft|rejected), trust (\w+) \((\d)\/6 checks\), price (.+)$/)))
    return {
      type: "result",
      name: m[1],
      status: m[2] as "published" | "draft" | "rejected",
      checks: Number(m[4]),
      price: m[5] === "unknown" ? "Price not listed" : `From $${m[5]}/month`,
      detail: m[2] === "published" ? "Passed vendor checks and added to the directory" : "Held for human review",
    };
  if ((m = line.match(/^✗ (.+?): (.*)$/))) return { type: "result", name: m[1], status: "failed", detail: m[2] };
  return null;
}
