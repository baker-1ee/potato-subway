import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const GA_ID = "G-HNGFHYP53D";

const dmSans = DM_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Potato on the Subway",
  description: "A word a day, every weekday morning.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.className}>
      <head>
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
