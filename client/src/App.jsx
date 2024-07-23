import { BrowserRouter, Route, Routes } from "react-router-dom";

import GameCatalog from "./components/gameCatalog/GameCatalog";
import GameCreate from "./components/gameCreate/GameCreate";
import GameDetails from "./components/gameDetails/GameDetails";
import GameEdit from "./components/gameEdit/GameEdit";
import Header from "./components/header/Header";
import Home from "./components/home/Home";
import Login from "./components/login/Login";
import Register from "./components/register/Register";

function App() {
  return (
    <BrowserRouter>
      <div id="box">
        <Header />
        {/* <!-- Main Content --> */}
        <main id="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/game-create" element={<GameCreate />} />
            <Route path="/game/:id/edit/" element={<GameEdit />} />
            <Route path="/game/:id/details" element={<GameDetails />} />
            <Route path="/catalog" element={<GameCatalog />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
