import { Crown, Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

interface FeaturePreviewOverlayProps {
  featureName: string;
  description: string;
  requiredPlan?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function FeaturePreviewOverlay({ 
  featureName, 
  description, 
  requiredPlan = "Pro",
  icon: Icon = Lock 
}: FeaturePreviewOverlayProps) {
  const { company, subscription } = useAuth();
  
  const currentPlan = subscription?.plan || 'free';
  const companyAlias = company?.companyAlias || 'test';

  const planColors = {
    free: 'bg-gray-500',
    basic: 'bg-blue-500',
    pro: 'bg-purple-500',
    master: 'bg-yellow-500'
  };

  const planLabels = {
    free: 'Free',
    basic: 'Basic',
    pro: 'Pro',
    master: 'Master'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg mx-auto shadow-2xl border-2 border-amber-200">
        <CardContent className="p-8 text-center space-y-6">
          {/* Icon and Title */}
          <div className="flex flex-col items-center space-y-4">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
              <Icon className="w-10 h-10 text-amber-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Vista Previa de {featureName}
              </h2>
              <p className="text-gray-600">{description}</p>
            </div>
          </div>

          {/* Plan Information */}
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <div className="flex items-center justify-center space-x-2 mb-3">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Plan actual:</span>
                <span className={`px-3 py-1 rounded-full text-white text-sm font-medium ${planColors[currentPlan as keyof typeof planColors]}`}>
                  {planLabels[currentPlan as keyof typeof planLabels]}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Requiere:</span>
                <span className={`px-3 py-1 rounded-full text-white text-sm font-medium ${planColors[requiredPlan.toLowerCase() as keyof typeof planColors]}`}>
                  {requiredPlan}
                </span>
              </div>
            </div>
            <p className="text-amber-800 text-sm font-medium">
              Esta es una vista previa de cómo se vería esta funcionalidad con tu plan {requiredPlan}.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Link href={`/${companyAlias}/inicio`} className="flex-1">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al Inicio
              </Button>
            </Link>
            <Link href={`/${companyAlias}/configuracion`} className="flex-1">
              <Button className="w-full bg-amber-600 hover:bg-amber-700">
                <Crown className="w-4 h-4 mr-2" />
                Actualizar Plan
              </Button>
            </Link>
          </div>

          {/* Additional Information */}
          <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded-lg">
            <p>Los datos mostrados son de demostración.</p>
            <p className="mt-1">Contacta con tu administrador para actualizar el plan y acceder a todas las funcionalidades.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default FeaturePreviewOverlay;