import { z } from "zod";

const nameSchema = z.string().trim().min(1).max(20);
const avatarSchema = z.string().regex(/^crest-\d{1,2}$/);

const gemSchema = z.enum([
  "RUBY",
  "SAPPHIRE",
  "EMERALD",
  "ONYX",
  "PEARL",
]);

const resourceSchema = z.enum([
  "RUBY",
  "SAPPHIRE",
  "EMERALD",
  "ONYX",
  "PEARL",
  "ROYAL",
]);

// partialRecord: in zod 4 a record keyed by an enum requires *every* key, which
// rejected normal partial payments like { RUBY: 3 } and every discard.
const tokenCountsSchema = z.partialRecord(resourceSchema, z.number().int().nonnegative());
const paymentSchema = tokenCountsSchema.optional();

const nobleIdSchema = z.string().min(1).max(80).optional();

export const gameActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("TAKE_TOKENS"),
    tokens: z.array(gemSchema).min(1).max(3),
    discard: paymentSchema,
    nobleId: nobleIdSchema,
  }),
  z.object({
    type: z.literal("BUY_CARD"),
    cardId: z.string().min(1).max(80),
    payment: tokenCountsSchema,
    nobleId: nobleIdSchema,
  }),
  z.object({
    type: z.literal("RESERVE_CARD"),
    cardId: z.string().min(1).max(80).optional(),
    deckTier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    discard: paymentSchema,
    nobleId: nobleIdSchema,
  }),
  z.object({ type: z.literal("PASS"), nobleId: nobleIdSchema }),
]);

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("JOIN_GAME"),
    roomCode: z.string().min(4).max(8),
    name: nameSchema.optional(),
    avatar: avatarSchema.optional(),
  }),
  z.object({ type: z.literal("WATCH_GAME"), roomCode: z.string().min(4).max(8) }),
  z.object({ type: z.literal("READY") }),
  z.object({ type: z.literal("START_GAME") }),
  z.object({ type: z.literal("GAME_ACTION"), action: gameActionSchema }),
  z.object({ type: z.literal("LEAVE_GAME") }),
  z.object({ type: z.literal("PING") }),
  z.object({ type: z.literal("REMATCH") }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;


/** Body of POST /rooms. */
export const createRoomBodySchema = z.object({
  name: nameSchema.optional(),
  avatar: avatarSchema.optional(),
  maxPlayers: z.number().int().min(2).max(4).optional(),
});

/** Body of POST /rooms/:code/join. */
export const joinRoomBodySchema = z.object({
  name: nameSchema.optional(),
  avatar: avatarSchema.optional(),
});
