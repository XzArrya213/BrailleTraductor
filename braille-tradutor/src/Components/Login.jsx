// DEPRECATED: Este componente no se usa. El control de autenticación y renderizado está en App.js.

import appFirebase from "../credenciales";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import Form from "./Form";

const auth = getAuth(appFirebase);

function Login() {
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  };

  return (
    <div className="bg-[#232323] min-h-screen flex justify-center items-center">
      <Form onGoogleSignIn={handleGoogleSignIn} />
    </div>
  );
}

export default Login;
