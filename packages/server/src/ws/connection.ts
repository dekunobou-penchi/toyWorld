import { WebSocket } from "ws";

const connectionToUid = new Map<WebSocket, string>();
const uidToConnection = new Map<string, WebSocket>();
const adminConnections = new Set<WebSocket>();
// 登録（両方に set）
export function registerConnection(ws: WebSocket, uid: string): void {
  // 両方の Map に入れる
  connectionToUid.set(ws, uid); 
  uidToConnection.set(uid, ws);
}

// 削除（両方から delete）
export function removeConnection(ws: WebSocket): void {
  // ws から uid を引いて、両方から消す
  const uid = connectionToUid.get(ws);
  if(uid === undefined){
    return;
  }
  connectionToUid.delete(ws);
  uidToConnection.delete(uid);
}

// 接続 → uid
export function getUid(ws: WebSocket): string | undefined {
  // ...
  const uid = connectionToUid.get(ws);
  return uid;
}

// uid → 接続
export function getConnection(uid: string): WebSocket | undefined {
  // ...
  const ws = uidToConnection.get(uid);
  return ws;
}

export function getAllConnections(): WebSocket[] {
  return Array.from(uidToConnection.values());
}

export function registerAdmin(ws: WebSocket): void {
  adminConnections.add(ws);
} 

export function removeAdmin(ws: WebSocket): void{
  adminConnections.delete(ws);
}

export function getAllAdmin(): WebSocket[] {
  return Array.from(adminConnections.values());
}