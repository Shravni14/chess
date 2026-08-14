import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { initialGame } from "../shared/chess";

function createMockContext(openId = "test-user-openid", id = 1): TrpcContext {
  const user = {
    id,
    openId,
    email: "test@example.com",
    name: "Test Player",
    loginMethod: "manus",
    role: "user" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("chess tRPC procedures", () => {
  it("allows unauthenticated query for auth.me", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const me = await caller.auth.me();
    expect(me).toBeNull();
  });

  it("fails game save for unauthenticated callers", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const game = initialGame();
    await expect(
      caller.games.save({
        gameMode: "ai",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        boardState: game,
        history: [],
        status: "playing",
        turn: "w",
      })
    ).rejects.toThrow();
  });
});
