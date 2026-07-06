import { describe, it, expect } from "vitest";
import {
  toMinorUnits,
  toMajorUnits,
  convertMinorUnits,
  currencyDecimals,
} from "@/lib/currency";

describe("currency minor units", () => {
  it("converts 2-decimal currencies", () => {
    expect(toMinorUnits("12.34", "USD")).toBe(1234);
    expect(toMajorUnits(1234, "USD")).toBeCloseTo(12.34);
  });

  it("converts 0-decimal currencies (JPY)", () => {
    expect(currencyDecimals("JPY")).toBe(0);
    expect(toMinorUnits("1500", "JPY")).toBe(1500);
    expect(toMajorUnits(1500, "JPY")).toBe(1500);
  });

  it("converts 3-decimal currencies (KWD)", () => {
    expect(currencyDecimals("KWD")).toBe(3);
    expect(toMinorUnits("1.234", "KWD")).toBe(1234);
  });

  it("rounds correctly", () => {
    expect(toMinorUnits("10.005", "USD")).toBe(1001);
    expect(toMinorUnits("10.004", "USD")).toBe(1000);
  });

  it("accepts a decimal comma (mobile keyboards)", () => {
    expect(toMinorUnits("12,34", "USD")).toBe(1234);
    expect(toMinorUnits("1,5", "PLN")).toBe(150);
  });

  it("throws on invalid input", () => {
    expect(() => toMinorUnits("abc", "USD")).toThrow();
  });
});

describe("convertMinorUnits", () => {
  it("converts EUR cents to USD cents", () => {
    // 60.00 EUR at 1.08 -> 64.80 USD
    expect(convertMinorUnits(6000, 1.08, "EUR", "USD")).toBe(6480);
  });

  it("converts across differing decimals (EUR -> JPY)", () => {
    // 10.00 EUR at 160 -> 1600 JPY (0 decimals)
    expect(convertMinorUnits(1000, 160, "EUR", "JPY")).toBe(1600);
  });

  it("identity rate is a no-op for same decimals", () => {
    expect(convertMinorUnits(1234, 1, "USD", "USD")).toBe(1234);
  });
});
