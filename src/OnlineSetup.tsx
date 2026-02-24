import { useEffect, useRef, useState } from "react";
import type { Players } from "./types";
import type { RoomData } from "./firebase";
import { createRoom, joinRoom, getRoom, subscribeToRoom, compressImage } from "./firebase";
import "./OnlineSetup.css";

interface OnlineSetupProps {
  initialRoomId: string | null;
  onReady: (players: Players, roomId: string, myRole: "player1" | "player2") => void;
  onBack: () => void;
}

function OnlineSetup({ initialRoomId, onReady, onBack }: OnlineSetupProps) {
  const [phase, setPhase] = useState<"create" | "waiting" | "join">(
    initialRoomId ? "join" : "create"
  );
  const [name, setName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(initialRoomId);
  const [hostData, setHostData] = useState<RoomData | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch host data when joining
  useEffect(() => {
    if (phase === "join" && roomId) {
      getRoom(roomId).then((data) => {
        if (!data) {
          setError("الغرفة غير موجودة");
          return;
        }
        if (data.player2) {
          setError("الغرفة ممتلئة");
          return;
        }
        setHostData(data);
      });
    }
  }, [phase, roomId]);

  // Subscribe to room when waiting for opponent
  useEffect(() => {
    if (phase !== "waiting" || !roomId) return;

    const unsub = subscribeToRoom(roomId, (data) => {
      if (data && data.player2) {
        onReady(
          { player1: data.player1, player2: data.player2 },
          roomId,
          "player1"
        );
      }
    });
    return unsub;
  }, [phase, roomId, onReady]);

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setImage(compressed);
  };

  const handleCreateRoom = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const id = await createRoom({ name: name.trim(), image: image || "/default-p1.png" });
      setRoomId(id);
      window.location.hash = `room=${id}`;
      setPhase("waiting");
    } catch {
      setError("فشل إنشاء الغرفة");
    }
    setLoading(false);
  };

  const handleJoinRoom = async () => {
    if (!name.trim() || !roomId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await joinRoom(roomId, { name: name.trim(), image: image || "/default-p2.png" });
      if (!data) {
        setError("Room not found or already full");
        setLoading(false);
        return;
      }
      onReady(
        { player1: data.player1, player2: { name: name.trim(), image: image || "/default-p2.png" } },
        roomId,
        "player2"
      );
    } catch {
      setError("Failed to join room");
    }
    setLoading(false);
  };

  const shareLink = roomId
    ? `${window.location.origin}${window.location.pathname}#room=${roomId}`
    : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- Create Room View ---
  if (phase === "create") {
    return (
      <div className="online-wrapper">
        <button className="back-btn" onClick={onBack}>→ رجوع</button>
        <h1 className="online-title">إنشاء غرفة</h1>
        <p className="online-subtitle">جهّز ملفك الشخصي</p>

        <div className="online-card">
          <div className="online-avatar-area" onClick={() => fileRef.current?.click()}>
            {image ? (
              <img src={image} alt="You" className="online-avatar-img" />
            ) : (
              <div className="online-avatar-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="online-file-input" />
          </div>
          <input
            type="text"
            placeholder="اسمك"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="online-name-input"
            maxLength={12}
          />
        </div>

        {error && <p className="online-error">{error}</p>}

        <button
          className={`online-btn ${!name.trim() || loading ? "disabled" : ""}`}
          onClick={handleCreateRoom}
          disabled={!name.trim() || loading}
        >
          {loading ? "جاري الإنشاء..." : "إنشاء غرفة"}
        </button>
      </div>
    );
  }

  // --- Waiting for Opponent View ---
  if (phase === "waiting") {
    return (
      <div className="online-wrapper">
        <button className="back-btn" onClick={onBack}>→ رجوع</button>
        <h1 className="online-title">بانتظار الخصم</h1>
        <div className="waiting-dots">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>

        <p className="online-subtitle">شارك هذا الرابط مع صديقك:</p>

        <div className="share-box">
          <span className="share-link">{shareLink}</span>
          <button className="copy-btn" onClick={handleCopy}>
            {copied ? "تم النسخ!" : "نسخ"}
          </button>
        </div>
      </div>
    );
  }

  // --- Join Room View ---
  return (
    <div className="online-wrapper">
      <button className="back-btn" onClick={onBack}>→ رجوع</button>
      <h1 className="online-title">انضمام للعبة</h1>

      {hostData ? (
        <>
          <p className="online-subtitle">
            <strong>{hostData.player1.name}</strong> بانتظارك!
          </p>
          {hostData.player1.image && (
            <img src={hostData.player1.image} alt={hostData.player1.name} className="host-avatar" />
          )}

          <div className="online-card" style={{ marginTop: 20 }}>
            <div className="online-avatar-area" onClick={() => fileRef.current?.click()}>
              {image ? (
                <img src={image} alt="You" className="online-avatar-img" />
              ) : (
                <div className="online-avatar-placeholder">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="online-file-input" />
            </div>
            <input
              type="text"
              placeholder="اسمك"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="online-name-input"
              maxLength={12}
            />
          </div>

          {error && <p className="online-error">{error}</p>}

        <button
          className={`online-btn ${!name.trim() || loading ? "disabled" : ""}`}
          onClick={handleJoinRoom}
          disabled={!name.trim() || loading}
        >
          {loading ? "جاري الانضمام..." : "انضمام"}
        </button>
        </>
      ) : error ? (
        <p className="online-error">{error}</p>
      ) : (
        <p className="online-subtitle">جاري تحميل الغرفة...</p>
      )}
    </div>
  );
}

export default OnlineSetup;
