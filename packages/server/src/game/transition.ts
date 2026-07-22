import { runTick } from "./tick.js";
import { World } from "./world.js";
import { getConnection } from "../ws/connection.js";
import { StateMessage } from "@game/shared";
import { View } from "./view.js";

export function transitionTurn(world: World): void {
    if(world.params === null){
        return;
    } 

    if(world.params.transition === "agent") {
        // for (const p of world.players.values()){
                
        //         const ws = getConnection(p.uid);
        //         if(ws === undefined) {
        //             continue;
        //         }
        //         const state: StateMessage = {
        //             type: 'state',
        //             you: p,
        //             view: View(world, p),
        //             sysmsg: null,
        //         };
        
        //         ws.send(JSON.stringify(state));
        // }
        for (const p of world.players.values()){
            if(p.selectedAction === null) {
                console.log("dont select action");
                return;
            }
        }
        runTick();
    }

    
}