import { Inter } from "next/font/google";
import "./globals.css";
import CartProvider from "@/components/CartProvider";
import CartButton from "@/components/CartButton";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata = {
  title: {
    default: "Nurset — Техника, мебель и оборудование | Тараз, Казахстан",
    template: "%s — Nurset",
  },
  description:
    "Nurset — магазин техники, мебели и оборудования в Таразе. Смартфоны, ноутбуки, телевизоры, бытовая техника. Доставка по Казахстану.",
  keywords: "техника, мебель, оборудование, Тараз, Казахстан, Nurset, смартфоны, ноутбуки",
  openGraph: {
    title: "Nurset — Техника, мебель и оборудование",
    description: "Широкий ассортимент техники и мебели. Доставка по Казахстану.",
    type: "website",
    locale: "ru_KZ",
    siteName: "Nurset",
    url: "https://nurset.kz",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.svg',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-surface text-gray-800">
        <CartProvider>
          {children}
          <CartButton />
        </CartProvider>
      </body>
    </html>
  );
}
