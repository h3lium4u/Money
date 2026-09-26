import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Petti Remittance - Dubai to India Money Transfer Management",
  description: "Cross-border financial tracking, calculations, receivables, and reconciliation system.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden bg-slate-50 antialiased">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-y-auto p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
