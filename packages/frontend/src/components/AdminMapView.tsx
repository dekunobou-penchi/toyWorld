import { Player } from "@game/shared";
import { Direction } from "@game/shared";

interface AdminMapViewProps {
    nx: number;
    ny: number;
    data: number[][]
    players: Player[]
}


export function AdminMapView({nx, ny, data, players}: AdminMapViewProps) {
    const cellSize = 30;
    const cells = [];
    for(let y = 0; y < ny; y++) {
        for(let x = 0; x < nx; x++){
            cells.push({x, y});
        }
    }

    return (
        <svg
            width={nx * cellSize}
            height={ny * cellSize}
            style={{border: '1px solid #ccc'}}
        >
            {cells.map((cell) => {
                let fillColor = 'white';
                return (
                    <g key={`${cell.x},${cell.y}`}>
                        <rect
                            x={cell.x * cellSize}
                            y={cell.y * cellSize}
                            width={cellSize}
                            height={cellSize}
                            fill={fillColor}
                            stroke="#ddd"
                        />
                        <text
                            x={cell.x * cellSize + cellSize / 2}
                            y={cell.y * cellSize + cellSize / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize="12"
                        >
                            {data[cell.y][cell.x]}
                        </text>

                       
                    </g>
                )                
            })}
            {players.map((player) => (
                <polygon 
                    key={player.uid}      
                    points={polygonDir(player.pos.x * cellSize, player.pos.y * cellSize, player.dir, cellSize)}
                    fill="#ff5757"
                />
            ))}             

        </svg>
    )
}

function polygonDir(x: number, y: number,  dir: Direction, s:number): string{

    let top: string = "";
    switch (dir) {
        case "N":
            top = `${x + (s/2)},${y + 4} ${x + 4},${(y+s) - 4} ${(x+s) - 4},${(y+s) - 4}`;
            break;
        case "E":
            top = `${x+4},${y+4} ${x+4},${(y+s) - 4} ${(x+s) - 4},${y + (s/2)}`;
            break;
        case "S":
            top = `${x+4},${y+4} ${x + (s/2)},${(y+s) - 4} ${(x+s) - 4},${(y + 4)}`;
            break;
        case "W":
            top = `${x+4},${y+(s/2)} ${(x + s) - 4},${y + 4} ${(x + s) - 4},${(y + s) - 4}`;
            break;
        default:
            break;
    }
    return top;

}