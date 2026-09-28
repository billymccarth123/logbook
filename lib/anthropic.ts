import "server-only";

import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null | undefined;

// null when ANTHROPIC_API_KEY isn't set, so callers can fall back.
export function getAnthropic() {
  if (client === undefined) {
    client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  }
  return client;
}

export { Anthropic };
