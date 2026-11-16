import { createContext, ReactNode, useEffect, useState } from "react";
import { GameClient } from "../ws/client";
import { AdminStateMessage, Player, ServerMessage } from "@game/shared";



export interface AdminContextValue{
    client: GameClient | null;
    map: {nx: number, ny: number, data: number[][]} | null;
    running: boolean;
    players: Player[] | [];
    distribution: AdminStateMessage["distribution"];
}

export const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode}){

    const [client, setClient] = useState<GameClient | null>(null);
    const [map, setMap] = useState<{nx: number, ny: number, data: number[][]} | null>(null);
    const [running, setRunning] = useState(false);
    const [players, setPlayer] = useState<Player[] | []>([]);
    const [distribution, setDistribution] = useState<AdminStateMessage["distribution"]>(null);

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
            setDistribution(msg.distribution ?? null);
        }
    }

    const value: AdminContextValue = {
        client,
        map,
        running,
        players,
        distribution
    };

    return (
        <AdminContext.Provider value={value}>
            {children}
        </AdminContext.Provider>
    )
}