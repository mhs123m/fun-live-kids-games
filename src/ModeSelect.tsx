import "./ModeSelect.css";

interface ModeSelectProps {
  onSelectMode: (mode: "local" | "online") => void;
}

function ModeSelect({ onSelectMode }: ModeSelectProps) {
  return (
    <div className="mode-wrapper">
      <h1 className="mode-title">Game Arena</h1>
      <p className="mode-subtitle">How do you want to play?</p>

      <div className="mode-grid">
        <button className="mode-card" onClick={() => onSelectMode("local")}>
          <div className="mode-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <span className="mode-name">Local</span>
          <span className="mode-desc">Play on this device</span>
        </button>

        <button className="mode-card" onClick={() => onSelectMode("online")}>
          <div className="mode-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <span className="mode-name">Online</span>
          <span className="mode-desc">Play with a friend</span>
        </button>
      </div>
    </div>
  );
}

export default ModeSelect;
