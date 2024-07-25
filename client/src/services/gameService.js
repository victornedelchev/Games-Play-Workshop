import * as request from "../lib/request";

const BASE_URL = "http://localhost:3030/jsonstore/games";

export const getOneGame = (gameId) => request.get(`${BASE_URL}/${gameId}`);

export const getAllGames = async () => {
  const result = await request.get(BASE_URL);

  return Object.values(result);
};

export const createGame = async (gameData) => {
  const result = await request.post(BASE_URL, gameData);
  return result;
};
