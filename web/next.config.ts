import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * better-sqlite3 is a native addon and exceljs ships CommonJS with dynamic
   * requires — both must stay outside the server bundle.
   */
  serverExternalPackages: [
    "better-sqlite3",
    "@prisma/adapter-better-sqlite3",
    "exceljs",
  ],
};

export default nextConfig;
