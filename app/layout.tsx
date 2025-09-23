// app/layout.tsx
import "./globals.css";
import TopNav from "./components/TopNav";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-white text-black">
        <TopNav />
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
