import { useState } from "react";
import appFirebase from "../credenciales";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  updatePassword,
  EmailAuthProvider,
  linkWithCredential,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";

const auth = getAuth(appFirebase);

export default function Form() {
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const authFunction = async (e) => {
    e.preventDefault();
    setError(null);
    const NombreCompleto = e.target.NombreCompleto?.value || null;
    const email = e.target.email.value;
    const password = e.target.password.value;

    try {
      if (registering) {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        await updateProfile(userCredential.user, {
          displayName: NombreCompleto,
        });
        navigate("/", { replace: true });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        navigate("/", { replace: true });
      }
    } catch (err) {
      console.error("Error de autenticación:", err);
      setError(
        err.code === "auth/email-already-in-use"
          ? "Correo ya registrado"
          : "Correo o contraseña incorrectos."
      );
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Error al iniciar sesión con Google:", err);
      setError("Error al iniciar sesión con Google.");
    }
  };

  return (
    <div className="h-screen w-screen flex justify-center items-center bg-[#E8EAEB]">
      <div className="bg-white flex flex-col md:flex-row rounded-xl shadow-lg overflow-hidden max-w-4xl w-full">
        {/* Sección de Imagen */}
        <div className="hidden md:flex md:w-1/2 bg-gray-200 justify-center items-center">
          <img
            src={`${process.env.PUBLIC_URL}/fondo-login.jpg`}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>

        {/* Formulario */}
        <div className="w-full md:w-1/2 p-8">
          <h2 className="text-3xl font-bold text-gray-800 text-center mb-6">
            {registering ? "Registrarse" : "Iniciar Sesión"}
          </h2>

          <form className="space-y-5" onSubmit={authFunction}>
            {registering && (
              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Nombre Completo:
                </label>
                <input
                  type="text"
                  name="NombreCompleto"
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#4C9FE2]"
                  placeholder="Tu Nombre"
                />
              </div>
            )}

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Correo:
              </label>
              <input
                type="email"
                name="email"
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#4C9FE2]"
                placeholder="Tu Correo Electrónico"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Contraseña:
              </label>
              <input
                type="password"
                name="password"
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#4C9FE2]"
                placeholder="Tu Contraseña"
              />
            </div>

            {error && (
              <div className="text-red-500 text-center font-semibold">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#4C9FE2] text-white font-bold py-2 px-4 rounded-lg hover:bg-[#0056b3]"
            >
              {registering ? "Registrarse" : "Iniciar Sesión"}
            </button>
          </form>

          <div className="mt-4">
            <button
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-100"
            >
              <img
                src={`${process.env.PUBLIC_URL}/icono google.png`}
                alt="Google Icon"
                className="w-5 h-5 mr-2"
              />
              Continuar con Google
            </button>
          </div>

          <p className="mt-4 text-center">
            {registering ? "¿Ya tienes cuenta?" : "¿No tienes una cuenta?"}{" "}
            <button
              className="text-[#4C9FE2] font-semibold hover:underline"
              onClick={() => setRegistering(!registering)}
            >
              {registering ? "Iniciar Sesión" : "Registrarse"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
