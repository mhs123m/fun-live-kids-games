import { useState, useCallback, useEffect } from "react";
import type { Players, CellValue, GameResult, OnlineConfig } from "./types";
import { subscribeToRoom, updateGameState, backToPicking, deserializeBoard1D } from "./firebase";
import type { GameState } from "./firebase";
import "./XOGame.css";

type Board = CellValue[];

const WIN_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkWinner(board: Board): { winner: GameResult; line: number[] } {
  for (const combo of WIN_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: combo };
    }
  }
  if (board.every((cell) => cell !== null)) {
    return { winner: "draw", line: [] };
  }
  return { winner: null, line: [] };
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

interface XOGameProps {
  players: Players;
  online?: OnlineConfig | null;
  onBack: () => void;
}

function XOGame({ players, online, onBack }: XOGameProps) {
  // --- Local state ---
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [isP1Turn, setIsP1Turn] = useState(true);
  const [result, setResult] = useState<GameResult>(null);
  const [winLine, setWinLine] = useState<number[]>([]);
  const [score, setScore] = useState({ player1: 0, player2: 0 });
  const [bounceCell, setBounceCell] = useState<number | null>(null);

  const getName = (key: "player1" | "player2") => players[key].name;
  const getImage = (key: "player1" | "player2") => players[key].image;

  // --- Online sync: subscribe to Firebase ---
  useEffect(() => {
    if (!online) return;

    const unsub = subscribeToRoom(online.roomId, (data) => {
      if (!data || !data.gameState) return;
      const gs = data.gameState as GameState;
      setBoard(deserializeBoard1D(gs.board));
      setIsP1Turn(gs.isP1Turn);
      setResult((gs.result as string) === "" ? null : gs.result);
      setWinLine((gs.winData || []) as number[]);
      setScore(gs.score || { player1: 0, player2: 0 });
    });
    return unsub;
  }, [online]);

  const isMyTurn = !online || (isP1Turn && online.myRole === "player1") || (!isP1Turn && online.myRole === "player2");

  const handleClick = useCallback(
    (index: number) => {
      if (board[index] || result) return;
      if (online && !isMyTurn) return;

      const newBoard = [...board];
      newBoard[index] = isP1Turn ? "player1" : "player2";

      if (online) {
        // Write to Firebase — subscription will update local state
        const { winner, line } = checkWinner(newBoard);
        const newScore = { ...score };
        if (winner === "player1") newScore.player1++;
        if (winner === "player2") newScore.player2++;

        updateGameState(online.roomId, {
          board: newBoard,
          isP1Turn: winner ? isP1Turn : !isP1Turn,
          result: winner,
          winData: line,
          score: newScore,
        });
      } else {
        // Local mode
        setBoard(newBoard);
        setBounceCell(index);
        setTimeout(() => setBounceCell(null), 500);

        const { winner, line } = checkWinner(newBoard);
        if (winner) {
          setResult(winner);
          setWinLine(line);
          if (winner === "player1") setScore((s) => ({ ...s, player1: s.player1 + 1 }));
          if (winner === "player2") setScore((s) => ({ ...s, player2: s.player2 + 1 }));
        } else {
          setIsP1Turn(!isP1Turn);
        }
      }
    },
    [board, isP1Turn, result, online, isMyTurn, score]
  );

  const resetGame = useCallback(() => {
    if (online) {
      updateGameState(online.roomId, {
        board: Array(9).fill(null),
        isP1Turn: result === "player1" ? false : true,
        result: null,
        winData: [],
        score,
      });
    } else {
      setBoard(Array(9).fill(null));
      setIsP1Turn(result === "player1" ? false : true);
      setResult(null);
      setWinLine([]);
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
    if (result === "player1") return `${getName("player1")} Wins! 🎉`;
    if (result === "player2") return `${getName("player2")} Wins! 🎉`;
    if (result === "draw") return "It's a Draw! 🤝";
    if (online && !isMyTurn) return `Waiting for ${isP1Turn ? getName("player1") : getName("player2")}...`;
    return isP1Turn ? `${getName("player1")}'s Turn` : `${getName("player2")}'s Turn`;
  };

  return (
    <div className="game-wrapper">
      <button className="back-btn" onClick={handleBack}>← Back</button>

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

      <div className="xo-board">
        {board.map((cell, index) => (
          <button
            key={index}
            className={`cell
              ${cell ? "filled" : "empty"}
              ${winLine.includes(index) ? "win-cell" : ""}
              ${bounceCell === index ? "bounce" : ""}
            `}
            onClick={() => handleClick(index)}
            disabled={!!cell || !!result || (!!online && !isMyTurn)}
          >
            {cell && getImage(cell) && (
              <img
                src={getImage(cell)}
                alt={getName(cell)}
                className="cell-img"
              />
            )}
          </button>
        ))}
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
          <button className="play-again-btn" onClick={resetGame}>
            Play Again!
          </button>
        </div>
      )}
    </div>
  );
}

export default XOGame;
