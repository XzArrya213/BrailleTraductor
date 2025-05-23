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

const auth = getAuth(appFirebase);

export default function Form() {
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState(null);

  const authFunction = async (e) => {
    e.preventDefault();
    setError(null);
    const NombreCompleto = e.target.NombreCompleto?.value || null;
    const email = e.target.email.value;
    const password = e.target.password.value;

    try {
      if (registering) {
        await createUserWithEmailAndPassword(auth, email, password)
          .then(async (newUser) => {
            await updateProfile(newUser.user, { displayName: NombreCompleto });
          })
          .catch((err) => {
            if (err.code === "auth/email-already-in-use") {
              setError("Correo ya registrado");
            } else {
              setError("Error al registrarse. Inténtalo de nuevo.");
            }
          });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError("Correo o contraseña incorrectos.");
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      console.log("Usuario autenticado con Google:", user);

      // Verificar si el usuario ya tiene una contraseña asociada
      if (!user.emailVerified) {
        const email = user.email;
        const password = prompt(
          `Has iniciado sesión con Google. Por favor, ingresa tu contraseña para vincularla con tu cuenta:`
        );

        if (password) {
          const credential = EmailAuthProvider.credential(email, password);
          await linkWithCredential(user, credential);
          alert(
            "Cuenta vinculada correctamente. Ahora puedes iniciar sesión con tu correo y contraseña."
          );
        }
      }
    } catch (err) {
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
