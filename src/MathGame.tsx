import { useState, useCallback, useEffect } from "react";
import type { Players, OnlineConfig } from "./types";
import { subscribeToRoom, updateGameState, backToPicking } from "./firebase";
import type { MathGameState, MathLevel } from "./firebase";
import "./MathGame.css";

const TOTAL_ROUNDS = 5;

function getInitialState(): MathGameState {
  return {
    round: 1,
    phase: "level-select",
    level: "",
    asker: "player1",
    question: "",
    correctAnswer: "",
    givenAnswer: "",
    score: { player1: 0, player2: 0 },
  };
}

function getAnswerer(asker: "player1" | "player2"): "player1" | "player2" {
  return asker === "player1" ? "player2" : "player1";
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

interface MathGameProps {
  players: Players;
  online?: OnlineConfig | null;
  onBack: () => void;
}

type Op = "+" | "−" | "×" | "÷";
const PRESCHOOL_OPS: Op[] = ["+", "−"];
const JUNIORS_OPS: Op[] = ["+", "−", "×", "÷"];

function computeAnswer(a: number, op: Op, b: number): string {
  switch (op) {
    case "+": return String(a + b);
    case "−": return String(a - b);
    case "×": return String(a * b);
    case "÷": return b === 0 ? "0" : String(a / b);
  }
}

function formatQuestion(a: string, op: Op, b: string): string {
  return `${a} ${op} ${b}`;
}

function MathGame({ players, online, onBack }: MathGameProps) {
  const [state, setState] = useState<MathGameState>(getInitialState);
  const [num1, setNum1] = useState("");
  const [num2, setNum2] = useState("");
  const [op, setOp] = useState<Op | null>(null);
  const [playerAnswer, setPlayerAnswer] = useState("");

  const getName = (key: "player1" | "player2") => players[key].name;
  const getImage = (key: "player1" | "player2") => players[key].image;

  // Online sync
  useEffect(() => {
    if (!online) return;
    const unsub = subscribeToRoom(online.roomId, (data) => {
      if (!data || !data.gameState) return;
      const gs = data.gameState as unknown as MathGameState;
      setState(gs);
    });
    return unsub;
  }, [online]);

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

  const writeState = useCallback(
    (newState: MathGameState) => {
      if (online) {
        updateGameState(online.roomId, newState);
      } else {
        setState(newState);
      }
    },
    [online]
  );

  const availableOps = state.level === "preschool" ? PRESCHOOL_OPS : JUNIORS_OPS;

  const handleSelectLevel = (level: MathLevel) => {
    writeState({ ...state, level, phase: "asking" });
  };

  const canSubmitQuestion = num1.trim() !== "" && num2.trim() !== "" && op !== null && !isNaN(Number(num1)) && !isNaN(Number(num2));

  const handleSubmitQuestion = () => {
    if (!canSubmitQuestion || op === null) return;
    const question = formatQuestion(num1.trim(), op, num2.trim());
    const answer = computeAnswer(Number(num1), op, Number(num2));
    const newState: MathGameState = {
      ...state,
      question,
      correctAnswer: answer,
      phase: online ? "answering" : "pass",
    };
    writeState(newState);
    setNum1("");
    setNum2("");
    setOp(null);
  };

  const handlePassDevice = () => {
    writeState({ ...state, phase: "answering" });
  };

  const handleSubmitAnswer = () => {
    if (!playerAnswer.trim()) return;
    const given = playerAnswer.trim();
    const isCorrect = given === state.correctAnswer;
    const answerer = getAnswerer(state.asker);
    const newScore = { ...state.score };
    if (isCorrect) {
      newScore[answerer]++;
    }
    const newState: MathGameState = {
      ...state,
      givenAnswer: given,
      score: newScore,
      phase: "reveal",
    };
    writeState(newState);
    setPlayerAnswer("");
  };

  const handleNextRound = () => {
    if (state.round >= TOTAL_ROUNDS) {
      writeState({ ...state, phase: "done" });
    } else {
      const nextAsker = getAnswerer(state.asker);
      writeState({
        ...state,
        round: state.round + 1,
        phase: online ? "asking" : "asking",
        asker: nextAsker,
        question: "",
        correctAnswer: "",
        givenAnswer: "",
      });
    }
  };

  const handlePlayAgain = () => {
    writeState(getInitialState());
  };

  const handleBack = useCallback(async () => {
    if (online) {
      await backToPicking(online.roomId);
    }
    onBack();
  }, [online, onBack]);

  // Determine if current player is the asker (online mode)
  const amIAsker = !online || online.myRole === state.asker;
  const amIAnswerer = !online || online.myRole === getAnswerer(state.asker);

  const askerName = getName(state.asker);
  const answererName = getName(getAnswerer(state.asker));

  // Determine winner at done phase
  const getWinner = () => {
    if (state.score.player1 > state.score.player2) return "player1";
    if (state.score.player2 > state.score.player1) return "player2";
    return "draw";
  };

  return (
    <div className="game-wrapper math-wrapper">
      <button className="back-btn" onClick={handleBack}>→ رجوع</button>

      {state.phase === "done" && getWinner() !== "draw" && <Confetti />}

      <h1 className="game-title">
        <span className="title-p1">{getName("player1")}</span>
        {" ⚡ "}
        <span className="title-p2">{getName("player2")}</span>
      </h1>

      <div className="scoreboard">
        <div className={`score-card ${state.asker === "player1" && state.phase !== "done" ? "active-turn" : ""}`}>
          {getImage("player1") && <img src={getImage("player1")} alt={getName("player1")} className="score-avatar" />}
          <span className="score-name">{getName("player1")}</span>
          <span className="score-num">{state.score.player1}</span>
        </div>
        <div className="score-vs">VS</div>
        <div className={`score-card ${state.asker === "player2" && state.phase !== "done" ? "active-turn" : ""}`}>
          {getImage("player2") && <img src={getImage("player2")} alt={getName("player2")} className="score-avatar" />}
          <span className="score-name">{getName("player2")}</span>
          <span className="score-num">{state.score.player2}</span>
        </div>
      </div>

      {/* Round progress */}
      {state.phase !== "done" && (
        <div className="math-round-progress">
          {Array.from({ length: TOTAL_ROUNDS }, (_, i) => (
            <div
              key={i}
              className={`round-dot ${i + 1 < state.round ? "round-done" : ""} ${i + 1 === state.round ? "round-current" : ""}`}
            />
          ))}
        </div>
      )}

      {/* --- LEVEL SELECT PHASE --- */}
      {state.phase === "level-select" && (
        <>
          {(!online || online.myRole === "player1") ? (
            <div className="math-phase-card">
              <h2 className="math-phase-title">اختر مستوى!</h2>
              <div className="math-level-grid">
                <button className="math-level-card" onClick={() => handleSelectLevel("preschool")}>
                  <span className="math-level-emoji">🧒</span>
                  <span className="math-level-name">روضة</span>
                  <span className="math-level-ops">+ −</span>
                </button>
                <button className="math-level-card" onClick={() => handleSelectLevel("juniors")}>
                  <span className="math-level-emoji">🧑‍🎓</span>
                  <span className="math-level-name">ابتدائي</span>
                  <span className="math-level-ops">+ − × ÷</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="math-phase-card math-waiting">
              <h2 className="math-phase-title">اختيار المستوى...</h2>
              <p className="math-phase-hint">{getName("player1")} يختار الصعوبة</p>
              <div className="waiting-dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          )}
        </>
      )}

      {/* --- ASKING PHASE --- */}
      {state.phase === "asking" && (
        <>
          {(!online || amIAsker) ? (
            <div className="math-phase-card">
              <h2 className="math-phase-title">{askerName}، اطرح سؤال!</h2>
              <p className="math-phase-hint">اصنع سؤالاً لـ {answererName}</p>

              <div className="math-builder">
                <input
                  type="number"
                  className="math-num-input"
                  placeholder="?"
                  value={num1}
                  onChange={(e) => setNum1(e.target.value)}
                  autoFocus
                />
                <div className={`math-op-buttons ${availableOps.length === 2 ? "math-op-2" : ""}`}>
                  {availableOps.map((o) => (
                    <button
                      key={o}
                      className={`math-op-btn ${op === o ? "math-op-active" : ""}`}
                      onClick={() => setOp(o)}
                    >
                      {o}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  className="math-num-input"
                  placeholder="?"
                  value={num2}
                  onChange={(e) => setNum2(e.target.value)}
                />
              </div>

              {canSubmitQuestion && (
                <div className="math-preview-eq">
                  {formatQuestion(num1.trim(), op!, num2.trim())} = ?
                </div>
              )}

              <button
                className={`math-submit-btn ${!canSubmitQuestion ? "disabled" : ""}`}
                onClick={handleSubmitQuestion}
                disabled={!canSubmitQuestion}
              >
                إرسال السؤال
              </button>
            </div>
          ) : (
            <div className="math-phase-card math-waiting">
              <h2 className="math-phase-title">الجولة {state.round}</h2>
              <p className="math-phase-hint">{askerName} يكتب سؤالاً...</p>
              <div className="waiting-dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          )}
        </>
      )}

      {/* --- PASS PHASE (local only) --- */}
      {state.phase === "pass" && !online && (
        <div className="math-phase-card math-pass">
          <h2 className="math-phase-title">مرر الجهاز!</h2>
          <p className="math-phase-hint">أعط الجهاز لـ <strong>{answererName}</strong></p>
          <button className="math-submit-btn" onClick={handlePassDevice}>
            أنا {answererName}، جاهز!
          </button>
        </div>
      )}

      {/* --- ANSWERING PHASE --- */}
      {state.phase === "answering" && (
        <>
          {(!online || amIAnswerer) ? (
            <div className="math-phase-card">
              <h2 className="math-phase-title">{answererName}، دورك!</h2>
              <div className="math-question-display">{state.question}</div>
              <input
                type="number"
                className="math-input"
                placeholder="إجابتك"
                value={playerAnswer}
                onChange={(e) => setPlayerAnswer(e.target.value)}
                autoFocus
              />
              <button
                className={`math-submit-btn ${!playerAnswer.trim() ? "disabled" : ""}`}
                onClick={handleSubmitAnswer}
                disabled={!playerAnswer.trim()}
              >
                إرسال الإجابة
              </button>
            </div>
          ) : (
            <div className="math-phase-card math-waiting">
              <h2 className="math-phase-title">{state.question}</h2>
              <p className="math-phase-hint">{answererName} يفكر...</p>
              <div className="waiting-dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          )}
        </>
      )}

      {/* --- REVEAL PHASE --- */}
      {state.phase === "reveal" && (
        <div className="math-phase-card">
          <div className="math-question-display">{state.question}</div>
          <div className={`math-reveal ${state.givenAnswer === state.correctAnswer ? "math-correct" : "math-wrong"}`}>
            {state.givenAnswer === state.correctAnswer ? (
              <>
                <span className="math-reveal-icon">&#10003;</span>
                <span>صحيح! الإجابة هي {state.correctAnswer}</span>
              </>
            ) : (
              <>
                <span className="math-reveal-icon">&#10007;</span>
                <span>{answererName} قال {state.givenAnswer} — الإجابة كانت {state.correctAnswer}</span>
              </>
            )}
          </div>
          <button className="math-submit-btn" onClick={handleNextRound}>
            {state.round >= TOTAL_ROUNDS ? "عرض النتائج" : "الجولة التالية"}
          </button>
        </div>
      )}

      {/* --- DONE PHASE --- */}
      {state.phase === "done" && (
        <div className="result-area">
          {getWinner() === "draw" ? (
            <div className={`status-bar status-result`}>تعادل! 🤝</div>
          ) : (
            <>
              <div className={`status-bar status-result`}>{getName(getWinner() as "player1" | "player2")} فاز! 🎉</div>
              {getImage(getWinner() as "player1" | "player2") && (
                <img
                  src={getImage(getWinner() as "player1" | "player2")}
                  alt="Winner"
                  className="winner-img"
                />
              )}
            </>
          )}
          <div className="math-final-score">
            {getName("player1")}: {state.score.player1} — {getName("player2")}: {state.score.player2}
          </div>
          <button className="play-again-btn" onClick={handlePlayAgain}>
            العب مرة أخرى!
          </button>
        </div>
      )}
    </div>
  );
}

export default MathGame;
