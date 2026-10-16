export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
  let admin: typeof import("@/lib/firebase/admin");

  try {
    admin = await import("@/lib/firebase/admin");
  } catch (error) {
    const code = getSafeErrorCode(error);
    console.error("Firebase Admin diagnostic failed during module load", code);
    return Response.json(
      { status: "module-load-failed", code, nodeVersion: process.versions.node, modules: getSafeModuleNames(error) },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!admin.isFirebaseAdminConfigured()) {
    return Response.json(
      { status: "missing-config", nodeMajor },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const snapshot = await admin.getAdminDb().collection("brand").doc("main").get();
    return Response.json(
      { status: "firestore-ok", brandPublished: snapshot.data()?.status === "published", nodeMajor },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const code = getSafeErrorCode(error);
    console.error("Firebase Admin diagnostic failed during Firestore read", code);
    return Response.json(
      { status: "firestore-failed", code, nodeMajor },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

function getSafeErrorCode(error: unknown) {
  if (typeof error === "object" && error && "code" in error && (typeof error.code === "string" || typeof error.code === "number")) {
    return String(error.code).slice(0, 80);
  }
  return error instanceof Error ? error.name : "unknown";
}

function getSafeModuleNames(error: unknown) {
  if (!(error instanceof Error)) return [];
  return [...new Set([...error.message.matchAll(/node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/g)].map((match) => match[1]))].slice(0, 4);
}
