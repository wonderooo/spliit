// Compile-time guard: pl.json must structurally match the Dictionary shape
// (derived from en.json). If a key drifts or is missing, `tsc` fails here.
// This file has no runtime role - it exists only so type-checking covers pl.json.
import type { Dictionary } from "@/lib/i18n/dictionary";
import pl from "./pl.json";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _plMatchesDictionary: Dictionary = pl;
