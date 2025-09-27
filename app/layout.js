// app/layout.jsx
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/logo.png" sizes="any" />
        {/* Luckysheet CSS */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/luckysheet@latest/dist/assets/css/luckysheet.css"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
        data-theme="light"
      >
        {children}

        {/* Ionicons */}
        <Script
          type="module"
          src="https://cdn.jsdelivr.net/npm/ionicons@7.4.0/dist/ionicons/ionicons.esm.js"
          strategy="afterInteractive"
        />
        <Script
          nomodule
          src="https://cdn.jsdelivr.net/npm/ionicons@7.4.0/dist/ionicons/ionicons.js"
          strategy="afterInteractive"
        />

        {/* Luckysheet JS */}
        <Script
          src="https://cdn.jsdelivr.net/npm/luckysheet@latest/dist/assets/js/luckysheet.umd.js"
          strategy="afterInteractive"
          onLoad={() => {
            console.log("Luckysheet cargado");
          }}
        />
      </body>
    </html>
  );
}
