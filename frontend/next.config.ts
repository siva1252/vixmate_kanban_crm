import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Docker / Jenkins production image
  output: "standalone",
  // Keep Next rooted on this app — a parent lockfile was making compiles scan the whole user folder.
  outputFileTracingRoot: dir,
  turbopack: {
    root: dir,
  },
};

export default nextConfig;
