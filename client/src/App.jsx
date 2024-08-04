import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./contexts/authContext";

import GameCatalog from "./components/gameCatalog/GameCatalog";
import GameCreate from "./components/gameCreate/GameCreate";
import GameDetails from "./components/gameDetails/GameDetails";
import GameEdit from "./components/gameEdit/GameEdit";
import Header from "./components/header/Header";
import Home from "./components/home/Home";
import Login from "./components/login/Login";
import Register from "./components/register/Register";
import Logout from "./components/Logout/Logout";
import Path from "./pats";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div id="box">
          {/* <!-- Main Content --> */}
          <Header />
          <main id="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path={Path.Logout} element={<Logout />} />
              <Route path="/games-create" element={<GameCreate />} />
              <Route path="/games/:gameId/edit/" element={<GameEdit />} />
              <Route path="/games/:gameId/details" element={<GameDetails />} />
              <Route path="/catalog" element={<GameCatalog />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
