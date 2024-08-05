import { useNavigate, useParams } from "react-router-dom";

import * as gameService from "../../services/gameService";
import useForm from "../../hooks/useForm";
import { useEffect, useState } from "react";

export default function GameEdit() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const [game, setGame] = useState({});

  useEffect(() => {
    gameService.getOneGame(gameId).then((result) => {
      setGame(result);
    });
  }, []);

  const editGameSubmitHandler = async (values) => {
    try {
      await gameService.editGame(gameId, values);
      navigate("/catalog");
    } catch (error) {
      // TODO: error notification
      console.error(error);
    }
  };

  const { values, onChange, onSubmit } = useForm(game, editGameSubmitHandler);

  return (
    // <!-- Edit Page ( Only for the creator )-->
    <section id="edit-page" className="auth">
      <form id="edit" onSubmit={onSubmit}>
        <div className="container">
          <h1>Edit Game</h1>
          <label htmlFor="leg-title">Legendary title:</label>
          <input
            type="text"
            id="title"
            name="title"
            value={values.title}
            onChange={onChange}
          />

          <label htmlFor="category">Category:</label>
          <input
            type="text"
            id="category"
            name="category"
            value={values.category}
            onChange={onChange}
          />

          <label htmlFor="levels">MaxLevel:</label>
          <input
            type="number"
            id="maxLevel"
            name="maxLevel"
            min="1"
            value={values.maxLevel}
            onChange={onChange}
          />

          <label htmlFor="game-img">Image:</label>
          <input
            type="text"
            id="imageUrl"
            name="imageUrl"
            value={values.imageUrl}
            onChange={onChange}
          />

          <label htmlFor="summary">Summary:</label>
          <textarea
            name="summary"
            id="summary"
            value={values.summary}
            onChange={onChange}
          ></textarea>
          <input className="btn submit" type="submit" value="Edit Game" />
        </div>
      </form>
    </section>
  );
}
