import { redirect } from 'next/navigation'

export default async function CheckoutOrderRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/order/${id}`)
}
