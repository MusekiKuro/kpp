const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://zeajipsclthtdmqdpahz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplYWppcHNjbHRodGRtcWRwYWh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI0MjcyMCwiZXhwIjoyMDk2ODE4NzIwfQ.ROmrUgohgbmMNg-hmmhYefjzXtdMrGIa3SN_bqvofMo'
);

// Images sourced from official manufacturer sites and reputable retailers
// Кондиционеры — НЕ трогаем (уже есть реальные фото)
const imageUpdates = [

  // ══════════════════════════════════════════════════════
  //  МОНОБЛОКИ
  // ══════════════════════════════════════════════════════

  // HP All-in-One 27" — официальный вид (27-cr серия, серебристый)
  {
    id: '73b1bac3-8329-410e-9a4b-a7231d51fc68',
    image_url: 'https://www.hp.com/h20195/v2/getpdf.aspx/c08549766.pdf',
    // Use technodom direct image instead
    image_url: 'https://api.technodom.kz/f3/api/v1/images/800/800/monoblok_27_hp_all-in-one_27-cb1034ur_natural_silver_i7-1255u_8_462085_1.jpg',
  },

  // HP EliteOne 23.8" — бизнес моноблок HP
  {
    id: 'ab13dec7-1fbd-45d0-8e8b-210a6f2b4f50',
    image_url: 'https://api.technodom.kz/f3/api/v1/images/800/800/monoblok_238_hp_eliteone_800_g9_all-in-one_dos_76p77ua_1.jpg',
  },

  // Lenovo IdeaCentre AIO 3 24IAP7 — белый/серый Lenovo AIO 24"
  {
    id: '6d3a578c-cba3-49e9-9a99-05fd84494ec1',
    image_url: 'https://api.technodom.kz/f3/api/v1/images/800/800/monoblok_238_lenovo_ideacentre_aio_3_24ada6_white_a3050u_8_267322_1.jpg',
  },

  // Lenovo IdeaCentre AIO 3 24IAP7 (Ryzen 5 copy)
  {
    id: 'cacf7bd5-4ffa-4ab0-9841-af465f5b9bc9',
    image_url: 'https://api.technodom.kz/f3/api/v1/images/800/800/monoblok_238_lenovo_ideacentre_aio_3_24ada6_white_a3050u_8_267322_1.jpg',
  },

  // Lenovo IdeaCentre 23.8" Intel N100
  {
    id: '6e512c1d-2e59-4b4c-a032-2f5b19ac9167',
    image_url: 'https://cdn1.technodom.kz/images/goods/230/23_lenovo_ideacentre_aio_3_24iap7_grey_1920x1080_i3-1215u_8_230_1.jpg',
  },

  // Lenovo IdeaCentre AIO 3 27IAP7 — 27" версия
  {
    id: '7644489e-c04e-4bb0-8a8f-4e13e963365f',
    image_url: 'https://p2-ofp.static.pub/fes/cms/2022/09/28/a9x0sktjgqf6c5pf5tdkr82dfklgif9390786.png',
  },

  // Acer Aspire C24-1800
  {
    id: 'fcd3a8c1-af89-473b-9efa-83e40435f161',
    image_url: 'https://static.acer.com/up/Resource/Acer/Series/Aspire_C24-1800/Specification/20230317/Aspire_C24-1800_main_08_356x252.jpg',
  },

  // Acer Aspire C27-1800
  {
    id: '8e71b333-7fa4-4d1a-96e4-063799bca224',
    image_url: 'https://static.acer.com/up/Resource/Acer/Series/Aspire_C27-1800/Specification/20230320/Aspire-C27-1800_gallery_01_356x252.jpg',
  },

  // HP All-in-One 24-cb1038ci
  {
    id: '7332a897-b4bf-4dab-a1d1-b701e83ba879',
    image_url: 'https://api.technodom.kz/f3/api/v1/images/800/800/monoblok_238_hp_all-in-one_24-cr0007ci_natural_silver_i5-12450h_8_458036_1.jpg',
  },

  // HP ProOne 240 G10 — бизнес HP
  {
    id: 'f92ee4e8-72ac-4dfd-b348-c4cf9dc43ddd',
    image_url: 'https://api.technodom.kz/f3/api/v1/images/800/800/monoblok_238_hp_proone_240_g9_all-in-one_dos_6d393ea_1.jpg',
  },

  // Acer Aspire 23.8"
  {
    id: 'a8e4e200-f63b-4c14-8342-4abe0c631a8e',
    image_url: 'https://static.acer.com/up/Resource/Acer/Series/Aspire_C24-1800/Specification/20230317/Aspire_C24-1800_main_08_356x252.jpg',
  },

  // Lenovo ThinkCentre Neo 27"
  {
    id: '24a6e84f-d2ea-4cd2-bc2d-3246bac8d759',
    image_url: 'https://p3-ofp.static.pub/fes/cms/2023/04/18/kgygixbvlnpj2uw93y3yv8m8rtf4l7059665.png',
  },

  // Lenovo Yoga 31.5"
  {
    id: '8372a43d-2060-4625-938c-b49d838db2cc',
    image_url: 'https://p3-ofp.static.pub/fes/cms/2024/09/30/fjfazfvl9cj5dq5lfajfmgjthwuykb2378285.png',
  },

  // ══════════════════════════════════════════════════════
  //  НОУТБУКИ
  // ══════════════════════════════════════════════════════

  // Lenovo IdeaPad Slim 3 15IAH8
  {
    id: '65cd8029-1bd1-496b-9a27-4b514deee497',
    image_url: 'https://p4-ofp.static.pub/fes/cms/2023/02/23/mz4e9q00r0g7bv9ywf8c1w6mfigwvr2356985.png',
  },

  // Lenovo IdeaPad Slim 3 15IRH8
  {
    id: '0d05b52b-5b60-4164-9024-e610546bc6b3',
    image_url: 'https://p4-ofp.static.pub/fes/cms/2023/06/06/f5u2c4grhex6c6j7htvqjmh9jf7tce0978568.png',
  },

  // Lenovo IdeaPad 1 15AMN7
  {
    id: '14c2014f-da58-40d4-a317-495ffcf230d0',
    image_url: 'https://xstore.md/images/product/2025/01/lenovo-ideapad-1-15amn7-2-xstore-md-31.jpg',
  },

  // Acer Aspire 3 A315-44P
  {
    id: '70b68143-1f12-4f52-bd74-55794ff0e15b',
    image_url: 'https://static.acer.com/up/Resource/Acer/Series/Aspire_3_A315-44P/Specification/20221228/Aspire_3_A315-44P_main_04_356x252.jpg',
  },

  // Acer Aspire 5 A515-58M
  {
    id: 'a70d7bab-3d31-4fc9-b8fb-1b502379129f',
    image_url: 'https://static.acer.com/up/Resource/Acer/Series/Aspire_5_A515-58M/Specification/20230517/Aspire_5_A515-58M_main_01_356x252.jpg',
  },

  // HP 15s-fq5000
  {
    id: '0b425f80-3e76-4134-9218-5b1b04a762e4',
    image_url: 'https://api.technodom.kz/f3/api/v1/images/800/800/noutbuk_156_hp_15s-fq5295nia_natural_silver_i5-1235u_8_285388_1.jpg',
  },

  // HP 250 G10
  {
    id: '9052e275-e177-4893-9b66-c095912bc4dc',
    image_url: 'https://api.technodom.kz/f3/api/v1/images/800/800/noutbuk_156_hp_250_g10_dos_9g8g7pt_1.jpg',
  },

  // Acer Aspire Lite AL15-52
  {
    id: 'a81847fb-da6b-4f34-89eb-758c33e26182',
    image_url: 'https://static.acer.com/up/Resource/Acer/Series/Aspire_Lite_AL15-52/Specification/20221219/Aspire_Lite_AL15-52_main_01_356x252.jpg',
  },

  // ══════════════════════════════════════════════════════
  //  ТЕЛЕВИЗОРЫ
  // ══════════════════════════════════════════════════════

  // Samsung 50" Crystal UHD 4K (BU8000)
  {
    id: '0fb9d319-470b-491a-83fc-3091cac50738',
    image_url: 'https://images.samsung.com/is/image/samsung/p6pim/kz/ua50bu8000uxce/gallery/kz-crystal-uhd-bu8000-ua50bu8000uxce-532548430?$684_547_PNG$',
  },

  // LG 55" UHD 4K
  {
    id: '1885c216-5d7e-49e5-a0cd-f3716eb56555',
    image_url: 'https://www.lg.com/content/dam/channel/wcms/kz/images/tvs/55ur78006lk_aeu/gallery/medium01/55UR78006LK-AEU-D-01-MED.jpg',
  },

  // Xiaomi TV A2 43"
  {
    id: 'd0d7799f-9be0-4b19-9aa8-99815246a33c',
    image_url: 'https://i02.appmifile.com/mi-com-product/fly-birds/tv-a2-43/photo/BdRHlJeHCE96.png',
  },

  // ══════════════════════════════════════════════════════
  //  ХОЛОДИЛЬНИКИ
  // ══════════════════════════════════════════════════════

  // Samsung RB34T670FSA/WT (белый, двухкамерный)
  {
    id: 'fdd14c4c-6428-40d3-a2e2-6be46fd8410b',
    image_url: 'https://images.samsung.com/is/image/samsung/p6pim/kz/rb34t670fsa-wt/gallery/kz-top-mount-freezer-rb34t670fsa-wt-431890780?$684_547_PNG$',
  },

  // Beko RCNK311E20VW (белый, No-Frost)
  {
    id: '1c09cc33-98ad-45f9-b1d7-1c73835a6cee',
    image_url: 'https://productimages.hepsiburada.net/s/104/550/110000094261803.jpg',
  },
];

async function main() {
  console.log(`Updating ${imageUpdates.length} product images...\n`);
  
  let successCount = 0;
  let errorCount = 0;

  for (const item of imageUpdates) {
    const { id, image_url, ...rest } = item;
    const { error } = await supabase
      .from('products')
      .update({ image_url })
      .eq('id', id);

    if (error) {
      console.error(`❌ Failed [${id}]:`, error.message);
      errorCount++;
    } else {
      console.log(`✅ Updated: ${id.slice(0, 8)}...`);
      successCount++;
    }
  }

  console.log(`\n📊 Results: ${successCount} updated, ${errorCount} errors`);
}

main();
