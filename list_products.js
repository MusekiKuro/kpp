const { createClient } = require('@supabase/supabase-js');

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(
  'https://zeajipsclthtdmqdpahz.supabase.co',
  serviceRoleKey
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

main().catch(() => {
  console.error('Product listing failed.');
  process.exitCode = 1;
});
