import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Crown, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Link } from 'wouter';

interface FeatureRestrictedPageProps {
  featureName: string;
  description: string;
  requiredPlan?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function FeatureRestrictedPage({ 
  featureName, 
  description, 
  requiredPlan = "Pro",
  icon: Icon = Lock 
}: FeatureRestrictedPageProps) {
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900">
            Funcionalidad No Disponible
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div>
            <h3 className="font-medium text-lg text-gray-900 mb-2">{featureName}</h3>
            <p className="text-gray-600 text-sm">{description}</p>
          </div>

          <div className="text-sm text-gray-500 p-3 bg-blue-50 rounded-lg">
            <p>Esta funcionalidad no está disponible en tu plan actual.</p>
            <p className="mt-1">Contacta con tu administrador para más información.</p>
          </div>

          <div className="flex gap-2">
            <Link href={`/${companyAlias}/inicio`} className="flex-1">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al Inicio
              </Button>
            </Link>
            <Link href={`/${companyAlias}/configuracion`} className="flex-1">
              <Button className="w-full bg-oficaz-primary hover:bg-oficaz-primary/90">
                <Crown className="w-4 h-4 mr-2" />
                Ver Planes
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default FeatureRestrictedPage;