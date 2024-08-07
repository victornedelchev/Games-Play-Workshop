import * as request from "../lib/request";

const BASE_URL = "http://localhost:3030/data/games";
const QUERY = "?sortBy=_createdOn%20desc&pageSize=3";

export const getOneGame = (gameId) => request.get(`${BASE_URL}/${gameId}`);

export const getAllGames = async () => {
  const result = await request.get(BASE_URL);

  return result;
};

export const getLatestGames = async () => {
  // const query = new URLSearchParams({
  //   sortBy: "_createdOn desc",
  //   offset: 0,
  //   pageSize: 3,
  // });

  const result = await request.get(`${BASE_URL}${QUERY}`);

  return result;
};

export const createGame = async (gameData) => {
  const result = await request.post(BASE_URL, gameData);

  return result;
};

export const editGame = async (gameId, gameData) => {
  const result = await request.put(`${BASE_URL}/${gameId}`, gameData);

  return result;
};

export const deleteGame = async (gameId) => {
  await request.del(`${BASE_URL}/${gameId}`);
};
