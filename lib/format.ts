const euro = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("en-IE");

export function formatEuro(amount: number) {
  return euro.format(Math.round(amount));
}

export function formatKm(km: number) {
  return `${number.format(km)} km`;
}

export function formatEngine(litres: number) {
  return `${litres.toFixed(1)}L`;
}
