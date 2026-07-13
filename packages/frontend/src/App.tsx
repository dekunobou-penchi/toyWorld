import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { Register } from "./pages/Register";
import { Admin } from "./pages/Admin";
import { Player } from "./pages/Player";
import { GameProvider } from "./context/GameContext";
import { AdminProvider } from "./context/AdminContext";


export function App() {
    return (
        // <div>
        //     <h1>Game</h1>
        //     <p>フロントエンド起動</p>
        // </div>
        
            <BrowserRouter>
                <Routes>
                    <Route element={<GameLayout />}>
                        <Route path="/" element={<Register />} />
                        <Route path="/play" element={<Player />} />
                    </Route>
                    <Route path="/admin" element={<AdminProvider><Admin /></AdminProvider>} />
                </Routes>
            </BrowserRouter>
    );
}

function GameLayout() {
    return (
        <GameProvider>
            <Outlet />
        </GameProvider>
    );
}