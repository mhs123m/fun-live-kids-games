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
  currentGame: "xo" | "connect4" | null;
  gameState: GameState | null;
}

export interface GameState {
  board: CellValue[] | CellValue[][];
  isP1Turn: boolean;
  result: GameResult;
  winData: number[] | [number, number][];
  score: { player1: number; player2: number };
}

// --- Room operations ---

export async function createRoom(player1: PlayerInfo): Promise<string> {
  const roomsRef = ref(db, "rooms");
  const newRoomRef = push(roomsRef);
  const roomData: RoomData = {
    player1,
    player2: null,
    status: "waiting",
    currentGame: null,
    gameState: null,
  };
  await set(newRoomRef, roomData);
  return newRoomRef.key!;
}

export async function joinRoom(roomId: string, player2: PlayerInfo): Promise<RoomData | null> {
  const roomRef = ref(db, `rooms/${roomId}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return null;

  const room = snapshot.val() as RoomData;
  if (room.player2) return null; // already full

  await update(roomRef, {
    player2,
    status: "picking",
  });

  return { ...room, player2, status: "picking" };
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

export async function setCurrentGame(roomId: string, game: "xo" | "connect4", initialState: GameState): Promise<void> {
  const roomRef = ref(db, `rooms/${roomId}`);
  await update(roomRef, {
    currentGame: game,
    status: "playing",
    gameState: initialState,
  });
}

export async function updateGameState(roomId: string, state: GameState): Promise<void> {
  const stateRef = ref(db, `rooms/${roomId}/gameState`);
  await set(stateRef, state);
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
