import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import Form from "./Form";

function Login() {
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Error:", error);
      alert("Error al iniciar sesión con Google");
    }
  };

  return (
    <div className="min-h-screen flex justify-center items-center bg-gray-100">
      <Form googleSignIn={handleGoogleSignIn} />
    </div>
  );
}

export default Login;