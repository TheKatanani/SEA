import { BookingReceipt } from "@/components/Checkout";
export const dynamic = "force-dynamic";
export const metadata = { title: "SEA · Booking", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default function CallbackPage() { return <BookingReceipt callback />; }

