import { useState, useCallback, useEffect } from "react";
import type { Players, CellValue, GameResult, OnlineConfig } from "./types";
import { subscribeToRoom, updateGameState, backToPicking, deserializeBoard2D } from "./firebase";
import type { GameState } from "./firebase";
import "./ConnectFour.css";

type C4Board = CellValue[][];

const ROWS = 6;
const COLS = 7;
const WIN_LENGTH = 4;

function createEmptyBoard(): C4Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function dropPiece(board: C4Board, col: number, player: CellValue): { newBoard: C4Board; row: number } | null {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === null) {
      const newBoard = board.map((r) => [...r]);
      newBoard[row][col] = player;
      return { newBoard, row };
    }
  }
  return null;
}

type Direction = [number, number];

const DIRECTIONS: Direction[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function checkWinner(board: C4Board): { winner: GameResult; winCells: [number, number][] } {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = board[row][col];
      if (!cell) continue;

      for (const [dr, dc] of DIRECTIONS) {
        const cells: [number, number][] = [[row, col]];
        let valid = true;

        for (let step = 1; step < WIN_LENGTH; step++) {
          const nr = row + dr * step;
          const nc = col + dc * step;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== cell) {
            valid = false;
            break;
          }
          cells.push([nr, nc]);
        }

        if (valid) {
          return { winner: cell, winCells: cells };
        }
      }
    }
  }

  if (board[0].every((cell) => cell !== null)) {
    return { winner: "draw", winCells: [] };
  }

  return { winner: null, winCells: [] };
}

function Confetti() {
  const pieces = Array.from({ length: 50 }, (_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 0.5;
    const duration = 1.5 + Math.random() * 2;
    const colors = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff6eb4", "#a855f7"];
    const color = colors[i % colors.length];
    const rotation = Math.random() * 360;
    const size = 8 + Math.random() * 12;
    return (
      <div
        key={i}
        className="confetti-piece"
        style={{
          left: `${left}%`,
          animationDelay: `${delay}s`,
          animationDuration: `${duration}s`,
          backgroundColor: color,
          transform: `rotate(${rotation}deg)`,
          width: `${size}px`,
          height: `${size * 0.4}px`,
        }}
      />
    );
  });
  return <div className="confetti-container">{pieces}</div>;
}

interface ConnectFourProps {
  players: Players;
  online?: OnlineConfig | null;
  onBack: () => void;
}

