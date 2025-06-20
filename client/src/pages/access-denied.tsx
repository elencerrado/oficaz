import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import oficazLogo from "@assets/Imagotipo Oficaz white_1750407614936.png";

export default function AccessDenied() {
  const [, setLocation] = useLocation();
  const params = useParams<{ companyAlias: string }>();

  useEffect(() => {
    // Redirigir al inicio después de 3 segundos
    const timer = setTimeout(() => {
      const companyAlias = params.companyAlias || "test";
      setLocation(`/${companyAlias}/inicio`);
    }, 3000);

    return () => clearTimeout(timer);
  }, [setLocation, params]);

  return (
    <div className="min-h-screen bg-gradient-radial from-[#323A46] to-[#232B36] flex items-center justify-center p-4">
      <div className="text-center">
        {/* Logo de Oficaz */}
        <div className="mb-8">
          <img 
            src={oficazLogo} 
            alt="Oficaz"
            className="mx-auto h-12 w-auto"
          />
        </div>

        {/* Mensaje de error */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-white mb-4">
            Ups, por aquí no hay nada
          </h1>
          <p className="text-gray-300 text-lg">
            Serás redirigido al inicio en unos segundos...
          </p>
        </div>

        {/* Spinner de carga */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-8 h-8 border-2 border-white/20 rounded-full"></div>
            <div className="absolute top-0 left-0 w-8 h-8 border-2 border-white border-r-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    </div>
  );
}