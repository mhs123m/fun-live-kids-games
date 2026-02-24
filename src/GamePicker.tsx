import { useEffect, useState } from "react";
import type { Players, OnlineConfig } from "./types";
import { setCurrentGame, subscribeToRoom, setVote } from "./firebase";
import type { GameState, MathGameState } from "./firebase";
import "./GamePicker.css";

type GameType = "xo" | "connect4" | "math";

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

const MATH_INITIAL_STATE: MathGameState = {
  round: 1,
  phase: "level-select",
  level: "",
  asker: "player1",
  question: "",
  correctAnswer: "",
  givenAnswer: "",
  score: { player1: 0, player2: 0 },
};

function GamePicker({ players, online, onSelectGame, onBack }: GamePickerProps) {
  const isGuest = online && online.myRole === "player2";
  const isSpectator = online && online.myRole === "spectator";
  const [myVote, setMyVote] = useState<"xo" | "connect4" | "math" | null>(null);
  const [hostVote, setHostVote] = useState<"xo" | "connect4" | "math" | null>(null);

  // Subscribe to room for voting updates and game start
  useEffect(() => {
    if (!online) return;

    const unsub = subscribeToRoom(online.roomId, (data) => {
      if (!data) return;
      
      // If game started, navigate to it
      if (data.status === "playing" && data.currentGame) {
        onSelectGame(data.currentGame);
        return;
      }

      // Update votes from room data (not for spectators)
      if (!isSpectator && data.votes) {
        if (online.myRole === "player1") {
          setMyVote(data.votes.player1 || null);
          setHostVote(data.votes.player1 || null);
        } else {
          setMyVote(data.votes.player2 || null);
          setHostVote(data.votes.player1 || null);
        }
      }
    });
    return unsub;
  }, [online, onSelectGame, isSpectator]);

  const handlePick = async (game: GameType) => {
    if (isGuest) return;

    if (online) {
      const initial = game === "xo" ? XO_INITIAL_STATE : game === "connect4" ? C4_INITIAL_STATE : MATH_INITIAL_STATE;
      await setCurrentGame(online.roomId, game, initial);
    }
    onSelectGame(game);
  };

  const handleVote = async (game: GameType) => {
    if (!online || isSpectator) return;
    await setVote(online.roomId, online.myRole, game);
  };

  return (
    <div className="picker-wrapper">
      <button className="back-btn" onClick={onBack}>→ رجوع</button>

      <h1 className="game-title">
        <span className="title-p1">{players.player1.name}</span>
        {" ⚡ "}
        <span className="title-p2">{players.player2.name}</span>
      </h1>

      {isSpectator ? (
        <div className="picker-spectator">
          <p className="picker-subtitle">أنت تشاهد اللعبة</p>
          <div className="waiting-dots">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
          <p className="picker-spectator-hint">بانتظار {players.player1.name} لاختيار اللعبة...</p>
        </div>
      ) : online && isGuest ? (
        <div className="picker-voting">
          <p className="picker-subtitle">صوّت للعبة التي تريد لعبها!</p>
          
          {hostVote && (
            <p className="picker-host-vote">
              <span className="host-vote-label">{players.player1.name} صوّت لـ:</span>
              <span className="host-vote-game">
                {hostVote === "xo" ? "إكس أو" : hostVote === "connect4" ? "أربطة أربعة" : "اختبار رياضيات"}
              </span>
            </p>
          )}

          <div className="picker-grid">
            <button 
              className={`picker-card ${myVote === "xo" ? "picker-voted" : ""}`} 
              onClick={() => handleVote("xo")}
            >
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
              <span className="picker-name">إكس أو</span>
              <span className="picker-desc">الشبكة الكلاسيكية</span>
              {myVote === "xo" && <span className="vote-badge">✓ صوتك</span>}
            </button>

            <button 
              className={`picker-card ${myVote === "connect4" ? "picker-voted" : ""}`} 
              onClick={() => handleVote("connect4")}
            >
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
              <span className="picker-name">أربطة أربعة</span>
              <span className="picker-desc">صنع أربعة متصلة!</span>
              {myVote === "connect4" && <span className="vote-badge">✓ صوتك</span>}
            </button>

            <button 
              className={`picker-card ${myVote === "math" ? "picker-voted" : ""}`} 
              onClick={() => handleVote("math")}
            >
              <div className="picker-preview math-preview">
                <span className="math-symbol">+</span>
                <span className="math-symbol">−</span>
                <span className="math-symbol">×</span>
                <span className="math-symbol">÷</span>
              </div>
              <span className="picker-name">اختبار رياضيات</span>
              <span className="picker-desc">اسأل وأجب!</span>
              {myVote === "math" && <span className="vote-badge">✓ صوتك</span>}
            </button>
          </div>

          <p className="picker-waiting-host">بانتظار {players.player1.name} لاختيار اللعبة...</p>
        </div>
      ) : online && !isGuest ? (
        <>
          <p className="picker-subtitle">اختر لعبة للبدء!</p>

          {myVote && (
            <p className="picker-guest-vote">
              <span className="guest-vote-label">{players.player2.name} صوّت لـ:</span>
              <span className="guest-vote-game">
                {myVote === "xo" ? "إكس أو" : myVote === "connect4" ? "أربطة أربعة" : "اختبار رياضيات"}
              </span>
            </p>
          )}

          <div className="picker-grid">
            <button className={`picker-card ${myVote === "xo" ? "guest-voted-xo" : ""}`} onClick={() => handlePick("xo")}>
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
              <span className="picker-name">إكس أو</span>
              <span className="picker-desc">الشبكة الكلاسيكية</span>
              {myVote === "xo" && <span className="guest-vote-indicator">🗳️ صوت صديقك</span>}
            </button>

            <button className={`picker-card ${myVote === "connect4" ? "guest-voted-connect4" : ""}`} onClick={() => handlePick("connect4")}>
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
              <span className="picker-name">أربطة أربعة</span>
              <span className="picker-desc">صنع أربعة متصلة!</span>
              {myVote === "connect4" && <span className="guest-vote-indicator">🗳️ صوت صديقك</span>}
            </button>

            <button className={`picker-card ${myVote === "math" ? "guest-voted-math" : ""}`} onClick={() => handlePick("math")}>
              <div className="picker-preview math-preview">
                <span className="math-symbol">+</span>
                <span className="math-symbol">−</span>
                <span className="math-symbol">×</span>
                <span className="math-symbol">÷</span>
              </div>
              <span className="picker-name">اختبار رياضيات</span>
              <span className="picker-desc">اسأل وأجب!</span>
              {myVote === "math" && <span className="guest-vote-indicator">🗳️ صوت صديقك</span>}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="picker-subtitle">اختر لعبة!</p>

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
              <span className="picker-name">إكس أو</span>
              <span className="picker-desc">الشبكة الكلاسيكية</span>
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
              <span className="picker-name">أربطة أربعة</span>
              <span className="picker-desc">صنع أربعة متصلة!</span>
            </button>

            <button className="picker-card" onClick={() => handlePick("math")}>
              <div className="picker-preview math-preview">
                <span className="math-symbol">+</span>
                <span className="math-symbol">−</span>
                <span className="math-symbol">×</span>
                <span className="math-symbol">÷</span>
              </div>
              <span className="picker-name">اختبار رياضيات</span>
              <span className="picker-desc">اسأل وأجب!</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default GamePicker;
