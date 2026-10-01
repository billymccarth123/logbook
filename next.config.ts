import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serve car photos as-is. The on-the-fly image optimizer hung on some sizes
  // on Windows, which blocked every other request from the page.
  images: { unoptimized: true },
  experimental: {
    // Listing photos are resized in the browser, but allow room for a 4 MB
    // photo (the server-side limit) plus the rest of the form.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
