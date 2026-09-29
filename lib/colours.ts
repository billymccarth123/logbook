// Car colours sellers can choose from. Pure module: safe in client components.
export const COLOURS = [
  "Black",
  "White",
  "Silver",
  "Grey",
  "Blue",
  "Red",
  "Green",
  "Yellow",
  "Orange",
  "Brown",
  "Beige",
  "Other",
] as const;

export type Colour = (typeof COLOURS)[number];

export function isColour(value: string): value is Colour {
  return (COLOURS as readonly string[]).includes(value);
}
