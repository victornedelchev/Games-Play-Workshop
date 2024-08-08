import { useEffect, useState } from "react";

import withAuth from "../../HOC/withAuth";
import * as gameService from "../../services/gameService";
import LatestGames from "./latestGams/LatestGames";

function Home({ email }) {
  const [latestGames, setLatestGames] = useState([]);

  useEffect(() => {
    gameService.getLatestGames().then((result) => {
      setLatestGames(result);
    });
  }, []);

  return (
    // <!--Home Page-->
    <section id="welcome-world">
      <div className="welcome-message">
        <h2>ALL new games are</h2>
        <h3>Only in GamesPlay</h3>
      </div>
      <img src="./images/four_slider_img01.png" alt="hero" />

      <div id="home-page">
        <h1>Latest Games</h1>

        {/* <!-- Display div: with information about every game (if any) --> */}
        {latestGames.map((game) => (
          <LatestGames key={game._id} {...game} />
        ))}
        {/* <!-- Display paragraph: If there is no games  --> */}
        {!latestGames.length && <p className="no-articles">No games yet</p>}
        <p>{email}</p>
      </div>
    </section>
  );
}

const EnhancedHome = withAuth(Home);

export default withAuth(EnhancedHome);
