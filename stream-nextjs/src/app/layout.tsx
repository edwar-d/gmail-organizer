import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Stream - AI Email Organization",
  description: "Organize less, flow more. AI that anticipates, so you don't have to organize",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link 
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" 
          rel="stylesheet" 
        />
      </head>
      <body
        className="antialiased"
        style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
