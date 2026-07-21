const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://zeajipsclthtdmqdpahz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplYWppcHNjbHRodGRtcWRwYWh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI0MjcyMCwiZXhwIjoyMDk2ODE4NzIwfQ.ROmrUgohgbmMNg-hmmhYefjzXtdMrGIa3SN_bqvofMo'
);

async function main() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, category, image_url')
    .order('category', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

main();
