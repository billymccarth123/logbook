import Image from "next/image";
import { PHOTOS } from "@/lib/photos";

// photoUrl is the seller's uploaded photo; demo listings use the credited photos instead.
type Props = { id: string; make: string; model: string; photoUrl?: string | null; large?: boolean };

export function CarImage({ id, make, model, photoUrl, large = false }: Props) {
  const photo = PHOTOS[id];
  const frame = `relative overflow-hidden bg-zinc-100 dark:bg-zinc-900 ${large ? "aspect-video rounded-2xl" : "aspect-4/3 rounded-xl"}`;

  if (photoUrl) {
    return (
      <div className={frame}>
        {/* Already resized when uploaded, so it's served as is. */}
        <Image
          src={photoUrl}
          alt={`${make} ${model}`}
          fill
          unoptimized
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
          priority={large}
        />
      </div>
    );
  }

  if (photo) {
    return (
      <div className={frame}>
        <Image
          src={photo.src}
          alt={`${make} ${model}`}
          fill
          sizes={large ? "(min-width: 1024px) 800px, 100vw" : "(min-width: 1024px) 300px, 50vw"}
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
          priority={large}
        />
      </div>
    );
  }

  // Placeholder for listings without a photo.
  return (
    <div className={`${frame} flex flex-col items-center justify-center text-center text-zinc-400 dark:text-zinc-600`}>
      <span className={`font-semibold ${large ? "text-3xl" : "text-base"}`}>{make}</span>
      <span className={large ? "text-lg" : "text-xs"}>{model}</span>
    </div>
  );
}

export function PhotoCredit({ id, photoUrl }: { id: string; photoUrl?: string | null }) {
  const photo = PHOTOS[id];
  if (!photo || photoUrl) return null;
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
