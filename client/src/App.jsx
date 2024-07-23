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
    <div id="box">
      <Header />
      {/* <!-- Main Content --> */}
      <main id="main-content">
        <Home />
        <Login />
        <Register />
        <GameCreate />
        <GameEdit />
        <GameDetails />
        <GameCatalog />
      </main>
    </div>
  );
}

export default App;
