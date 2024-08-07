import { Link, useParams } from "react-router-dom";
import { pathToURL } from "../../utils/pathUtils";
import Path from "../../pats";

export default function GameItem({ _id, imageUrl, category, title }) {
  const { gameId } = useParams();
  return (
    <div className="allGames">
      <div className="allGames-info">
        <img src={imageUrl} />
        <h6>{category}</h6>
        <h2>{title}</h2>
        <Link to={pathToURL(Path.Details, {gameId})} className="details-button">
          Details
        </Link>
      </div>
    </div>
  );
}
