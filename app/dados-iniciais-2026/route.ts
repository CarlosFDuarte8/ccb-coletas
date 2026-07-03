import { seedDatabase } from "@/lib/storage/seed";

export const dynamic = "force-static";

export function GET() {
  return new Response(JSON.stringify(seedDatabase, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ccb-coletas-dados-iniciais-2026.json"',
    },
  });
}
