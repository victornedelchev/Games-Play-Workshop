import * as request from "../lib/request";

const BASE_URL = "http://localhost:3030/data/comments";

export const getAllComments = async (gameId) => {
  const query = new URLSearchParams({
    where: `gameId="${gameId}"`,
    load: `owner=_ownerId:users`
  });

  const result = await request.get(`${BASE_URL}?${query}`);

  return result
};

export const createComment = async (gameId, text) => {
  const newComment = await request.post(BASE_URL, {
    gameId,
    // username,
    text,
  });

  return newComment;
};
