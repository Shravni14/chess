# Bug verification notes

The live preview reproduced the reported AI issue: after a legal `e2-e4` move, the interface stayed on `ENGINE THINKING` with Black's position unchanged. A direct benchmark of `chooseAIMove` completed within 11 ms at difficulty 1, 104 ms at difficulty 2, and 247 ms at difficulty 3, so the UI callback required a fail-safe rather than a slower search. The browser log also contained an unauthenticated `games.latest` query error because the backend query returned `undefined` for a missing saved game.

The board had previously shown coordinate alignment problems at responsive widths and used low-contrast glyph rendering. The fix adds a guarded AI callback with a legal-move fallback and `finally` state cleanup, improves board frame geometry, touch behavior, square selection contrast, piece shadows, and responsive file-coordinate layout.
