import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Listing photos are resized in the browser, but allow room for a 4 MB
    // photo (the server-side limit) plus the rest of the form.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
