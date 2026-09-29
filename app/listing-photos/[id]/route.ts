import { getPhoto } from "@/lib/listings";

// Serves a seller's uploaded photo. URLs carry a version (?v=), so they can be cached for good.
export async function GET(_request: Request, ctx: RouteContext<"/listing-photos/[id]">) {
  const { id } = await ctx.params;
  const photo = getPhoto(id);
  if (!photo) return new Response("Not found", { status: 404 });

  return new Response(Buffer.from(photo.data), {
    headers: {
      "Content-Type": photo.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
