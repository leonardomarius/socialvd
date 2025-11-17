/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      "oggldwirthkytzewihqz.supabase.co"
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "oggldwirthkytzewihqz.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

module.exports = nextConfig;
