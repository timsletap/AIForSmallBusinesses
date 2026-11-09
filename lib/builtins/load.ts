import { promises as fs } from "fs";
import path from "path";
import { BuiltInFeature } from "./schema";

let cached: BuiltInFeature[] | null = null;

/** Built-in features ship with the build as data/builtins.json (regenerate with `npm run builtins`). */
export async function loadBuiltIns(): Promise<BuiltInFeature[]> {
  if (cached) return cached;
  try {
    cached = BuiltInFeature.array().parse(JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "builtins.json"), "utf8")));
  } catch {
    cached = [];
  }
  return cached;
}
