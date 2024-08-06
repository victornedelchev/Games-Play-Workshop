import { useContext } from "react";

import { Navigate, Outlet } from "react-router-dom";

import Path from "../../pats";
import AuthContext from "../../contexts/authContext";

export default function AuthGuard(props) {
  const { isAuthenticated } = useContext(AuthContext);
  console.log(isAuthenticated);
  
  if (!isAuthenticated) {
    return <Navigate to={Path.Login} />;
  }

  return <Outlet />;
}
