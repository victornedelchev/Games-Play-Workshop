import { request } from "../lib/request";

const BASE_URL = "http://localhost:3030/jsonstore/games";

export const getAllGames = async () => {
  const result = await request("GET", BASE_URL);

  return Object.values(result);
};

export const createGame = async (gameData) => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(gameData),
  });

  const result = await response.json();

  return result;
};
