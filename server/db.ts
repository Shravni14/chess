import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { chessGames, chessRooms, InsertChessGame, InsertChessRoom, InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0];
}

export async function createChessGame(game: InsertChessGame) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(chessGames).values(game);
  const id = Number(result[0].insertId);
  return getChessGameById(id);
}

export async function updateChessGame(id: number, game: Partial<InsertChessGame>) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(chessGames).set(game).where(eq(chessGames.id, id));
  return getChessGameById(id);
}

export async function getChessGameById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(chessGames).where(eq(chessGames.id, id)).limit(1);
  return rows[0];
}

export async function getLatestChessGame(userId: number, mode?: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(chessGames).where(eq(chessGames.userId, userId)).orderBy(desc(chessGames.updatedAt)).limit(20);
  return (mode ? rows.find((row) => row.gameMode === mode) : rows[0]) ?? null;
}

export async function createChessRoom(room: InsertChessRoom) {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(chessRooms).values(room);
  return getChessRoom(room.roomCode);
}

export async function getChessRoom(roomCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(chessRooms).where(eq(chessRooms.roomCode, roomCode)).limit(1);
  return rows[0];
}

export async function updateChessRoom(roomCode: string, room: Partial<InsertChessRoom>) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(chessRooms).set(room).where(eq(chessRooms.roomCode, roomCode));
  return getChessRoom(roomCode);
}

export async function getUserChessRooms(openId: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(chessRooms).where(eq(chessRooms.hostId, openId)).orderBy(desc(chessRooms.updatedAt)).limit(20);
  return rows;
}

export { chessGames, chessRooms };
export type { InsertChessGame, InsertChessRoom };
