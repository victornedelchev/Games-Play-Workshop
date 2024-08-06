import { useContext } from "react";
import { Link } from "react-router-dom";
import AuthContext from "../../contexts/authContext";

export default function Header() {
  const { isAuthenticated, username } = useContext(AuthContext);
  return (
    <header>
      {/* <!-- Navigation --> */}
      <h1>
        <Link className="welcome-message" to="/">
          GamesPlay
        </Link>
      </h1>
      <nav>
        <Link to="/catalog">All games</Link>
        {isAuthenticated ? (
          <div id="user">
            <Link to="/games/create">Create Game</Link>
            <Link to="/logout">Logout</Link>
            <span>| Welcome {username}</span>
          </div>
        ) : (
          <div id="guest">
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </div>
        )}
      </nav>
    </header>
  );
}
