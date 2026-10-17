import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.MANDATE_RUNTIME === "node" ? { output: "standalone" } : {}),
};

export default nextConfig;
