import { useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import AuthContext from "../../contexts/authContext";
import useForm from "../../hooks/useForm";

const registerFormKeys = {
  EMAIL: "email",
  PASSWORD: "password",
  RE_PASSWORD: "confirm-password",
};

export default function Register() {
  const { registerSubmitHandler } = useContext(AuthContext);

  const initialValues = useMemo(() => ( {
    [registerFormKeys.EMAIL]: "",
    [registerFormKeys.PASSWORD]: "",
    [registerFormKeys.RE_PASSWORD]: "",
  }), []);

  const { values, onChange, onSubmit } = useForm(
    // {
    //   [registerFormKeys.EMAIL]: "",
    //   [registerFormKeys.PASSWORD]: "",
    //   [registerFormKeys.RE_PASSWORD]: "",
    // },
    initialValues,
    registerSubmitHandler
  );

  return (
    // <!-- Register Page ( Only for Guest users ) -->
    <section id="register-page" className="content auth">
      <form id="register" onSubmit={onSubmit}>
        <div className="container">
          <div className="brand-logo"></div>
          <h1>Register</h1>

          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="maria@email.com"
            value={values[registerFormKeys.EMAIL]}
            onChange={onChange}
          />

          <label htmlFor="pass">Password:</label>
          <input
            type="password"
            name="password"
            id="register-password"
            value={values[registerFormKeys.PASSWORD]}
            onChange={onChange}
          />

          <label htmlFor="con-pass">Confirm Password:</label>
          <input
            type="password"
            name="confirm-password"
            id="confirm-password"
            value={values[registerFormKeys.RE_PASSWORD]}
            onChange={onChange}
          />

          <input className="btn submit" type="submit" value="Register" />

          <p className="field">
            <span>
              If you already have profile click <Link to="/login">here</Link>
            </span>
          </p>
        </div>
      </form>
    </section>
  );
}
