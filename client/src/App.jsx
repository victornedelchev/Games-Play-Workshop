import { useState } from "react";

import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";

import AuthContext from "./contexts/authContext";

import * as authService from "../src/services/authService";

import GameCatalog from "./components/gameCatalog/GameCatalog";
import GameCreate from "./components/gameCreate/GameCreate";
import GameDetails from "./components/gameDetails/GameDetails";
import GameEdit from "./components/gameEdit/GameEdit";
import Header from "./components/header/Header";
import Home from "./components/home/Home";
import Login from "./components/login/Login";
import Register from "./components/register/Register";
// import Path from "./pats";

function App() {
  const [auth, setAuth] = useState({});
  // const navigate = useNavigate();

  const loginSubmitHandler = async (values) => {
    const result = await authService.login(values.email, values.password);
    setAuth(result);
    // navigate(Path.Home);
  };

  const registerSubmitHandler = async (values) => {
    console.log(values);
  }

  const values = {
    loginSubmitHandler,
    registerSubmitHandler,
    username: auth.username,
    email: auth.email,
    isAuthenticated: !!auth.username,
  };

  return (
    <AuthContext.Provider value={values}>
      <BrowserRouter>
        <div id="box">
          <Header />
          {/* <!-- Main Content --> */}
          <main id="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/games-create" element={<GameCreate />} />
              <Route path="/games/:gameId/edit/" element={<GameEdit />} />
              <Route path="/games/:gameId/details" element={<GameDetails />} />
              <Route path="/catalog" element={<GameCatalog />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;
