export interface PlayerInfo {
  name: string;
  image: string;
}

export interface Players {
  player1: PlayerInfo;
  player2: PlayerInfo;
}

export type CellValue = "player1" | "player2" | null;
export type GameResult = "player1" | "player2" | "draw" | null;

export interface OnlineConfig {
  roomId: string;
  myRole: "player1" | "player2";
}
