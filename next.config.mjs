/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['node:sqlite', 'exceljs'],
};

export default nextConfig;
