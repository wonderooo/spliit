import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

/** Default Gemini model — Flash is on Google AI Studio's free tier. Override
 *  with GEMINI_MODEL (e.g. gemini-2.5-flash-lite for lower cost). */
const DEFAULT_MODEL = "gemini-2.5-flash";

export type ScannedReceipt = {
  merchant: string | null;
  items: { name: string; price: number }[];
  tax: number | null;
  tip: number | null;
  total: number | null;
  currency: string | null;
};

// Validates the model's JSON so a malformed response can't reach the UI.
const llmReceiptSchema = z.object({
  merchant: z.string().nullable().optional(),
  items: z
    .array(z.object({ name: z.string(), price: z.number() }))
    .default([]),
  tax: z.number().nullable().optional(),
  tip: z.number().nullable().optional(),
  total: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
});

function prompt(fallbackCurrency: string): string {
  return [
    "You are a precise receipt parser. Read this receipt image and extract every",
    "purchased line item with its price.",
    "Extract the merchant/store name (e.g. the business at the top of the receipt)",
    "as `merchant`; use null if there isn't a clear one.",
    "Detect the receipt's currency and return its ISO 4217 code (e.g. USD, EUR, JPY, GBP)",
    "based on currency symbols, printed codes, language, and the country/address if shown.",
    `If the currency is genuinely unclear, use ${fallbackCurrency}.`,
    "Report prices as plain numbers in major units",
    "(e.g. 12.99 — no currency symbols, no thousands separators).",
    "If a line shows a quantity (e.g. 2x), report the line's total price for that item.",
    "Extract the grand total when present.",
    "Only report `tax` and `tip` (tip / gratuity / service charge) as amounts that are",
    "ADDED ON TOP OF the listed item prices to reach the grand total.",
    "If tax is already included in the item prices - i.e. VAT-inclusive pricing, common",
    "outside the US, where the item prices and the grand total already contain the tax -",
    "report tax as null even when a VAT/tax amount is printed for information only.",
    "Reliable check: if the listed item prices already add up to the grand total, then",
    "tax and tip are already included - report both as null.",
    "Do NOT include subtotal, payment lines (cash/card/change), or store metadata as items.",
    "Use null for tax, tip, or total if they are not shown or already included in the item prices.",
  ].join(" ");
}

export async function scanReceipt(
  imageBase64: string,
  mimeType: string,
  currency: string,
): Promise<ScannedReceipt> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set on the server.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const response = await ai.models.generateContent({
    model,
    contents: [
      { text: prompt(currency) },
      { inlineData: { mimeType, data: imageBase64 } },
    ],
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          merchant: {
            type: Type.STRING,
            nullable: true,
            description: "Merchant / store name printed on the receipt.",
          },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                price: { type: Type.NUMBER },
              },
              required: ["name", "price"],
            },
          },
          tax: { type: Type.NUMBER, nullable: true },
          tip: { type: Type.NUMBER, nullable: true },
          total: { type: Type.NUMBER, nullable: true },
          currency: {
            type: Type.STRING,
            nullable: true,
            description: "Detected ISO 4217 currency code, e.g. USD, EUR, JPY.",
          },
        },
        required: ["items"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("The model returned an empty response.");

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("The model returned invalid JSON.");
  }

  const parsed = llmReceiptSchema.parse(raw);
  return {
    merchant: parsed.merchant?.trim() ? parsed.merchant.trim() : null,
    items: parsed.items.filter((i) => i.name.trim().length > 0 && i.price > 0),
    tax: parsed.tax ?? null,
    tip: parsed.tip ?? null,
    total: parsed.total ?? null,
    currency: parsed.currency ? parsed.currency.trim().toUpperCase() : null,
  };
}
