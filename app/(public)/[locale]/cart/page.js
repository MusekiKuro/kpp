import { redirect } from 'next/navigation'

export default async function LegacyCartRoute({ params }) {
  const { locale } = await params
  redirect(`/${locale}/request`)
}
