/** @type {import('next').NextConfig} */
// cache-bust: force webpack recompile after admin route deletions
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
