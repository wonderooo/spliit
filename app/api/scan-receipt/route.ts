import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { scanReceipt } from "@/lib/receipt-ai";

// Vision calls take a few seconds — give the function headroom.
export const maxDuration = 30;

const bodySchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.string().default("image/jpeg"),
  currency: z.string().default("USD"),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const result = await scanReceipt(
      body.imageBase64,
      body.mimeType,
      body.currency,
    );
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not scan receipt.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
