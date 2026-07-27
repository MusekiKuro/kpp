-- T14 / F03: Disable public INSERT policy on legacy orders table.
-- Revoke direct anon/authenticated INSERT permissions on public.orders.
-- Historical orders table remains accessible to admins for read/update/delete.

DROP POLICY IF EXISTS "Public insert orders" ON public.orders;

-- Ensure RLS is enabled and only admins can access orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

REVOKE INSERT ON public.orders FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.orders TO authenticated;

DROP POLICY IF EXISTS "Admins read orders" ON public.orders;
CREATE POLICY "Admins read orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins update orders" ON public.orders;
CREATE POLICY "Admins update orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins delete orders" ON public.orders;
CREATE POLICY "Admins delete orders"
  ON public.orders FOR DELETE TO authenticated
  USING (public.is_admin());
