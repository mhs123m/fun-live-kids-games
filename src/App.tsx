import { useCallback, useEffect, useState } from "react";
import type { Players, OnlineConfig } from "./types";
import ModeSelect from "./ModeSelect";
import PlayerSetup from "./PlayerSetup";
import OnlineSetup from "./OnlineSetup";
import GamePicker from "./GamePicker";
import XOGame from "./XOGame";
import ConnectFour from "./ConnectFour";
import MathGame from "./MathGame";
import "./App.css";

type Screen = "mode" | "local-setup" | "online-setup" | "picker" | "xo" | "connect4" | "math";

function getRoomIdFromHash(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/^#room=(.+)$/);
  return match ? match[1] : null;
}

function App() {
  const [screen, setScreen] = useState<Screen>("mode");
  const [players, setPlayers] = useState<Players | null>(null);
  const [online, setOnline] = useState<OnlineConfig | null>(null);

  // Check URL hash on mount for room links
  useEffect(() => {
    const roomId = getRoomIdFromHash();
    if (roomId) {
      setScreen("online-setup");
    }
  }, []);

  const handleModeSelect = (mode: "local" | "online") => {
    if (mode === "local") {
      setScreen("local-setup");
    } else {
      setScreen("online-setup");
    }
  };

  const handleLocalReady = (p: Players) => {
    setPlayers(p);
    setOnline(null);
    setScreen("picker");
  };

  const handleOnlineReady = useCallback((p: Players, roomId: string, myRole: "player1" | "player2") => {
    setPlayers(p);
    setOnline({ roomId, myRole });
    setScreen("picker");
  }, []);

  const handleBackToMode = () => {
    window.location.hash = "";
    setPlayers(null);
    setOnline(null);
    setScreen("mode");
  };

  const handleBackToPicker = () => {
    setScreen("picker");
  };

  return (
    <>
      {screen === "mode" && (
        <ModeSelect onSelectMode={handleModeSelect} />
      )}

      {screen === "local-setup" && (
        <PlayerSetup onReady={handleLocalReady} onBack={handleBackToMode} />
      )}

      {screen === "online-setup" && (
        <OnlineSetup
          initialRoomId={getRoomIdFromHash()}
          onReady={handleOnlineReady}
          onBack={handleBackToMode}
        />
      )}

      {screen === "picker" && players && (
        <GamePicker
          players={players}
          online={online}
          onSelectGame={(game) => setScreen(game)}
          onBack={handleBackToMode}
        />
      )}

      {screen === "xo" && players && (
        <XOGame
          players={players}
          online={online}
          onBack={handleBackToPicker}
        />
      )}

      {screen === "connect4" && players && (
        <ConnectFour
          players={players}
          online={online}
          onBack={handleBackToPicker}
        />
      )}

      {screen === "math" && players && (
        <MathGame
          players={players}
          online={online}
          onBack={handleBackToPicker}
        />
      )}
    </>
  );
}

export default App;
