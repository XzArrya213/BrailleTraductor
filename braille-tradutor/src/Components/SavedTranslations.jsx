import React, { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import { getDatabase, ref, onValue, remove } from "firebase/database";
import { useNavigate } from "react-router-dom";

export default function SavedTranslations({ onSelect, onClose }) {
  const navigate = useNavigate();
  const auth = getAuth();
  const db = getDatabase();
  const [translations, setTranslations] = useState([]);

  useEffect(() => {
    // Verificar autenticación
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate("/");
        return;
      }
    });

    if (!auth.currentUser) return;

    const userTranslationsRef = ref(
      db,
      `users/${auth.currentUser.uid}/translations`
    );

    const unsubscribe = onValue(
      userTranslationsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          // Agregar console.log para depuración
          console.log("Datos recuperados:", snapshot.val());

          const data = snapshot.val();
          const translationsArray = Object.entries(data)
            .map(([id, translation]) => ({
              id,
              ...translation,
            }))
            .sort((a, b) => b.timestamp - a.timestamp);

          setTranslations(translationsArray);
        } else {
          console.log("No hay traducciones guardadas");
          setTranslations([]);
        }
      },
      (error) => {
        console.error("Error al cargar traducciones:", error);
      }
    );

    return () => {
      unsubscribe();
      unsubscribeAuth();
    };
  }, [auth, db, navigate]);

  const handleDelete = async (id) => {
    try {
      await remove(ref(db, `users/${auth.currentUser.uid}/translations/${id}`));
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert("Error al eliminar la traducción");
    }
  };

  return (
    <div className="fixed right-0 top-0 h-screen w-80 bg-white shadow-lg z-50 overflow-hidden">
      <div className="p-4 bg-[#4C9FE2] text-white flex justify-between items-center">
        <h2 className="text-xl font-bold">Traducciones Guardadas</h2>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 text-xl font-bold"
        >
          ×
        </button>
      </div>

      <div className="overflow-y-auto h-[calc(100vh-64px)] p-4">
        {translations.length === 0 ? (
          <p className="text-gray-500 text-center">
            No hay traducciones guardadas
          </p>
        ) : (
          translations.map((translation) => (
            <div
              key={translation.id}
              className="mb-4 p-4 bg-gray-50 rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <p className="font-medium truncate">{translation.original}</p>
                  <p className="text-gray-600 text-sm truncate">
                    {translation.translated}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {new Date(translation.timestamp).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onSelect(translation)}
                    className="text-[#4C9FE2] hover:text-[#0056b3] text-sm"
                  >
                    Usar
                  </button>
                  <button
                    onClick={() => handleDelete(translation.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
