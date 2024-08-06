import { Route, Routes } from "react-router-dom";

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
import ErrorBoundary from "./components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <div id="box">
          {/* <!-- Main Content --> */}
          <Header />
          <main id="main-content">
            <Routes>
              <Route path={Path.Home} element={<Home />} />
              <Route path={Path.Login} element={<Login />} />
              <Route path={Path.Register} element={<Register />} />
              <Route path={Path.Logout} element={<Logout />} />
              <Route path={Path.Create} element={<GameCreate />} />
              <Route path={Path.Edit} element={<GameEdit />} />
              <Route path={Path.Details} element={<GameDetails />} />
              <Route path={Path.Catalog} element={<GameCatalog />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
