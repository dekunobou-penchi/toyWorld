import { WebSocketServer, type WebSocket } from 'ws';
import type { Server } from 'node:http';
import { handleMessage } from './handlers.js';
import { removeAdmin, removeConnection } from './connection.js';



export function setupWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    // 接続ログ
    console.log("Client has connected");

    ws.on('message', (data) => {
      try {
        handleMessage(ws, data);
      } catch (e) {
        console.error('エラー発生:', e)
      }
    });


    ws.on('close', () => {
      // 切断ログ
      console.log('Disconnected');
      removeConnection(ws);
      removeAdmin(ws);
    });
  });

  return wss;
}