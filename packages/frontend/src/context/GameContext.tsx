import { createContext, useState,  useEffect } from "react";
import type { ReactNode  } from "react";
import  { GameClient } from "../ws/client";
import { GameParams, ViewCell, type Player, type ServerMessage } from "@game/shared";

export interface GameContextValue {
    client: GameClient | null;
    me: Player | null;
    params: GameParams | null;
    running: boolean;
    resetCount: number;
    view: ViewCell[];
}

export const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode}){

    const [me, setMe] = useState<Player | null>(null);
    //const clientRef = useRef<GameClient | null>(null);
    const [client, setClient] = useState<GameClient | null>(null);
    const [params, setParams] = useState<GameParams | null >(null);
    const [running, setRunning] = useState(false);
    const [resetCount, setResetCount] = useState(0);
    const [view, setView] = useState<ViewCell[]>([]);

    useEffect(() => {
    const c = new GameClient();
    //clientRef.current = client;

    c.connect((msg: ServerMessage) => {
      //console.log('サーバーから:', msg);
      handleServerMessage(msg);
    });

    setClient(c);

    return () => {
      c.disconnect();
    };
  }, []);

  function handleServerMessage(msg: ServerMessage) {
    if (msg.type === 'joined') {
        setMe(msg.you);
        setParams(msg.params);
        console.log('参加成功:', msg.you);
    } else if (msg.type === 'join_failed') {
        console.warn('参加失敗:', msg.text);
    } else if (msg.type === 'state') {
        setMe(msg.you);
        setView(msg.view);
    } else if (msg.type === 'error') {
        console.error('エラー:', msg.text);
    } else if(msg.type === 'game_state') {
      setRunning(msg.running);
      if(msg.reset === true){
        setResetCount(prev => prev + 1);
      }
      console.log('state受信:', msg);
    }

  }

  const value: GameContextValue = {
    client,
    me,
    params,
    running,
    resetCount,
    view,
  };

  return (
    <GameContext.Provider value={value}>
        {children}
    </GameContext.Provider>
  );
}