import { BookingReceipt } from "@/components/Checkout";
export const dynamic = "force-dynamic";
export const metadata = { title: "SEA · Receipt", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function ReceiptPage({ params }: { params: Promise<{ bookingId: string }> }) { const { bookingId } = await params; return <BookingReceipt bookingId={bookingId} />; }

