"use server";

import { getValuation } from "@/lib/ai-valuation";
import { parseCarForValuation, type Valuation } from "@/lib/valuation";

export type ValueState = { error?: string; valuation?: Valuation };

export async function valueCarAction(_state: ValueState, formData: FormData): Promise<ValueState> {
  const parsed = parseCarForValuation((key) => String(formData.get(key) ?? "").trim());
  if ("error" in parsed) return { error: parsed.error };
  return getValuation(parsed.car);
}
