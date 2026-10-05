import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/**
 * This machine's LAN addresses, so friends on the same network can open the dev
 * server (e.g. http://192.168.0.100:3100) even after the router hands out a new IP.
 * Next.js blocks dev assets and hot reload for any hostname not listed here.
 */
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((address) => address && address.family === "IPv4" && !address.internal)
  .map((address) => address!.address);

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [...new Set(["192.168.0.137", ...lanAddresses])],
  // Dev-only badge; keep it off the logo in the top-left corner.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
