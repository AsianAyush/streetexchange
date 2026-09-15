/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Allows production builds to complete successfully even if project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allows production builds to complete even if there are minor type warnings.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
