import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ProductGrid from "@/components/ProductGrid";
import AboutSection from "@/components/AboutSection";
import ContactsSection from "@/components/ContactsSection";
import Footer from "@/components/Footer";
import { createServerClient } from "@/lib/supabase-server";

export default async function HomePage() {
  let products = [];

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (!error && data) {
      products = data;
    }
  } catch (e) {
    // Supabase not configured yet — use empty array
    console.warn("Supabase not configured:", e.message);
  }

  return (
    <>
      <Header />

      <main className="flex-1">
        <Hero />

        {/* ═══ КАТАЛОГ ═══ */}
        <ProductGrid products={products} />

        <AboutSection />
        <ContactsSection />
      </main>

      <Footer />
    </>
  );
}
