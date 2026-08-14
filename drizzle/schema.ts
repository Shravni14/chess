import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Chess games table for storing persistent local and AI games, user history, and game state.
 */
export const chessGames = mysqlTable("chess_games", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"), // nullable for guest players
  gameMode: varchar("gameMode", { length: 32 }).notNull().default("ai"), // ai, local, online
  roomCode: varchar("roomCode", { length: 16 }),
  fen: text("fen").notNull(), // FEN string or JSON serialized board state
  boardState: json("boardState").notNull(), // complete serialized board and game state
  history: json("history").notNull(), // array of move notations
  status: varchar("status", { length: 32 }).notNull().default("playing"), // playing, check, checkmate, stalemate, draw
  whitePlayer: varchar("whitePlayer", { length: 128 }),
  blackPlayer: varchar("blackPlayer", { length: 128 }),
  turn: varchar("turn", { length: 4 }).notNull().default("w"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChessGame = typeof chessGames.$inferSelect;
export type InsertChessGame = typeof chessGames.$inferInsert;

/**
 * Online multiplayer rooms table for real-time room matchmaking and sync.
 */
export const chessRooms = mysqlTable("chess_rooms", {
  id: int("id").autoincrement().primaryKey(),
  roomCode: varchar("roomCode", { length: 16 }).notNull().unique(),
  hostId: varchar("hostId", { length: 64 }).notNull(),
  hostName: varchar("hostName", { length: 128 }),
  guestId: varchar("guestId", { length: 64 }),
  guestName: varchar("guestName", { length: 128 }),
  gameState: json("gameState").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("waiting"), // waiting, active, finished
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChessRoom = typeof chessRooms.$inferSelect;
export type InsertChessRoom = typeof chessRooms.$inferInsert;
