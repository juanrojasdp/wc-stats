import type { NextConfig } from "next";

// Static export only (AD-13): no functions, no middleware, no image service.
// Next 16 removed the `eslint` key and `next build` never lints — the lint gate
// lives in the npm `build` script chain, ahead of this build.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
