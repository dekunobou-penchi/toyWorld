import { createContext, ReactNode, useEffect, useState } from "react";
import { GameClient } from "../ws/client";
import { Player, ServerMessage } from "@game/shared";



export interface AdminContextValue{
    client: GameClient | null;
    map: {nx: number, ny: number, data: number[][]} | null;
    running: boolean;
    players: Player[] | [];
}

export const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode}){

    const [client, setClient] = useState<GameClient | null>(null);
    const [map, setMap] = useState<{nx: number, ny: number, data: number[][]} | null>(null);
    const [running, setRunning] = useState(false);
    const [players, setPlayer] = useState<Player[] | []>([]);

    useEffect(() => {
        const c = new GameClient();
        c.connect(
            (msg: ServerMessage) => {
            handleServerMessage(msg);
            },
            () => {
                c.send({type: 'admin_join'});
            }
        );

        setClient(c);

        return () => {
            c.disconnect();
        };
    }, []);

    function handleServerMessage(msg: ServerMessage) {
        if (msg.type === 'admin_state') {
            setMap(msg.map);
            setPlayer(msg.players);
            setRunning(msg.running);
        }
    }

    const value: AdminContextValue = {
        client,
        map,
        running,
        players
    };

    return (
        <AdminContext.Provider value={value}>
            {children}
        </AdminContext.Provider>
    )
}