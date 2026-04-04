import { z } from "zod";
import { GameIdSchema } from "./types";

/** Path param `:id` — coerces string to positive integer */
export const IdParamSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10)),
});

/** Path param `:ordinal` or `:ord` — coerces string to integer */
export const OrdinalParamSchema = z.object({
  ordinal: z.string().transform(val => parseInt(val, 10)),
});

/** Common `?gameId=` query param */
export const GameIdQuerySchema = z.object({
  gameId: GameIdSchema.optional(),
});
