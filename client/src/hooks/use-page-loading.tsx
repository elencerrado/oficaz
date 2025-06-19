import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';

export function usePageLoading() {
  const [location] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Cargando...');

  useEffect(() => {
    // Mostrar loading al cambiar de ruta
    setIsLoading(true);
    
    // Personalizar mensaje según la ruta
    if (location.includes('horasempleados')) {
      setLoadingMessage('Cargando fichajes...');
    } else if (location.includes('dashboard')) {
      setLoadingMessage('Cargando panel...');
    } else if (location.includes('settings')) {
      setLoadingMessage('Cargando configuración...');
    } else if (location.includes('documents')) {
      setLoadingMessage('Cargando documentos...');
    } else if (location.includes('vacation-requests')) {
      setLoadingMessage('Cargando vacaciones...');
    } else if (location.includes('messages')) {
      setLoadingMessage('Cargando mensajes...');
    } else {
      setLoadingMessage('Cargando...');
    }

    // Simular tiempo de carga para mostrar el spinner
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [location]);

  return { isLoading, loadingMessage };
}