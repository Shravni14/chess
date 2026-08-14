import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createChessGame, createChessRoom, getChessGameById, getChessRoom, getLatestChessGame, getUserChessRooms, updateChessGame, updateChessRoom } from "./db";

const gameStateSchema = z.object({
  board: z.array(z.array(z.string().nullable()).length(8)).length(8),
  state: z.object({
    castling: z.object({ wK: z.boolean(), wQ: z.boolean(), bK: z.boolean(), bQ: z.boolean() }),
    enPassant: z.tuple([z.number(), z.number()]).nullable(),
    turn: z.enum(["w", "b"]),
    halfmove: z.number().int().nonnegative(),
    fullmove: z.number().int().positive(),
  }),
  history: z.array(z.string()),
  captured: z.object({ w: z.array(z.string()), b: z.array(z.string()) }),
  repetition: z.record(z.string(), z.number().int().positive()),
  lastMove: z.object({ from: z.tuple([z.number(), z.number()]), to: z.tuple([z.number(), z.number()]) }).nullable(),
});
const gameStatusSchema = z.enum(["playing", "check", "checkmate", "stalemate", "draw-50move", "draw-repetition", "draw-insufficient"]);

const gameInput = z.object({
  id: z.number().optional(),
  gameMode: z.enum(["ai", "local", "online"]).default("ai"),
  roomCode: z.string().optional(),
  fen: z.string(),
  boardState: gameStateSchema,
  history: z.array(z.string()),
  status: gameStatusSchema,
  whitePlayer: z.string().optional(),
  blackPlayer: z.string().optional(),
  turn: z.enum(["w", "b"]),
});

const roomState = z.object({
  roomCode: z.string().min(6).max(16),
  gameState: gameStateSchema,
  hostName: z.string().max(128).optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  games: router({
    latest: protectedProcedure.input(z.object({ mode: z.enum(["ai", "local", "online"]).optional() }).optional()).query(({ ctx, input }) => getLatestChessGame(ctx.user.id, input?.mode)),
    save: protectedProcedure.input(gameInput).mutation(async ({ ctx, input }) => {
      const payload = {
        userId: ctx.user.id,
        gameMode: input.gameMode,
        roomCode: input.roomCode ?? null,
        fen: input.fen,
        boardState: input.boardState,
        history: input.history,
        status: input.status,
        whitePlayer: input.whitePlayer ?? null,
        blackPlayer: input.blackPlayer ?? null,
        turn: input.turn,
      };
      if (input.id) {
        const existing = await getChessGameById(input.id);
        if (!existing || existing.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        return updateChessGame(input.id, payload);
      }
      return createChessGame(payload);
    }),
  }),
  rooms: router({
    get: protectedProcedure.input(z.object({ roomCode: z.string().min(6).max(16) })).query(({ input }) => getChessRoom(input.roomCode.toUpperCase())),
    list: protectedProcedure.query(({ ctx }) => getUserChessRooms(ctx.user.openId)),
    create: protectedProcedure.input(roomState).mutation(async ({ ctx, input }) => {
      const code = input.roomCode.toUpperCase();
      const existing = await getChessRoom(code);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "That room code is already in use." });
      return createChessRoom({ roomCode: code, hostId: ctx.user.openId, hostName: input.hostName ?? ctx.user.name ?? "White", gameState: input.gameState, status: "waiting" });
    }),
    join: protectedProcedure.input(z.object({ roomCode: z.string().min(6).max(16), guestName: z.string().max(128).optional() })).mutation(async ({ ctx, input }) => {
      const code = input.roomCode.toUpperCase();
      const room = await getChessRoom(code);
      if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found." });
      if (room.hostId === ctx.user.openId) return room;
      if (room.guestId && room.guestId !== ctx.user.openId) throw new TRPCError({ code: "CONFLICT", message: "That room already has two players." });
      return updateChessRoom(code, { guestId: ctx.user.openId, guestName: input.guestName ?? ctx.user.name ?? "Black", status: "active" });
    }),
    update: protectedProcedure.input(z.object({ roomCode: z.string().min(6).max(16), gameState: gameStateSchema, status: z.enum(["waiting", "active", "finished"]).optional() })).mutation(async ({ ctx, input }) => {
      const room = await getChessRoom(input.roomCode.toUpperCase());
      if (!room || (room.hostId !== ctx.user.openId && room.guestId !== ctx.user.openId)) throw new TRPCError({ code: "FORBIDDEN" });
      return updateChessRoom(input.roomCode.toUpperCase(), { gameState: input.gameState, status: input.status ?? room.status });
    }),
  }),
});

export type AppRouter = typeof appRouter;
