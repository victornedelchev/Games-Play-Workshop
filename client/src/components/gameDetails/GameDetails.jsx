import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import * as gameService from "../../services/gameService";
import * as commentService from "../../services/commentService";

export default function GameDetails() {
  const [game, setGame] = useState({});
  const [comments, setComments] = useState([]);
  const [username, setUsername] = useState("");
  const [text, setText] = useState("");
  const { gameId } = useParams();

  useEffect(() => {
    (async () => {
      const gameResult = await gameService.getOneGame(gameId);
      setGame(gameResult);

      const commentsResult = await commentService.getAllComments();
      setComments(commentsResult);
      console.log(comments);
    })();
  }, [gameId]);

  const addCommentHandler = async (e) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const newComment = await commentService.createComment(
      gameId,
      formData.get("username"),
      formData.get("comment")
    );

    setComments((state) => [...state, newComment]);

    setUsername("");
    setText("");
  };

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
            {comments.map((comment) => (
              <li className="comment" key={comment._id}>
                <p>
                  {comment.username}: {comment.text}
                </p>
              </li>
            ))}
          </ul>
          {/* <!-- Display paragraph: If there are no games in the database --> */}
          {comments.length === 0 && <p className="no-comment">No comments.</p>}
        </div>

        {/* <!-- Edit/Delete buttons ( Only for creator of this game )  --> */}
        <div className="buttons">
          <a href="#" className="button">
            Edit
          </a>
          <a href="#" className="button">
            Delete
          </a>
        </div>
      </div>

      {/* <!-- Bonus --> */}
      {/* <!-- Add Comment ( Only for logged-in users, which is not creators of the current game ) --> */}
      <article className="create-comment">
        <label>Add new comment:</label>
        <form className="form" onSubmit={addCommentHandler}>
          <input
            type="text"
            name="username"
            placeholder="Victor"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <textarea
            name="comment"
            placeholder="Comment......"
            value={text}
            onChange={(e) => setText(e.target.value)}
          ></textarea>
          <input className="btn submit" type="submit" value="Add Comment" />
        </form>
      </article>
    </section>
  );
}
