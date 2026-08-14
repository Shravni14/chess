import { describe, expect, it } from "vitest";
import { applyMove, initialBoard, initialGame, initialState, legalMoves, legalMovesForSquare, getStatus, positionKey, serializeGame, safeGame, type Board, type GameState } from "./chess";

describe("chess rules engine", () => {
  it("starts with the standard position and twenty legal white moves", () => {
    const board = initialBoard();
    const state = initialState();
    expect(board[7][4]).toBe("wK");
    expect(board[0][4]).toBe("bK");
    expect(legalMoves(board, "w", state)).toHaveLength(20);
  });

  it("supports castling after the path is clear", () => {
    const board = initialBoard();
    board[7][5] = null; board[7][6] = null;
    const state = initialState();
    expect(legalMovesForSquare({ board, state, history: [], captured: { w: [], b: [] }, repetition: { [positionKey(board, state)]: 1 }, lastMove: null }, [7, 4]).some((move) => move.castle === "K")).toBe(true);
  });

  it("supports en passant after a double-step", () => {
    const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[7][4] = "wK"; board[0][4] = "bK"; board[3][4] = "wP"; board[1][3] = "bP";
    const state: GameState = { castling: { wK: false, wQ: false, bK: false, bQ: false }, enPassant: null, turn: "b", halfmove: 0, fullmove: 1 };
    const after = applyMove(board, state, { from: [1, 3], to: [3, 3], doubleStep: true });
    expect(after.state.enPassant).toEqual([2, 3]);
    expect(legalMoves(after.board, "w", after.state).some((move) => move.enPassant)).toBe(true);
  });

  it("detects a basic checkmate position", () => {
    const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
    board[0][0] = "bK"; board[2][2] = "wK"; board[1][1] = "wQ";
    const state: GameState = { castling: { wK: false, wQ: false, bK: false, bQ: false }, enPassant: null, turn: "b", halfmove: 0, fullmove: 1 };
    expect(getStatus(board, state)).toBe("checkmate");
  });

  it("round-trips a complete game snapshot", () => {
    const game = initialGame();
    const restored = safeGame(serializeGame(game));
    expect(restored.board).toEqual(game.board);
    expect(restored.state.turn).toBe("w");
    expect(restored.repetition).toEqual(game.repetition);
  });
});
