import { useContext, useEffect } from "react";

import { useNavigate } from "react-router-dom";

import * as authService from "../../services/authService";
import Path from "../../pats";
import AuthContext from "../../contexts/authContext";

export default function Logout() {
  const navigate = useNavigate();
  const { logoutHandler } = useContext(AuthContext);

  useEffect(() => {
    authService
      .logout()
      .then(() => {
        logoutHandler();
        navigate(Path.Home);
      })
      .catch(() => {
        logoutHandler();
        navigate(Path.Login);
      });
  }, []);

  return null;
}
