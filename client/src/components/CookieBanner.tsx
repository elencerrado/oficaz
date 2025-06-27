import React, { useState, useEffect } from 'react';
import { X, Cookie, Settings, Shield, BarChart3, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';

interface CookiePreferences {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

const CookieBanner = () => {
  const { isAuthenticated } = useAuth();
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false
  });

  useEffect(() => {
    // No mostrar banner a usuarios autenticados
    if (isAuthenticated) {
      setShowBanner(false);
      return;
    }

    const cookieConsent = localStorage.getItem('oficaz-cookie-consent');
    if (!cookieConsent) {
      setShowBanner(true);
    } else {
      const savedPreferences = JSON.parse(cookieConsent);
      setPreferences(savedPreferences);
      applyCookieSettings(savedPreferences);
    }
  }, [isAuthenticated]);

  const applyCookieSettings = (prefs: CookiePreferences) => {
    if (prefs.analytics) {
      console.log('Analytics cookies enabled');
    } else {
      console.log('Analytics cookies disabled');
    }
    
    if (prefs.marketing) {
      console.log('Marketing cookies enabled');
    } else {
      console.log('Marketing cookies disabled');
    }
    
    if (prefs.functional) {
      console.log('Functional cookies enabled');
    } else {
      console.log('Functional cookies disabled');
    }
    
    console.log('Cookie preferences applied:', prefs);
  };

  const savePreferences = (prefs: CookiePreferences) => {
    localStorage.setItem('oficaz-cookie-consent', JSON.stringify(prefs));
    localStorage.setItem('oficaz-cookie-consent-date', new Date().toISOString());
    applyCookieSettings(prefs);
    setShowBanner(false);
    setShowSettings(false);
  };

  const acceptAll = () => {
    const allAccepted = {
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true
    };
    setPreferences(allAccepted);
    savePreferences(allAccepted);
  };

  const acceptNecessary = () => {
    const necessaryOnly = {
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false
    };
    setPreferences(necessaryOnly);
    savePreferences(necessaryOnly);
  };

  const saveCustomPreferences = () => {
    savePreferences(preferences);
  };

  const updatePreference = (key: keyof CookiePreferences, value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Overlay */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
      )}

      {/* Cookie Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#007AFF]/10 rounded-lg flex items-center justify-center">
                    <Cookie className="w-5 h-5 text-[#007AFF]" />
                  </div>
                  <CardTitle className="text-xl">Configuración de Cookies</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-sm text-gray-600">
                <p className="mb-4">
                  Utilizamos cookies para mejorar tu experiencia en nuestra plataforma. 
                  Puedes configurar qué tipos de cookies aceptas a continuación.
                </p>
                <p className="text-xs text-gray-500">
                  Última actualización: 26 de junio de 2025
                </p>
              </div>

              <Separator />

              {/* Cookies Necesarias */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-green-500" />
                    <div>
                      <h3 className="font-medium">Cookies Necesarias</h3>
                      <p className="text-sm text-gray-500">Requeridas para el funcionamiento básico</p>
                    </div>
                  </div>
                  <Switch
                    checked={preferences.necessary}
                    disabled={true}
                  />
                </div>
                <p className="text-xs text-gray-500 ml-8">
                  Estas cookies son esenciales para el funcionamiento de la plataforma. 
                  Incluyen autenticación, seguridad y funcionalidades básicas.
                </p>
              </div>

              <Separator />

              {/* Cookies Funcionales */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-blue-500" />
                    <div>
                      <h3 className="font-medium">Cookies Funcionales</h3>
                      <p className="text-sm text-gray-500">Mejoran la experiencia de usuario</p>
                    </div>
                  </div>
                  <Switch
                    checked={preferences.functional}
                    onCheckedChange={(checked) => updatePreference('functional', checked)}
                  />
                </div>
                <p className="text-xs text-gray-500 ml-8">
                  Permiten recordar tus preferencias como idioma, tema, configuraciones 
                  de la interfaz y otros ajustes personalizados.
                </p>
              </div>

              <Separator />

              {/* Cookies de Análisis */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-5 h-5 text-purple-500" />
                    <div>
                      <h3 className="font-medium">Cookies de Análisis</h3>
                      <p className="text-sm text-gray-500">Nos ayudan a mejorar el servicio</p>
                    </div>
                  </div>
                  <Switch
                    checked={preferences.analytics}
                    onCheckedChange={(checked) => updatePreference('analytics', checked)}
                  />
                </div>
                <p className="text-xs text-gray-500 ml-8">
                  Recopilan información anónima sobre cómo usas la plataforma para 
                  ayudarnos a mejorar nuestros servicios y detectar errores.
                </p>
              </div>

              <Separator />

              {/* Cookies de Marketing */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Target className="w-5 h-5 text-orange-500" />
                    <div>
                      <h3 className="font-medium">Cookies de Marketing</h3>
                      <p className="text-sm text-gray-500">Personalización de contenido</p>
                    </div>
                  </div>
                  <Switch
                    checked={preferences.marketing}
                    onCheckedChange={(checked) => updatePreference('marketing', checked)}
                  />
                </div>
                <p className="text-xs text-gray-500 ml-8">
                  Utilizadas para mostrarte contenido relevante y personalizado 
                  en base a tus intereses y comportamiento.
                </p>
              </div>

              <Separator />

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={saveCustomPreferences}
                  className="flex-1 bg-[#007AFF] hover:bg-[#0056CC]"
                >
                  Guardar Preferencias
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSettings(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>

              <div className="text-xs text-gray-500 text-center">
                <p>
                  Puedes cambiar estas preferencias en cualquier momento desde la 
                  configuración de tu cuenta o visitando nuestra{' '}
                  <a href="/privacy" className="text-[#007AFF] hover:underline">
                    Política de Privacidad
                  </a>.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cookie Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-white border-t shadow-2xl">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-8 h-8 bg-[#007AFF]/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <Cookie className="w-4 h-4 text-[#007AFF]" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 mb-1">
                  Uso de Cookies en Oficaz
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Utilizamos cookies propias y de terceros para mejorar tu experiencia, 
                  personalizar contenido y analizar el uso de nuestra plataforma. 
                  Al continuar navegando, aceptas nuestra{' '}
                  <a href="/cookies" className="text-[#007AFF] hover:underline font-medium">
                    Política de Cookies
                  </a>{' '}
                  y{' '}
                  <a href="/privacy" className="text-[#007AFF] hover:underline font-medium">
                    Política de Privacidad
                  </a>.
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Configurar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={acceptNecessary}
              >
                Solo Necesarias
              </Button>
              <Button
                size="sm"
                onClick={acceptAll}
                className="bg-[#007AFF] hover:bg-[#0056CC] text-white"
              >
                Aceptar Todas
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CookieBanner;