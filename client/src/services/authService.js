import * as request from "../lib/request";

const BASE_URL = "http://localhost:3030/users";

export const login = async (email, password) => {
  const result = await request.post(`${BASE_URL}/login`, { email, password });

  return result;
};

export const register = (email, password) => {
  const result = request.post(`${BASE_URL}/register`, {
    email,
    password,
  });

  return result;
};

export const logout = () => request.get(`${BASE_URL}/logout`);
