import * as request from "../lib/request";

const BASE_URL = "http://localhost:3030/jsonstore/comments";

export const getAllComments = async (gameId) => {
  //! This code work with Collections on SoftUni practice server
  // const query = new URLSearchParams({
  //   where: `gameId="${gameId}"`,
  // });

  // const result = await request.get(`${BASE_URL}?${query.toString()}`);

  // TODO: modify this code (this is temporary solution until migration to collection service)
  const result = await request.get(BASE_URL);

  return Object.values(result).filter((comment) => comment.gameId === gameId);
};

export const createComment = async (gameId, username, text) => {
  const newComment = await request.post(BASE_URL, {
    gameId,
    username,
    text,
  });

  return newComment;
};
