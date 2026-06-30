import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

/** Default Gemini model — Flash is on Google AI Studio's free tier. Override
 *  with GEMINI_MODEL (e.g. gemini-2.5-flash-lite for lower cost). */
const DEFAULT_MODEL = "gemini-2.5-flash";

export type ScannedReceipt = {
  items: { name: string; price: number }[];
  tax: number | null;
  tip: number | null;
  total: number | null;
  currency: string | null;
};

// Validates the model's JSON so a malformed response can't reach the UI.
const llmReceiptSchema = z.object({
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
    "Detect the receipt's currency and return its ISO 4217 code (e.g. USD, EUR, JPY, GBP)",
    "based on currency symbols, printed codes, language, and the country/address if shown.",
    `If the currency is genuinely unclear, use ${fallbackCurrency}.`,
    "Report prices as plain numbers in major units",
    "(e.g. 12.99 — no currency symbols, no thousands separators).",
    "If a line shows a quantity (e.g. 2x), report the line's total price for that item.",
    "Separately extract tax, tip/gratuity/service charge, and the grand total when present.",
    "Do NOT include subtotal, payment lines (cash/card/change), or store metadata as items.",
    "Use null for tax, tip, or total if they are not shown.",
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
    items: parsed.items.filter((i) => i.name.trim().length > 0 && i.price > 0),
    tax: parsed.tax ?? null,
    tip: parsed.tip ?? null,
    total: parsed.total ?? null,
    currency: parsed.currency ? parsed.currency.trim().toUpperCase() : null,
  };
}
