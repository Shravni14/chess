import { describe, expect, it } from "vitest";
import { commitGameMove, formatClock, initialGame, moveFromSquares } from "../shared/chess";

describe("chess enhancements", () => {
  it("formats selectable chess clock values", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(180)).toBe("03:00");
    expect(formatClock(600)).toBe("10:00");
  });

  it("reaches the tactical Scholar's Mate position and validates Qxf7", () => {
    let game = initialGame();
    const setup: Array<[[number, number], [number, number]]> = [
      [[6, 4], [4, 4]],
      [[1, 4], [3, 4]],
      [[7, 3], [3, 7]],
      [[0, 1], [2, 2]],
      [[7, 5], [4, 2]],
      [[0, 6], [2, 5]],
    ];
    for (const [from, to] of setup) {
      const move = moveFromSquares(game, from, to);
      expect(move).toBeTruthy();
      game = commitGameMove(game, move!).game;
    }
    const target = moveFromSquares(game, [3, 7], [1, 5]);
    expect(target).toBeTruthy();
    const result = commitGameMove(game, target!);
    expect(result.status).toBe("checkmate");
    expect(result.game.history.at(-1)).toBe("Qxf7#");
  });

  it("supports multiple curated puzzle positions", () => {
    let game = initialGame();
    const setup: Array<[[number, number], [number, number]]> = [
      [[6, 3], [4, 3]],
      [[1, 4], [3, 4]],
      [[6, 2], [4, 2]],
      [[0, 6], [2, 5]],
      [[7, 6], [5, 5]],
      [[1, 3], [2, 3]],
    ];
    for (const [from, to] of setup) {
      const move = moveFromSquares(game, from, to);
      expect(move).toBeTruthy();
      game = commitGameMove(game, move!).game;
    }
    const target = moveFromSquares(game, [5, 5], [7, 6]);
    expect(target).toBeTruthy();
    const result = commitGameMove(game, target!);
    expect(result.game.history.length).toBe(7);
  });
});
