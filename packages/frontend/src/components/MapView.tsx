import { Direction, ViewCell } from "@game/shared";

interface MapViewProps {
    nx: number;
    ny: number;
    myPos: {x: number; y:number};
    dir: Direction
    view: ViewCell[]
}

export function MapView({nx, ny, myPos, dir, view}: MapViewProps) {
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
                const visibleCell = view.find((v) => v.x === cell.x && v.y === cell.y);
                let fillColor = 'white';
                if(cell.x === myPos.x && cell.y === myPos.y){ fillColor = '#d2ffd4'}
                else if(visibleCell?.player){fillColor = '#408d92'}
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
                        {visibleCell && (
                            <text
                                x={cell.x * cellSize + cellSize / 2}
                                y={cell.y * cellSize + cellSize / 2}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize="12"
                            >{visibleCell.block}</text>
                        )}
                        {visibleCell?.player && (
                            <polygon
                                points={polygonDir(visibleCell.x * cellSize, visibleCell.y * cellSize, visibleCell.player.dir, cellSize)}
                                fill="#ff5757"
                            />
                        )}
                    </g>
                );


            })}
            <polygon 
                points={polygonDir(myPos.x * cellSize, myPos.y * cellSize, dir, cellSize)} 
                fill="#ff5757"
            />
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