import "server-only";

import { getCurrentUser } from "./auth";
import type { Profile } from "./driver-profile";

// The signed-in user's quote details, or null when logged out.
export async function getProfile(): Promise<Profile | null> {
  return (await getCurrentUser())?.profile ?? null;
}
