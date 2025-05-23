import React, { useState } from 'react';
import styled from 'styled-components';



// Estilo del contenedor principal
const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 50px;
  padding: 20px;
  background-color: #f4f4f9;
  border-radius: 8px;
`;

// Estilo del área de texto
const TextArea = styled.textarea`
  width: 80%;
  height: 100px;
  margin: 20px 0;
  padding: 10px;
  border-radius: 5px;
  border: 1px solid #ccc;
`;

// Estilo del botón
const Button = styled.button`
  padding: 10px 20px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  &:hover {
    background-color: #45a049;
  }
`;

// Componente principal
const BrailleTranslator = () => {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');

  const handleTranslate = () => {
    // Aquí puedes agregar la lógica para traducir a Braille
    setOutputText(inputText); // Solo como ejemplo
  };

  return (
    <Container>
      <h1>Traductor de Braille</h1>
      <TextArea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="Escribe el texto aquí"
      />
      <Button onClick={handleTranslate}>Traducir</Button>
      <h2>Resultado:</h2>
      <p>{outputText}</p>
    </Container>
  );
};

export default BrailleTranslator;
