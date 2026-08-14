import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Bot, ChevronDown, CircleHelp, Copy, Crown, Flag, Globe2, Handshake, History, LogIn, Menu, Moon, MoreHorizontal, RotateCcw, Settings2, Sparkles, Swords, Undo2, UserRound, Users, Wifi, X } from "lucide-react";
import {
  Board, Color, GameStatus, Move, Piece, PieceType, SerializedGame, Square, boardCols, boardRows, boardThemes, colorName, colorOf, cloneGame, commitGameMove, difficulties, formatClock, legalMoves, moveFromSquares, serializeGame, toFen, getBoardColors, getCapturedScore, getGameStatus, getModeDescription, getModeLabel, getOpeningHint, getPieceDisplay, getRoomCodeDisplay, getRoomStatusLabel, initialGame, isGameOver, legalMovesForSquare, modes, newRoomCode, normalizeRoomCode, pieceSets, safeGame, statusLabel, statusTone, typeOf, chooseAIMove,
} from "@shared/chess";

const INITIAL_PREFERENCES = { boardTheme: "classic-wood", pieceSet: "glyph" };
const TIME_CONTROLS = [
  { value: "untimed", label: "Untimed", seconds: 0 },
  { value: "blitz", label: "Blitz · 3 min", seconds: 180 },
  { value: "rapid", label: "Rapid · 10 min", seconds: 600 },
  { value: "classical", label: "Classical · 30 min", seconds: 1800 },
] as const;
const GAME_MODES = [...modes, { value: "puzzle", label: "Puzzle lab" }] as const;
type TimeControl = typeof TIME_CONTROLS[number]["value"];
type ClockState = { w: number; b: number };
type PuzzleDefinition = { title: string; description: string; objective: string; game: SerializedGame; target: Move };

function createPuzzle(seed: Array<[Square, Square]>, targetSquares: [Square, Square], title: string, description: string, objective: string): PuzzleDefinition {
  let current = initialGame();
  for (const [from, to] of seed) {
    const move = moveFromSquares(current, from, to);
    if (!move) throw new Error(`Invalid puzzle setup move: ${from.join(",")} to ${to.join(",")}`);
    current = commitGameMove(current, move).game;
  }
  const target = moveFromSquares(current, targetSquares[0], targetSquares[1]);
  if (!target) throw new Error("Puzzle target is not legal");
  return { title, description, objective, game: current, target };
}

const PUZZLES: PuzzleDefinition[] = [
  createPuzzle(
    [[[6, 4], [4, 4]], [[1, 4], [3, 4]], [[7, 3], [3, 7]], [[0, 1], [2, 2]], [[7, 5], [4, 2]], [[0, 6], [2, 5]]],
    [[3, 7], [1, 5]],
    "Scholar's finish",
    "A classic attacking pattern with the queen and bishop aligned on f7.",
    "Find the checkmate in one.",
  ),
  createPuzzle(
    [[[6, 3], [4, 3]], [[1, 4], [3, 4]], [[6, 2], [4, 2]], [[0, 6], [2, 5]], [[7, 6], [5, 5]], [[1, 3], [2, 3]]],
    [[5, 5], [7, 6]],
    "Knight leap",
    "Utilize a knight fork to secure decisive material advantage.",
    "Execute the winning knight jump.",
  ),
];

function getClockStart(timeControl: TimeControl): ClockState {
  const seconds = TIME_CONTROLS.find((item) => item.value === timeControl)?.seconds || 0;
  return { w: seconds, b: seconds };
}

function PieceGlyph({ piece, pieceSet }: { piece: Piece; pieceSet: string }) {
  return <span className={`piece-glyph piece-${piece[0]} piece-set-${pieceSet} ${pieceSet === "modern" ? "piece-modern" : ""}`}>{getPieceDisplay(piece, pieceSet)}</span>;
}

function CapturedRow({ pieces, pieceSet, label, score }: { pieces: Piece[]; pieceSet: string; label: string; score: number }) {
  return (
    <div className="captured-row">
      <div className="captured-label"><span>{label}</span><span className="captured-score">{score > 0 ? `+${score}` : ""}</span></div>
      <div className="captured-pieces" aria-label={`${label} captured pieces`}>
        {pieces.length ? pieces.map((piece, index) => <span key={`${piece}-${index}`} className="captured-piece"><PieceGlyph piece={piece} pieceSet={pieceSet} /></span>) : <span className="captured-empty">No captures yet</span>}
      </div>
    </div>
  );
}

