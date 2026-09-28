import Image from "next/image";
import { PHOTOS } from "@/lib/photos";

const GRADIENTS = [
  "from-emerald-500 to-teal-700",
  "from-sky-500 to-indigo-700",
  "from-amber-400 to-orange-600",
  "from-rose-400 to-fuchsia-700",
  "from-slate-500 to-slate-800",
];

type Props = { id: string; make: string; model: string; large?: boolean };

export function CarImage({ id, make, model, large = false }: Props) {
  const photo = PHOTOS[id];
  const frame = large ? "aspect-video rounded-2xl" : "aspect-4/3";

  if (photo) {
    return (
      <div className={`relative overflow-hidden bg-zinc-200 dark:bg-zinc-800 ${frame}`}>
        <Image
          src={photo.src}
          alt={`${make} ${model}`}
          fill
          sizes={large ? "(min-width: 1024px) 700px, 100vw" : "(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"}
          className="object-cover"
          priority={large}
        />
      </div>
    );
  }

  // Placeholder for listings without a photo.
  const gradient = GRADIENTS[Number(id) % GRADIENTS.length] ?? GRADIENTS[0];
  return (
    <div className={`flex items-end bg-linear-to-br ${gradient} ${frame} ${large ? "p-6" : "p-4"}`}>
      <div className="text-white">
        <div className={`font-bold ${large ? "text-4xl" : "text-xl"}`}>{make}</div>
        <div className={large ? "text-xl opacity-90" : "text-sm opacity-90"}>{model}</div>
      </div>
    </div>
  );
}

export function PhotoCredit({ id }: { id: string }) {
  const photo = PHOTOS[id];
  if (!photo) return null;
  return (
    <p className="text-xs text-zinc-500">
      Photo: {photo.author},{" "}
      <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="underline">
        {photo.license}
      </a>
      , via Wikimedia Commons. Illustrative, not the car for sale.
    </p>
  );
}
