import type { Profile } from "@/lib/schemas/profile";
import { profileToParams } from "@/lib/schemas/profile";

/** Carries the owner's answers through GET forms (state lives in the URL, nothing is stored). */
export function ProfileHidden({ profile }: { profile: Profile }) {
  return (
    <>
      {[...profileToParams(profile).entries()].map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}
