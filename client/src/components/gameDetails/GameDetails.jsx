import { useContext, useEffect, useReducer, useState } from "react";

import { Link, useParams } from "react-router-dom";

import * as gameService from "../../services/gameService";
import * as commentService from "../../services/commentService";
import AuthContext from "../../contexts/authContext";
import reducer from "./commentReducer";
import useForm from "../../hooks/useForm";
import { pathToURL } from "../../utils/pathUtils";
import Path from "../../pats";

export default function GameDetails() {
  const { email, userId } = useContext(AuthContext);
  const [game, setGame] = useState({});
  // const [comments, setComments] = useState([]);
  const [comments, dispatch] = useReducer(reducer, []);
  const { gameId } = useParams();

  useEffect(() => {
    (async () => {
      const gameResult = await gameService.getOneGame(gameId);
      setGame(gameResult);

      const commentsResult = await commentService.getAllComments(gameId);
      dispatch({
        type: "GET_ALL_COMMENTS",
        payload: commentsResult,
      });
    })();
  }, [gameId]);

  const addCommentHandler = async (values) => {
    const newComment = await commentService.createComment(
      gameId,
      values.comment
    );

    newComment.owner = { email };

    // setComments((state) => [...state, { ...newComment, owner: { email } }]);
    dispatch({
      type: "ADD_COMMENT",
      payload: newComment,
    });

    values.comment = "";
  };

  const { values, onChange, onSubmit } = useForm(
    { comment: "" },
    addCommentHandler
  );

  const isOwner = userId === game._ownerId;

  return (
    // <!--Details Page-->
    <section id="game-details">
      <h1>Game Details</h1>
      <div className="info-section">
        <div className="game-header">
          <img className="game-img" src={game.imageUrl} alt={game.title} />
          <h1>{game.title}</h1>
          <span className="levels">MaxLevel: {game.maxLevel}</span>
          <p className="type">{game.category}</p>
        </div>

        <p className="text">{game.summary}</p>

        {/* <!-- Bonus ( for Guests and Users ) --> */}
        <div className="details-comments">
          <h2>Comments:</h2>
          <ul>
            {/* <!-- list all comments for current game (If any) --> */}
            {comments.map(({ _id, text, owner: { email } }) => (
              <li className="comment" key={_id}>
                <p>
                  {email}: {text}
                </p>
              </li>
            ))}
          </ul>
          {/* <!-- Display paragraph: If there are no games in the database --> */}
          {comments.length === 0 && <p className="no-comment">No comments.</p>}
        </div>

        {/* <!-- Edit/Delete buttons ( Only for creator of this game )  --> */}
        {isOwner && (
          <div className="buttons">
            <Link to={pathToURL(Path.Edit, { gameId })} className="button">
              Edit
            </Link>
            <Link href="#" className="button">
              Delete
            </Link>
          </div>
        )}
      </div>

      {/* <!-- Bonus --> */}
      {/* <!-- Add Comment ( Only for logged-in users, which is not creators of the current game ) --> */}
      <article className="create-comment">
        <label>Add new comment:</label>
        <form className="form" onSubmit={onSubmit}>
          {/* <input
            type="text"
            name="username"
            placeholder="Victor"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          /> */}
          <textarea
            name="comment"
            placeholder="Comment......"
            value={values.comment}
            onChange={onChange}
          ></textarea>
          <input className="btn submit" type="submit" value="Add Comment" />
        </form>
      </article>
    </section>
  );
}
