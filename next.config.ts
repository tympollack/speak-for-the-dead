import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile Three.js ecosystem packages — required for Next.js 16 App Router
  transpilePackages: [
    "three",
    "@react-three/fiber",
    "@react-three/drei",
    "@react-three/postprocessing",
    "postprocessing",
    "leva",
  ],

  // Next.js 16: Turbopack is the default bundler for both dev AND build.
  // The legacy webpack() function causes build failures with Turbopack.
  // All webpack customisations are expressed here instead.
  turbopack: {
    resolveAlias: {
      // Mock the `canvas` package server-side so Three.js doesn't attempt
      // to import a DOM API that doesn't exist in Node.js.
      canvas: "./lib/empty-module.js",
    },
    rules: {
      // Treat GLSL/WGSL shader files as raw text strings.
      "*.{glsl,vert,frag,vs,fs}": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },

  experimental: {
    serverActions: {
      // Match the 10 MB cap enforced by the /api/upload-token route.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;


