'use client';

import { useEffect, useState } from 'react';
import estilos from './ClienteWraper.module.css';

export default function ClienteWrapper({ children }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    setMontado(true);
  }, []);
  // En el servidor o durante la hidratación, retorna un placeholder
  if (!montado) {
    return <div className={estilos.headerPlaceholder}></div>;
  }
  // Una vez montado en el cliente, muestra el contenido real
  return children;
}