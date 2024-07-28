import { Link } from "react-router-dom";

import useForm from "../../hooks/useForm";

const loginFormKeys = {
  EMAIL: "email",
  PASSWORD: "password",
};

export default function Login({ loginSubmitHandler }) {
  const { values, onChange, onSubmit } = useForm(
    {
      [loginFormKeys.EMAIL]: "",
      [loginFormKeys.PASSWORD]: "",
    },
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
