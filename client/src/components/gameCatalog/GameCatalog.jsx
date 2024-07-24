import { useEffect, useState } from "react";

import * as gameService from "../../services/gameService";
import GameItem from "./gameItem";

export default function GameCatalog() {
  const [games, setGames] = useState([]);

  useEffect(() => {
    (async () => {
      const result = await gameService.getAllGames();
      setGames(result);
    })();
  }, []);

  return (
    // <!-- Catalogue -->
    <section id="catalog-page">
      <h1>All Games</h1>
      {/* <!-- Display div: with information about every game (if any) --> */}
      {games.length > 0 ? (
        games.map((game) => <GameItem key={game._id} {...game} />)
      ) : (
        <h3 className="no-articles">No articles yet</h3>
      )}
    </section>
  );
}
