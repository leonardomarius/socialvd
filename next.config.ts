/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      "oggldwirthkytzewihqz.supabase.co",
      "juhjfdnbobeeeckycizd.supabase.co" // ← domaine de ton vrai projet Supabase
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "oggldwirthkytzewihqz.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "juhjfdnbobeeeckycizd.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

module.exports = nextConfig;
