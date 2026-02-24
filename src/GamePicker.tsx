import { useEffect } from "react";
import type { Players, OnlineConfig } from "./types";
import { setCurrentGame, subscribeToRoom } from "./firebase";
import type { GameState } from "./firebase";
import "./GamePicker.css";

type GameType = "xo" | "connect4";

interface GamePickerProps {
  players: Players;
  online?: OnlineConfig | null;
  onSelectGame: (game: GameType) => void;
  onBack: () => void;
}

const XO_INITIAL_STATE: GameState = {
  board: Array(9).fill(null),
  isP1Turn: true,
  result: null,
  winData: [],
  score: { player1: 0, player2: 0 },
};

const C4_INITIAL_STATE: GameState = {
  board: Array.from({ length: 6 }, () => Array(7).fill(null)),
  isP1Turn: true,
  result: null,
  winData: [],
  score: { player1: 0, player2: 0 },
};

function GamePicker({ players, online, onSelectGame, onBack }: GamePickerProps) {
  const isGuest = online && online.myRole === "player2";

  // Guest subscribes to room to detect when host picks a game
  useEffect(() => {
    if (!online || !isGuest) return;

    const unsub = subscribeToRoom(online.roomId, (data) => {
      if (data && data.status === "playing" && data.currentGame) {
        onSelectGame(data.currentGame);
      }
    });
    return unsub;
  }, [online, isGuest, onSelectGame]);

  const handlePick = async (game: GameType) => {
    if (isGuest) return;

    if (online) {
      const initial = game === "xo" ? XO_INITIAL_STATE : C4_INITIAL_STATE;
      await setCurrentGame(online.roomId, game, initial);
    }
    onSelectGame(game);
  };

  return (
    <div className="picker-wrapper">
      <button className="back-btn" onClick={onBack}>← Back</button>

      <h1 className="game-title">
        <span className="title-p1">{players.player1.name}</span>
        {" ⚡ "}
        <span className="title-p2">{players.player2.name}</span>
      </h1>

      {isGuest ? (
        <div className="picker-waiting">
          <p className="picker-subtitle">Waiting for host to pick a game...</p>
          <div className="waiting-dots">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        </div>
      ) : (
        <>
          <p className="picker-subtitle">Choose a game!</p>

          <div className="picker-grid">
            <button className="picker-card" onClick={() => handlePick("xo")}>
              <div className="picker-preview xo-preview">
                {Array.from({ length: 9 }, (_, i) => (
                  <div
                    key={i}
                    className={`mini-cell ${
                      [0, 2, 4, 6, 8].includes(i) ? "mini-p1" : [1, 3, 5].includes(i) ? "mini-p2" : ""
                    }`}
                  />
                ))}
              </div>
              <span className="picker-name">Tic Tac Toe</span>
              <span className="picker-desc">Classic 3x3 grid</span>
            </button>

            <button className="picker-card" onClick={() => handlePick("connect4")}>
              <div className="picker-preview c4-preview">
                {Array.from({ length: 42 }, (_, i) => {
                  const row = Math.floor(i / 7);
                  const col = i % 7;
                  const isP1 =
                    (row === 5 && [2, 3, 4].includes(col)) ||
                    (row === 4 && col === 3) ||
                    (row === 3 && col === 3);
                  const isP2 =
                    (row === 5 && [1, 5].includes(col)) ||
                    (row === 4 && [2, 4].includes(col));
                  return (
                    <div
                      key={i}
                      className={`mini-cell ${isP1 ? "mini-p1" : isP2 ? "mini-p2" : ""}`}
                    />
                  );
                })}
              </div>
              <span className="picker-name">Connect Four</span>
              <span className="picker-desc">Drop 4 in a row!</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default GamePicker;
