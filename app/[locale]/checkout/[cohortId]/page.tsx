import { notFound } from "next/navigation";
import { Checkout } from "@/components/Checkout";
import { getCohort } from "@/lib/booking/service";
import { publicCohort } from "@/lib/booking/domain";
import { assertBookingEnabled } from "@/lib/booking/security";
import { getAdminDb } from "@/lib/firebase/admin";
export const dynamic = "force-dynamic";
export const metadata = { title: "SEA · Booking", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function CheckoutPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  let cohort;
  try { cohort = await getCohort(cohortId); } catch { notFound(); }
  if (cohort.status !== "published") notFound();
  const program = await getAdminDb().collection(cohort.programCollection).doc(cohort.programId).get();
  if (program.data()?.status !== "published") notFound();
  let enabled = true; try { assertBookingEnabled(); } catch { enabled = false; }
  return <Checkout cohort={publicCohort(cohort)} enabled={enabled} demo={process.env.SITE_DEMO_MODE === "true"} />;
}

