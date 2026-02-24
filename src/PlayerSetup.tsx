import { useRef, useState } from "react";
import type { Players } from "./types";
import { compressImage } from "./firebase";
import "./PlayerSetup.css";

interface PlayerSetupProps {
  onReady: (players: Players) => void;
  onBack: () => void;
}

function PlayerSetup({ onReady, onBack }: PlayerSetupProps) {
  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");
  const [image1, setImage1] = useState<string | null>(null);
  const [image2, setImage2] = useState<string | null>(null);
  const fileRef1 = useRef<HTMLInputElement>(null);
  const fileRef2 = useRef<HTMLInputElement>(null);

  const handleImage = (player: 1 | 2) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    if (player === 1) setImage1(compressed);
    else setImage2(compressed);
  };

  const canStart = name1.trim().length > 0 && name2.trim().length > 0;

  const handleStart = () => {
    if (!canStart) return;
    onReady({
      player1: { name: name1.trim(), image: image1 || "/default-p1.png" },
      player2: { name: name2.trim(), image: image2 || "/default-p2.png" },
    });
  };

  return (
    <div className="setup-wrapper">
      <button className="back-btn" onClick={onBack}>→ رجوع</button>
      <h1 className="setup-title">ساحة الألعاب</h1>
      <p className="setup-subtitle">مين يلعب اليوم؟</p>

      <div className="setup-players">
        {/* Player 1 */}
        <div className="setup-card">
          <div
            className="setup-avatar-area"
            onClick={() => fileRef1.current?.click()}
          >
            {image1 ? (
              <img src={image1} alt="Player 1" className="setup-avatar-img" />
            ) : (
              <div className="setup-avatar-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            )}
            <input
              ref={fileRef1}
              type="file"
              accept="image/*"
              onChange={handleImage(1)}
              className="setup-file-input"
            />
          </div>
          <input
            type="text"
            placeholder="اسم اللاعب ١"
            value={name1}
            onChange={(e) => setName1(e.target.value)}
            className="setup-name-input p1-input"
            maxLength={12}
          />
        </div>

        <div className="setup-vs">VS</div>

        {/* Player 2 */}
        <div className="setup-card">
          <div
            className="setup-avatar-area"
            onClick={() => fileRef2.current?.click()}
          >
            {image2 ? (
              <img src={image2} alt="Player 2" className="setup-avatar-img" />
            ) : (
              <div className="setup-avatar-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            )}
            <input
              ref={fileRef2}
              type="file"
              accept="image/*"
              onChange={handleImage(2)}
              className="setup-file-input"
            />
          </div>
          <input
            type="text"
            placeholder="اسم اللاعب ٢"
            value={name2}
            onChange={(e) => setName2(e.target.value)}
            className="setup-name-input p2-input"
            maxLength={12}
          />
        </div>
      </div>

      <button
        className={`setup-start-btn ${canStart ? "" : "disabled"}`}
        onClick={handleStart}
        disabled={!canStart}
      >
        يلا نلعب!
      </button>
    </div>
  );
}

export default PlayerSetup;