function ConnectFour({ players, online, onBack }: ConnectFourProps) {
  const [board, setBoard] = useState<C4Board>(createEmptyBoard);
  const [isP1Turn, setIsP1Turn] = useState(true);
  const [result, setResult] = useState<GameResult>(null);
  const [winCells, setWinCells] = useState<[number, number][]>([]);
  const [score, setScore] = useState({ player1: 0, player2: 0 });
  const [lastDrop, setLastDrop] = useState<[number, number] | null>(null);
  const [hoverCol, setHoverCol] = useState<number | null>(null);

  const getName = (key: "player1" | "player2") => players[key].name;
  const getImage = (key: "player1" | "player2") => players[key].image;

  // --- Online sync ---
  useEffect(() => {
    if (!online) return;

    const unsub = subscribeToRoom(online.roomId, (data) => {
      if (!data || !data.gameState) return;
      const gs = data.gameState as GameState;
      setBoard(deserializeBoard2D(gs.board, ROWS, COLS));
      setIsP1Turn(gs.isP1Turn);
      setResult((gs.result as string) === "" ? null : gs.result);
      setWinCells(normalizeWinCells(gs.winData));
      setScore(gs.score || { player1: 0, player2: 0 });
    });
    return unsub;
  }, [online]);

  const isMyTurn = !online || (isP1Turn && online.myRole === "player1") || (!isP1Turn && online.myRole === "player2");
  const isSpectator = online && online.myRole === "spectator";

  const handleColumnClick = useCallback(
    (col: number) => {
      if (result) return;
      if (isSpectator || (online && !isMyTurn)) return;

      const player: CellValue = isP1Turn ? "player1" : "player2";
      const dropResult = dropPiece(board, col, player);
      if (!dropResult) return;

      const { newBoard, row } = dropResult;

      if (online) {
        const { winner, winCells: wc } = checkWinner(newBoard);
        const newScore = { ...score };
        if (winner === "player1") newScore.player1++;
        if (winner === "player2") newScore.player2++;

        updateGameState(online.roomId, {
          board: newBoard,
          isP1Turn: winner ? isP1Turn : !isP1Turn,
          result: winner,
          winData: wc,
          score: newScore,
        });
      } else {
        setBoard(newBoard);
        setLastDrop([row, col]);
        setTimeout(() => setLastDrop(null), 500);

        const { winner, winCells: wc } = checkWinner(newBoard);
        if (winner) {
          setResult(winner);
          setWinCells(wc);
          if (winner === "player1") setScore((s) => ({ ...s, player1: s.player1 + 1 }));
          if (winner === "player2") setScore((s) => ({ ...s, player2: s.player2 + 1 }));
        } else {
          setIsP1Turn(!isP1Turn);
        }
      }
    },
    [board, isP1Turn, result, online, isMyTurn, isSpectator, score]
  );

  const resetGame = useCallback(() => {
    if (online) {
      updateGameState(online.roomId, {
        board: createEmptyBoard(),
        isP1Turn: result === "player1" ? false : true,
        result: null,
        winData: [],
        score,
      });
    } else {
      setBoard(createEmptyBoard());
      setIsP1Turn(result === "player1" ? false : true);
      setResult(null);
      setWinCells([]);
      setLastDrop(null);
    }
  }, [result, online, score]);

  const handleBack = useCallback(async () => {
    if (online) {
      await backToPicking(online.roomId);
    }
    onBack();
  }, [online, onBack]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") resetGame();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [resetGame]);

  // Online: if room goes back to "picking", navigate back
  useEffect(() => {
    if (!online) return;
    const unsub = subscribeToRoom(online.roomId, (data) => {
      if (data && data.status === "picking") {
        onBack();
      }
    });
    return unsub;
  }, [online, onBack]);

  const getStatusMessage = () => {
    if (result === "player1") return `${getName("player1")} فاز! 🎉`;
    if (result === "player2") return `${getName("player2")} فاز! 🎉`;
    if (result === "draw") return "تعادل! 🤝";
    if (online && !isMyTurn) return `بانتظار ${isP1Turn ? getName("player1") : getName("player2")}...`;
    return isP1Turn ? `دور ${getName("player1")}` : `دور ${getName("player2")}`;
  };

  const isColumnFull = (col: number) => board[0]?.[col] !== null;

  return (
    <div className="game-wrapper c4-wrapper">
      <button className="back-btn" onClick={handleBack}>→ رجوع</button>

      {isSpectator && (
        <div className="spectator-badge">👁️ أنت تشاهد</div>
      )}

      {result && result !== "draw" && <Confetti />}

      <h1 className="game-title">
        <span className="title-p1">{getName("player1")}</span>
        {" ⚡ "}
        <span className="title-p2">{getName("player2")}</span>
      </h1>

      <div className="scoreboard">
        <div className={`score-card ${isP1Turn && !result ? "active-turn" : ""}`}>
          {getImage("player1") && <img src={getImage("player1")} alt={getName("player1")} className="score-avatar" />}
          <span className="score-name">{getName("player1")}</span>
          <span className="score-num">{score.player1}</span>
        </div>
        <div className="score-vs">VS</div>
        <div className={`score-card ${!isP1Turn && !result ? "active-turn" : ""}`}>
          {getImage("player2") && <img src={getImage("player2")} alt={getName("player2")} className="score-avatar" />}
          <span className="score-name">{getName("player2")}</span>
          <span className="score-num">{score.player2}</span>
        </div>
      </div>

      <div className={`status-bar ${result ? "status-result" : ""}`}>
        {getStatusMessage()}
      </div>

      {/* Column hover indicators */}
      <div className="c4-indicators">
        {Array.from({ length: COLS }, (_, col) => (
          <div
            key={col}
            className={`c4-indicator ${hoverCol === col && !result && isMyTurn && !isColumnFull(col) ? "visible" : ""}`}
          >
            {getImage(isP1Turn ? "player1" : "player2") && (
              <img
                src={getImage(isP1Turn ? "player1" : "player2")}
                alt="preview"
                className="c4-preview-img"
              />
            )}
          </div>
        ))}
      </div>

      {/* The 6x7 grid */}
      <div className="c4-board">
        {board.map((row, ri) =>
          row.map((cell, ci) => {
            const isWinCell = winCells.some(([wr, wc]) => wr === ri && wc === ci);
            const isLastDrop = lastDrop?.[0] === ri && lastDrop?.[1] === ci;
            return (
              <div
                key={`${ri}-${ci}`}
                className={`c4-cell ${cell ? "filled" : "empty"} ${isWinCell ? "c4-win" : ""} ${isLastDrop ? "drop-anim" : ""}`}
                onClick={() => handleColumnClick(ci)}
                onMouseEnter={() => setHoverCol(ci)}
                onMouseLeave={() => setHoverCol(null)}
              >
                {cell && getImage(cell) && (
                  <img
                    src={getImage(cell)}
                    alt={getName(cell)}
                    className="c4-cell-img"
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {result && (
        <div className="result-area">
          {result !== "draw" && getImage(result) && (
            <img
              src={getImage(result)}
              alt="Winner"
              className="winner-img"
            />
          )}
          {!isSpectator && (
            <button className="play-again-btn" onClick={resetGame}>
              العب مرة أخرى!
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function normalizeWinCells(raw: unknown): [number, number][] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((item) => {
      if (Array.isArray(item)) return item as [number, number];
      if (item && typeof item === "object") {
        const obj = item as Record<string, number>;
        return [obj["0"], obj["1"]] as [number, number];
      }
      return [0, 0] as [number, number];
    });
  }
  return [];
}

export default ConnectFour;