export default function Home() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [mode, setMode] = useState("ai");
  const [difficulty, setDifficulty] = useState(2);
  const [timeControl, setTimeControl] = useState<TimeControl>("rapid");
  const [clock, setClock] = useState<ClockState>(() => getClockStart("rapid"));
  const [clockPaused, setClockPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [puzzleFeedback, setPuzzleFeedback] = useState("");
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [game, setGame] = useState<SerializedGame>(() => initialGame());
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotionMove, setPromotionMove] = useState<Move | null>(null);
  const [thinking, setThinking] = useState(false);
  const [finishedReason, setFinishedReason] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<SerializedGame[]>([]);
  const [roomCode, setRoomCode] = useState("");
  const [roomRole, setRoomRole] = useState<"host" | "guest" | null>(null);
  const [roomNotice, setRoomNotice] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState(() => {
    try { return JSON.parse(localStorage.getItem("knights-gambit-preferences") || "null") || INITIAL_PREFERENCES; } catch { return INITIAL_PREFERENCES; }
  });
  const savedGameId = useRef<number | undefined>(undefined);
  const lastRoomUpdated = useRef<string | null>(null);
  const hydratedGameId = useRef<number | undefined>(undefined);
  const audioContextRef = useRef<AudioContext | null>(null);

  const gameStatus = getGameStatus(game);
  const boardColors = getBoardColors(preferences.boardTheme);
  const aiColor: Color = "b";
  const legalTargets = useMemo(() => selected ? legalMovesForSquare(game, selected) : [], [game, selected]);
  const historyRows = useMemo(() => Array.from({ length: Math.ceil(game.history.length / 2) }, (_, i) => ({ number: i + 1, white: game.history[i * 2] || "", black: game.history[i * 2 + 1] || "" })), [game.history]);
  const scores = getCapturedScore(game.captured);
  const currentPuzzle = PUZZLES[puzzleIndex];

  const latestGameQuery = trpc.games.latest.useQuery({ mode: mode as "ai" | "local" | "online" }, { enabled: isAuthenticated && (mode === "ai" || mode === "local"), staleTime: Infinity });
  const saveGame = trpc.games.save.useMutation({ onSuccess: (saved) => { if (saved?.id) savedGameId.current = saved.id; } });
  const createRoom = trpc.rooms.create.useMutation();
  const joinRoom = trpc.rooms.join.useMutation();
  const updateRoom = trpc.rooms.update.useMutation();
  const roomQuery = trpc.rooms.get.useQuery({ roomCode: normalizeRoomCode(roomCode) }, {
    enabled: mode === "online" && isAuthenticated && normalizeRoomCode(roomCode).length >= 6,
    refetchInterval: 1500,
  });

  useEffect(() => {
    document.title = "Knight's Gambit · Online Chess";
    localStorage.setItem("knights-gambit-preferences", JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    if (latestGameQuery.data?.boardState && latestGameQuery.data.id !== hydratedGameId.current && game.history.length === 0) {
      hydratedGameId.current = latestGameQuery.data.id;
      savedGameId.current = latestGameQuery.data.id;
      setGame(safeGame(latestGameQuery.data.boardState));
      setRoomNotice("Resumed your latest saved game.");
    }
  }, [latestGameQuery.data, game.history.length]);

  useEffect(() => {
    localStorage.setItem("knights-gambit-game", serializeGame(game));
  }, [game]);

  useEffect(() => {
    if (!isAuthenticated || game.history.length === 0 || mode === "online") return;
    saveGame.mutate({ id: savedGameId.current, gameMode: mode as "ai" | "local", fen: toFen(game.board, game.state), boardState: game, history: game.history, status: gameStatus, whitePlayer: user?.name || "White", blackPlayer: mode === "ai" ? "Knight's Gambit" : "Black", turn: game.state.turn });
  }, [game, gameStatus, isAuthenticated, mode, saveGame, user?.name]);

  useEffect(() => {
    if (mode !== "online" || !roomQuery.data?.gameState || thinking) return;
    const updatedAt = String(roomQuery.data.updatedAt);
    if (updatedAt === lastRoomUpdated.current) return;
    lastRoomUpdated.current = updatedAt;
    const remote = safeGame(roomQuery.data.gameState);
    if (remote.history.length >= game.history.length || roomRole === "guest") {
      setGame(remote);
      setSelected(null);
    }
  }, [roomQuery.data, mode, roomRole, thinking, game.history.length]);

  useEffect(() => {
    if (timeControl === "untimed" || clockPaused || mode === "puzzle" || isGameOver(game) || !!finishedReason) return;
    const timer = window.setInterval(() => {
      setClock((previous) => {
        const color = game.state.turn;
        const nextValue = Math.max(0, previous[color] - 1);
        if (previous[color] > 0 && nextValue === 0) {
          window.setTimeout(() => {
            const message = `${colorName(color)} ran out of time.`;
            setFinishedReason(message);
            setRoomNotice(message);
            setClockPaused(true);
            playTone("end");
          }, 0);
        }
        return { ...previous, [color]: nextValue };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timeControl, clockPaused, mode, game.state.turn, gameStatus, finishedReason]);

  useEffect(() => {
    if (mode !== "ai" || game.state.turn !== aiColor || isGameOver(game) || !!finishedReason || thinking) return;
    setThinking(true);
    const timer = window.setTimeout(() => {
      try {
        const move = chooseAIMove(game, aiColor, difficulty) ?? legalMoves(game.board, aiColor, game.state)[0];
        if (!move) {
          setFinishedReason("The engine could not find a legal move.");
          setRoomNotice("Start a new game to restart the engine.");
          return;
        }
        applyMove(move);
      } catch (error) {
        console.error("AI move failed", error);
        setFinishedReason("The engine stopped unexpectedly.");
        setRoomNotice("Start a new game to restart the engine.");
      } finally {
        setThinking(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [game, mode, difficulty, finishedReason]);

  useEffect(() => {
    setClock(getClockStart(timeControl));
    setClockPaused(false);
  }, [timeControl]);

  function playTone(kind: "move" | "capture" | "check" | "end") {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      const context = audioContextRef.current || new AudioCtor();
      audioContextRef.current = context;
      if (context.state === "suspended") void context.resume();
      const frequencies = { move: 420, capture: 280, check: 620, end: 180 };
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = kind === "end" ? "triangle" : "sine";
      oscillator.frequency.value = frequencies[kind];
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(kind === "end" ? 0.12 : 0.07, context.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (kind === "end" ? 0.42 : 0.12));
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + (kind === "end" ? 0.45 : 0.14));
    } catch (error) {
      console.warn("Audio unavailable", error);
    }
  }

  function changeMode(nextMode: string) {
    setMode(nextMode);
    setSelected(null); setPromotionMove(null); setThinking(false); setFinishedReason(null); setRoomNotice(""); setSnapshots([]);
    setPuzzleFeedback(""); setPuzzleSolved(false);
    const nextGame = nextMode === "puzzle" ? currentPuzzle.game : initialGame();
    setGame(cloneGame(nextGame));
    setClock(getClockStart(timeControl));
    setClockPaused(nextMode === "puzzle");
    savedGameId.current = undefined; hydratedGameId.current = undefined;
  }

  function startPuzzle(index = puzzleIndex) {
    const nextPuzzle = PUZZLES[index];
    setPuzzleIndex(index); setMode("puzzle"); setSelected(null); setPromotionMove(null); setSnapshots([]); setThinking(false); setFinishedReason(null); setPuzzleFeedback(""); setPuzzleSolved(false);
    setGame(cloneGame(nextPuzzle.game)); setClock(getClockStart(timeControl)); setClockPaused(true);
  }

  function resetGame() {
    if (mode === "puzzle") { startPuzzle(puzzleIndex); return; }
    setGame(initialGame()); setSnapshots([]); setSelected(null); setPromotionMove(null); setThinking(false); setFinishedReason(null); setClock(getClockStart(timeControl)); setClockPaused(false); savedGameId.current = undefined; hydratedGameId.current = undefined; setRoomNotice("");
  }

  function applyMove(move: Move, promotion: PieceType = "Q") {
    if (mode === "puzzle" && (move.from[0] !== currentPuzzle.target.from[0] || move.from[1] !== currentPuzzle.target.from[1] || move.to[0] !== currentPuzzle.target.to[0] || move.to[1] !== currentPuzzle.target.to[1])) {
      setPuzzleFeedback("Not the line. Try the forcing move that finishes the attack.");
      setSelected(null); playTone("end");
      return;
    }
    const previous = game;
    const result = commitGameMove(game, move, promotion);
    setSnapshots((items) => [...items.slice(-49), previous]);
    setGame(result.game); setSelected(null); setPromotionMove(null);
    if (result.status === "checkmate" || result.status === "stalemate" || result.status.startsWith("draw")) { setFinishedReason(statusLabel(result.status, result.game.state.turn)); playTone("end"); }
    else if (result.status === "check") playTone("check");
    else playTone(result.captured ? "capture" : "move");
    if (mode === "puzzle") { setPuzzleSolved(true); setPuzzleFeedback("Solved. Excellent calculation."); setClockPaused(true); }
    if (mode === "online" && roomCode && roomRole) {
      updateRoom.mutate({ roomCode: normalizeRoomCode(roomCode), gameState: result.game, status: isGameOver(result.game) ? "finished" : "active" });
    }
  }

  function handleSquareClick(square: Square) {
    if (isGameOver(game) || !!finishedReason || thinking) return;
    const piece = game.board[square[0]][square[1]];
    if (selected) {
      const move = legalTargets.find((candidate) => candidate.to[0] === square[0] && candidate.to[1] === square[1]);
      if (move) { if (move.promotion) setPromotionMove(move); else applyMove(move); return; }
      if (piece && colorOf(piece) === game.state.turn) { setSelected(square); return; }
      setSelected(null); return;
    }
    const myColor = mode === "online" ? (roomRole === "host" ? "w" : roomRole === "guest" ? "b" : null) : (mode === "ai" ? "w" : game.state.turn);
    if (mode === "online" && roomRole && myColor && game.state.turn !== myColor) { setRoomNotice(`It is ${colorName(game.state.turn)}'s turn.`); return; }
    if (piece && colorOf(piece) === game.state.turn && (mode !== "ai" || game.state.turn !== aiColor) && (mode !== "online" || !myColor || colorOf(piece) === myColor)) setSelected(square);
  }

  function createOnlineRoom() {
    if (!isAuthenticated) { startLogin(); return; }
    const code = normalizeRoomCode(roomCode) || newRoomCode();
    setRoomCode(code); setRoomRole("host"); setRoomNotice("Creating room…");
    createRoom.mutate({ roomCode: code, gameState: game, hostName: user?.name || "White" }, { onSuccess: () => { setRoomNotice("Room ready. You are White. Share the code with your opponent."); }, onError: (error) => { setRoomRole(null); setRoomNotice(error.message); } });
  }

  function joinOnlineRoom() {
    if (!isAuthenticated) { startLogin(); return; }
    const code = normalizeRoomCode(roomCode); if (code.length < 6) { setRoomNotice("Enter a valid room code."); return; }
    setRoomNotice("Joining room…");
    joinRoom.mutate({ roomCode: code, guestName: user?.name || "Black" }, { onSuccess: (room) => { setRoomCode(code); setRoomRole("guest"); setGame(safeGame(room?.gameState)); setRoomNotice("Connected. You are Black."); }, onError: (error) => { setRoomRole(null); setRoomNotice(error.message); } });
  }

  function copyRoomCode() { if (roomCode) navigator.clipboard?.writeText(roomCode).then(() => setRoomNotice("Room code copied.")); }
  function undoMove() { const previous = snapshots[snapshots.length - 1]; if (!previous || mode === "online") return; setSnapshots((items) => items.slice(0, -1)); setGame(previous); setSelected(null); }
  function resign() { if (isGameOver(game) || finishedReason) return; const message = `${colorName(game.state.turn)} resigned.`; setFinishedReason(message); setClockPaused(true); setRoomNotice(message); playTone("end"); if (mode === "online" && roomCode) updateRoom.mutate({ roomCode: normalizeRoomCode(roomCode), gameState: game, status: "finished" }); }
  function offerDraw() { if (mode === "local") { setFinishedReason("Draw agreed."); setClockPaused(true); playTone("end"); } setRoomNotice(mode === "online" ? "Draw offer sent to your opponent." : "Draw agreed for this local game."); }
  function clockClass(color: Color) { return `clock ${clock[color] > 0 && clock[color] <= 30 ? "clock-low" : ""} ${clockPaused ? "clock-paused" : ""} ${game.state.turn === color ? "clock-active" : ""}`; }

  return (
    <div className="chess-app">
      <header className="app-header">
        <div className="brand-lockup"><div className="brand-mark"><Crown size={18} /></div><div><div className="brand-name">Knight's Gambit</div><div className="brand-caption">A considered chess experience</div></div></div>
        <div className="header-actions"><span className="server-pill"><span className="live-dot" />Live systems operational</span>{isAuthenticated ? <button className="user-chip" onClick={() => logout()}><UserRound size={15} />{user?.name || "Account"}</button> : <Button variant="outline" size="sm" onClick={() => startLogin()}><LogIn size={15} />Sign in to save</Button>}<button className="icon-button" aria-label="Help"><CircleHelp size={19} /></button><button className="icon-button mobile-only" aria-label="Menu"><Menu size={19} /></button></div>
      </header>

      <main className="app-main">
        <section className="hero-row"><div><div className="eyebrow"><Sparkles size={14} />THE ART OF THE GAME</div><h1>Play with <em>intention.</em></h1><p className="hero-copy">A refined board for sharp minds. Choose your opponent, settle into a rhythm, and let every move carry weight.</p></div><div className="hero-meta"><div className="hero-meta-label">CURRENT SESSION</div><div className="hero-meta-value">{mode === "ai" ? "Practice match" : mode === "local" ? "Two-player match" : roomCode ? `Room ${getRoomCodeDisplay(roomCode)}` : "Online lobby"}</div><div className="hero-meta-sub">{user ? `Welcome back, ${user.name || "player"}.` : "Play as a guest · sign in to resume"}</div></div></section>

        <div className="mode-tabs" role="tablist">{GAME_MODES.map((item) => <button key={item.value} className={`mode-tab ${mode === item.value ? "active" : ""}`} onClick={() => changeMode(item.value)} role="tab" aria-selected={mode === item.value}>{item.value === "ai" ? <Bot size={17} /> : item.value === "local" ? <Users size={17} /> : item.value === "online" ? <Globe2 size={17} /> : <Swords size={17} />}<span>{item.label}</span><small>{item.value === "puzzle" ? "Solve curated tactical positions" : getModeDescription(item.value)}</small></button>)}</div>

        <div className="game-layout">
          <section className="board-column">
            <div className="player-strip top-player"><div className="player-identity"><div className="avatar avatar-dark">{mode === "ai" ? <Bot size={18} /> : <UserRound size={18} />}</div><div><strong>{mode === "ai" ? "Knight's Gambit" : mode === "online" && roomRole === "host" ? "Opponent" : mode === "puzzle" ? "Tactical line" : "Black"}</strong><span>{mode === "ai" ? "Adaptive engine" : mode === "online" ? roomQuery.data ? getRoomStatusLabel(roomQuery.data.status) : "Waiting for room" : mode === "puzzle" ? "Training position" : "Playing local"}</span></div></div><div className={clockClass("b")} aria-label={`Black clock ${formatClock(clock.b)}`}>{timeControl === "untimed" ? "∞" : formatClock(clock.b)}</div></div>
            <CapturedRow pieces={game.captured.b} pieceSet={preferences.pieceSet} label="White captured" score={scores.white} />
            <div className="board-frame" style={{ "--light-square": boardColors[0], "--dark-square": boardColors[1] } as React.CSSProperties}>
              <div className="board-coordinates board-files">{boardCols("w").map((col) => <span key={col}>{String.fromCharCode(97 + col)}</span>)}</div>
              <div className="board-with-ranks"><div className="board-ranks">{boardRows("w").map((row) => <span key={row}>{8 - row}</span>)}</div><div className="chess-board" aria-label="Interactive chess board">{boardRows("w").flatMap((row) => boardCols("w").map((col) => { const piece = game.board[row][col]; const isSelected = selected?.[0] === row && selected?.[1] === col; const legal = legalTargets.find((move) => move.to[0] === row && move.to[1] === col); const last = game.lastMove && ((game.lastMove.from[0] === row && game.lastMove.from[1] === col) || (game.lastMove.to[0] === row && game.lastMove.to[1] === col)); return <button key={`${row}-${col}`} className={`board-square ${(row + col) % 2 === 0 ? "light" : "dark"} ${isSelected ? "selected" : ""} ${last ? "last-move" : ""} ${legal ? "legal-target" : ""} ${legal?.capture ? "capture-target" : ""}`} onClick={() => handleSquareClick([row, col])} aria-label={`${String.fromCharCode(97 + col)}${8 - row}${piece ? ` ${pieceNameForAria(piece)}` : " empty"}`}>{piece && <PieceGlyph piece={piece} pieceSet={preferences.pieceSet} />}{legal && <span className="target-dot" />}</button>; }))}</div></div>
              <div className="board-coordinates board-ranks-bottom">{boardCols("w").map((col) => <span key={col}>{String.fromCharCode(97 + col)}</span>)}</div>
            </div>
            <CapturedRow pieces={game.captured.w} pieceSet={preferences.pieceSet} label="Black captured" score={scores.black} />
            <div className="player-strip bottom-player"><div className="player-identity"><div className="avatar avatar-light"><UserRound size={18} /></div><div><strong>{mode === "ai" ? (user?.name || "You") : mode === "online" && roomRole === "guest" ? (user?.name || "You") : mode === "puzzle" ? "You · White" : "White"}</strong><span>{mode === "puzzle" ? "Find the forcing move" : game.state.turn === "w" ? "Your turn" : "Waiting for move"}</span></div></div><div className={clockClass("w")} aria-label={`White clock ${formatClock(clock.w)}`}>{timeControl === "untimed" ? "∞" : formatClock(clock.w)}</div></div>
          </section>

          <aside className="side-panel">
            <div className="status-card"><div className="status-card-top"><span className={`status-light status-${statusTone(gameStatus)}`} /> <span className="status-label">{mode === "puzzle" ? "PUZZLE LAB" : thinking ? "ENGINE THINKING" : gameStatus === "playing" ? "IN PLAY" : gameStatus.replace("draw-", "DRAW · ").toUpperCase()}</span><span className="move-count">Move {Math.ceil((game.history.length + 1) / 2)}</span></div><h2>{mode === "puzzle" ? currentPuzzle.title : thinking ? "The engine is weighing the board." : finishedReason || statusLabel(gameStatus, game.state.turn)}</h2><p>{mode === "puzzle" ? currentPuzzle.objective : finishedReason ? "Start a new game when you are ready." : gameStatus === "playing" ? getOpeningHint(game) : gameStatus === "check" ? "Find a safe square for your king." : "This game has reached a conclusion."}</p></div>
            <div className="panel-section"><div className="panel-heading"><span><History size={16} />Move history</span><Badge variant="secondary">{game.history.length}</Badge></div><div className="move-list">{historyRows.length ? historyRows.map((row) => <div className={`move-row ${row.number === Math.ceil(game.history.length / 2) ? "current" : ""}`} key={row.number}><span className="move-number">{row.number}.</span><span>{row.white}</span><span>{row.black}</span></div>) : <div className="empty-history"><Swords size={18} /><span>Your opening move will appear here.</span></div>}</div></div>
            {mode === "online" && <div className="panel-section room-section"><div className="panel-heading"><span><Wifi size={16} />Online room</span><span className={`connection-state ${roomQuery.data?.status === "active" ? "connected" : ""}`}><span className="live-dot" />{roomQuery.data ? getRoomStatusLabel(roomQuery.data.status) : "Not connected"}</span></div><div className="room-form"><Input value={roomCode} onChange={(event) => setRoomCode(normalizeRoomCode(event.target.value))} placeholder="Enter room code" maxLength={8} /><div className="room-actions"><Button onClick={createOnlineRoom} disabled={createRoom.isPending} size="sm"><Sparkles size={15} />Create</Button><Button onClick={joinOnlineRoom} disabled={joinRoom.isPending} variant="outline" size="sm"><ArrowLeftRight size={15} />Join</Button></div>{roomCode && roomRole && <button className="room-code-display" onClick={copyRoomCode}><span>{getRoomCodeDisplay(roomCode)}</span><Copy size={15} /></button>}{roomNotice && <p className="room-notice">{roomNotice}</p>}{!isAuthenticated && <p className="auth-hint">Sign in to create or join persistent rooms.</p>}</div></div>}
            {mode === "puzzle" && <div className="panel-section puzzle-panel"><div className="panel-heading"><span><Swords size={16} />{currentPuzzle.title}</span><Badge variant="secondary">{puzzleSolved ? "Solved" : `${puzzleIndex + 1} / ${PUZZLES.length}`}</Badge></div><p className="puzzle-description">{currentPuzzle.description}</p>{puzzleFeedback && <p className={`puzzle-feedback ${puzzleSolved ? "success" : ""}`}>{puzzleFeedback}</p>}<div className="puzzle-actions"><Button size="sm" onClick={() => startPuzzle(puzzleIndex)}>Retry</Button><Button size="sm" variant="outline" onClick={() => startPuzzle((puzzleIndex + 1) % PUZZLES.length)}>Next puzzle</Button></div></div>}
            <Separator />
            <div className="panel-section compact-controls"><div className="panel-heading"><span><Settings2 size={16} />Game controls</span><button className="text-button" onClick={() => setShowSettings(!showSettings)}>{showSettings ? "Done" : "Customize"}</button></div><div className="control-grid"><Button variant="outline" onClick={resetGame}><RotateCcw size={15} />New game</Button><Button variant="outline" onClick={undoMove} disabled={!snapshots.length || mode === "online"}><Undo2 size={15} />Undo</Button><Button variant="outline" onClick={resign} disabled={isGameOver(game) || !!finishedReason || mode === "puzzle"}><Flag size={15} />Resign</Button><Button variant="outline" onClick={offerDraw} disabled={isGameOver(game) || !!finishedReason || mode === "ai" || mode === "puzzle"}><Handshake size={15} />Offer draw</Button><Button variant="outline" onClick={() => setClockPaused((value) => !value)} disabled={timeControl === "untimed" || mode === "puzzle" || !!finishedReason}>{clockPaused ? "Resume clocks" : "Pause clocks"}</Button></div></div>
            {showSettings && <div className="settings-drawer"><label>Board theme<select value={preferences.boardTheme} onChange={(event) => setPreferences((p: typeof INITIAL_PREFERENCES) => ({ ...p, boardTheme: event.target.value }))}>{boardThemes.map((theme) => <option key={theme.value} value={theme.value}>{theme.label}</option>)}</select></label><label>Piece set<select value={preferences.pieceSet} onChange={(event) => setPreferences((p: typeof INITIAL_PREFERENCES) => ({ ...p, pieceSet: event.target.value }))}>{pieceSets.map((pieceSet) => <option key={pieceSet.value} value={pieceSet.value}>{pieceSet.label}</option>)}</select></label><label>Time control<select value={timeControl} onChange={(event) => setTimeControl(event.target.value as TimeControl)}>{TIME_CONTROLS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="toggle-row"><span>Sound cues</span><input type="checkbox" checked={soundEnabled} onChange={(event) => setSoundEnabled(event.target.checked)} /></label>{mode === "ai" && <label>Engine level<select value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value))}>{difficulties.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}</select></label>}</div>}
            <div className="side-footer"><span><Moon size={14} />Knight's Gambit · Crafted by August</span><button className="icon-button" aria-label="More options"><MoreHorizontal size={18} /></button></div>
          </aside>
        </div>
      </main>

      {promotionMove && <div className="promotion-overlay" role="dialog" aria-modal="true"><div className="promotion-card"><button className="close-promotion" onClick={() => setPromotionMove(null)} aria-label="Cancel promotion"><X size={18} /></button><div className="eyebrow">PAWN PROMOTION</div><h2>Choose your piece</h2><p>Make the final square count.</p><div className="promotion-options">{(["Q", "R", "B", "N"] as PieceType[]).map((type) => <button key={type} onClick={() => applyMove(promotionMove, type)}><PieceGlyph piece={`${game.state.turn}${type}` as Piece} pieceSet={preferences.pieceSet} /><span>{type === "Q" ? "Queen" : type === "R" ? "Rook" : type === "B" ? "Bishop" : "Knight"}</span></button>)}</div></div></div>}
    </div>
  );
}

function pieceNameForAria(piece: Piece) { const names: Record<string, string> = { P: "pawn", N: "knight", B: "bishop", R: "rook", Q: "queen", K: "king" }; return `${colorName(colorOf(piece)!)} ${names[typeOf(piece)!]}`; }
