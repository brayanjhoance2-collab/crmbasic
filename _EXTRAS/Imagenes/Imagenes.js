// components/Imagenes.js
'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import estilos from './imagenes.module.css';
export default function Imagenes({ 
  src, 
  alt, 
  priority = false,
  quality = 75,
  fill = true,
  className = '',
  onLoad,
  objectFit = 'cover',
  objectPosition = 'center',
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
}) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [fuenteImagen, setFuenteImagen] = useState('');

  useEffect(() => {
    const formatearYValidarUrl = (url) => {
      try {
        if (url.startsWith('/https')) {
          url = url.slice(1);
        }
        new URL(url);
        return url;
      } catch (e) {
        return url.startsWith('/') ? url : `/${url}`;
      }
    };

    setFuenteImagen(formatearYValidarUrl(src));
  }, [src]);

  const manejarCarga = (e) => {
    setCargando(false);
    if (onLoad) onLoad(e);
  };
  
  const manejarError = () => {
    setError(true);
    setCargando(false);
  };

  if (error) {
    return (
      <div className={`${estilos.contenedorError} ${className}`}>
        <span className={estilos.textoError}>Error</span>
      </div>
    );
  }
  
  return (
    <div className={`${estilos.contenedor} ${className}`}>
      {cargando && (
        <div className={estilos.esqueleto}></div>
      )}
      {fuenteImagen && (
        <div className={`${estilos.contenedorImagen} ${cargando ? estilos.cargando : ''}`}>
          <Image
            src={fuenteImagen}
            alt={alt}
            fill={fill}
            quality={quality}
            priority={priority}
            sizes={sizes}
            onLoad={manejarCarga}
            onError={manejarError}
            style={{
              objectFit,
              objectPosition
            }}
            className={estilos.imagen}
          />
        </div>
      )}
    </div>
  );
}