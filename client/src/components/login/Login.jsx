import { useContext, useMemo } from "react";

import { Link } from "react-router-dom";

import useForm from "../../hooks/useForm";
import AuthContext from "../../contexts/authContext";

const loginFormKeys = {
  EMAIL: "email",
  PASSWORD: "password",
};

export default function Login() {
  const { loginSubmitHandler } = useContext(AuthContext);

  const initialValues = useMemo(() => ( {
    [loginFormKeys.EMAIL]: "",
    [loginFormKeys.PASSWORD]: "",
  }), []);

  const { values, onChange, onSubmit } = useForm(
    // {
    //   [loginFormKeys.EMAIL]: "",
    //   [loginFormKeys.PASSWORD]: "",
    // }
    initialValues,
    loginSubmitHandler
  );

  return (
    // <!-- Login Page ( Only for Guest users ) -->
    <section id="login-page" className="auth">
      <form id="login" onSubmit={onSubmit}>
        <div className="container">
          <div className="brand-logo"></div>
          <h1>Login</h1>
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="Sokka@gmail.com"
            value={values[loginFormKeys.EMAIL]}
            onChange={onChange}
          />

          <label htmlFor="login-pass">Password:</label>
          <input
            type="password"
            id="login-password"
            name="password"
            value={values[loginFormKeys.PASSWORD]}
            onChange={onChange}
          />
          <input type="submit" className="btn submit" value="Login" />
          <p className="field">
            <span>
              If you don't have profile click <Link to="/register">here</Link>
            </span>
          </p>
        </div>
      </form>
    </section>
  );
}
