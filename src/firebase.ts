import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, set, get, onValue, update, type Unsubscribe } from "firebase/database";
import type { PlayerInfo, CellValue, GameResult } from "./types";

const firebaseConfig = {
  apiKey: "AIzaSyAtoL9aSA41WDKMMXctncB3FsKfrdgRevA",
  authDomain: "kids-games-a19f8.firebaseapp.com",
  databaseURL: "https://kids-games-a19f8-default-rtdb.firebaseio.com",
  projectId: "kids-games-a19f8",
  storageBucket: "kids-games-a19f8.firebasestorage.app",
  messagingSenderId: "401097621013",
  appId: "1:401097621013:web:71592cab0b0cd9bc86d81c",
  measurementId: "G-5D8REQ2CCJ",
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- Types ---

export interface RoomData {
  player1: PlayerInfo;
  player2: PlayerInfo | null;
  status: "waiting" | "picking" | "playing";
  currentGame: "xo" | "connect4" | "math" | null;
  gameState: GameState | MathGameState | null;
  votes?: {
    player1?: "xo" | "connect4" | "math" | null;
    player2?: "xo" | "connect4" | "math" | null;
  };
  privacy?: "private" | "public";
  spectators?: PlayerInfo[];
}

export interface GameState {
  board: CellValue[] | CellValue[][];
  isP1Turn: boolean;
  result: GameResult;
  winData: number[] | [number, number][];
  score: { player1: number; player2: number };
}

export type MathLevel = "preschool" | "juniors";

export interface MathGameState {
  round: number;
  phase: "level-select" | "asking" | "pass" | "answering" | "reveal" | "done";
  level: MathLevel | "";
  asker: "player1" | "player2";
  question: string;
  correctAnswer: string;
  givenAnswer: string;
  score: { player1: number; player2: number };
}

// --- Room operations ---

export async function createRoom(player1: PlayerInfo, privacy: "private" | "public" = "private"): Promise<string> {
  const roomsRef = ref(db, "rooms");
  const newRoomRef = push(roomsRef);
  const roomData: RoomData = {
    player1,
    player2: null,
    status: "waiting",
    currentGame: null,
    gameState: null,
    privacy,
    spectators: [],
  };
  await set(newRoomRef, roomData);
  return newRoomRef.key!;
}

export async function joinRoom(roomId: string, player2: PlayerInfo): Promise<{ room: RoomData; role: "player1" | "player2" | "spectator" } | null> {
  const roomRef = ref(db, `rooms/${roomId}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return null;

  const room = snapshot.val() as RoomData;
  
  // If room has 2 players, join as spectator
  if (room.player2) {
    const spectators = [...(room.spectators || []), player2];
    await update(roomRef, { spectators });
    return { room: { ...room, spectators }, role: "spectator" };
  }

  // Join as player2
  await update(roomRef, {
    player2,
    status: "picking",
  });

  return { room: { ...room, player2, status: "picking" }, role: "player2" };
}

export async function getRoom(roomId: string): Promise<RoomData | null> {
  const roomRef = ref(db, `rooms/${roomId}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return null;
  return snapshot.val() as RoomData;
}

export function subscribeToRoom(roomId: string, callback: (data: RoomData | null) => void): Unsubscribe {
  const roomRef = ref(db, `rooms/${roomId}`);
  return onValue(roomRef, (snapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as RoomData) : null);
  });
}

export async function setVote(roomId: string, player: "player1" | "player2" | "spectator", game: "xo" | "connect4" | "math"): Promise<void> {
  const roomRef = ref(db, `rooms/${roomId}`);
  await update(roomRef, {
    [`votes.${player}`]: game,
  });
}

export async function setCurrentGame(roomId: string, game: "xo" | "connect4" | "math", initialState: GameState | MathGameState): Promise<void> {
  const roomRef = ref(db, `rooms/${roomId}`);
  await update(roomRef, {
    currentGame: game,
    status: "playing",
    gameState: "board" in initialState ? serializeState(initialState as GameState) : initialState,
  });
}

export async function updateGameState(roomId: string, state: GameState | MathGameState): Promise<void> {
  const stateRef = ref(db, `rooms/${roomId}/gameState`);
  // Firebase strips null from arrays, so replace with "" before writing
  await set(stateRef, "board" in state ? serializeState(state as GameState) : state);
}

// Firebase RTDB strips null values from arrays, breaking board structure.
// We use "" as a placeholder for empty cells.

function serializeState(state: GameState): GameState {
  return {
    ...state,
    board: serializeBoard(state.board) as CellValue[] | CellValue[][],
    result: (state.result ?? "") as GameResult,
  };
}

function serializeBoard(board: CellValue[] | CellValue[][]): (string | CellValue)[] | (string | CellValue)[][] {
  if (Array.isArray(board[0])) {
    // 2D board (Connect Four)
    return (board as CellValue[][]).map((row) => row.map((c) => c ?? ""));
  }
  // 1D board (XO)
  return (board as CellValue[]).map((c) => c ?? "");
}

export function deserializeBoard1D(raw: unknown): CellValue[] {
  if (!raw) return Array(9).fill(null);
  if (Array.isArray(raw)) {
    return raw.map((c) => (c === "" || c === null || c === undefined ? null : c)) as CellValue[];
  }
  // Firebase may return object with numeric keys
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return Array.from({ length: 9 }, (_, i) => {
      const v = obj[String(i)];
      return v === "" || v === null || v === undefined ? null : v;
    }) as CellValue[];
  }
  return Array(9).fill(null);
}

export function deserializeBoard2D(raw: unknown, rows: number, cols: number): CellValue[][] {
  const empty = () => Array.from({ length: rows }, () => Array(cols).fill(null));
  if (!raw) return empty();

  const normalize = (row: unknown): CellValue[] => {
    if (Array.isArray(row)) {
      return row.map((c) => (c === "" || c === null || c === undefined ? null : c)) as CellValue[];
    }
    if (row && typeof row === "object") {
      return Array.from({ length: cols }, (_, i) => {
        const v = (row as Record<string, unknown>)[String(i)];
        return v === "" || v === null || v === undefined ? null : v;
      }) as CellValue[];
    }
    return Array(cols).fill(null);
  };

  if (Array.isArray(raw)) {
    return raw.map(normalize);
  }
  if (typeof raw === "object") {
    return Array.from({ length: rows }, (_, i) =>
      normalize((raw as Record<string, unknown>)[String(i)])
    );
  }
  return empty();
}

export async function backToPicking(roomId: string): Promise<void> {
  const roomRef = ref(db, `rooms/${roomId}`);
  await update(roomRef, {
    status: "picking",
    currentGame: null,
    gameState: null,
  });
}

// --- Image compression ---

export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, 100, 100);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
      URL.revokeObjectURL(img.src);
      resolve(dataUrl);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
