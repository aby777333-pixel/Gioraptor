import type { NextConfig } from "next";

const NEW_TERMINAL_BASE = "https://zippy-piroshki-21aa30.netlify.app";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/terminal",
        destination: NEW_TERMINAL_BASE,
        permanent: false,
      },
      {
        source: "/terminal/:path*",
        destination: `${NEW_TERMINAL_BASE}/:path*`,
        permanent: false,
      },
      {
        source: "/dashboard/terminal",
        destination: NEW_TERMINAL_BASE,
        permanent: false,
      },
      {
        source: "/dashboard/terminal/:path*",
        destination: `${NEW_TERMINAL_BASE}/:path*`,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
