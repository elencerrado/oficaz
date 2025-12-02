import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, ArrowLeft, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Link } from 'wouter';

interface FeatureRestrictedPageProps {
  featureName: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function FeatureRestrictedPage({ 
  featureName, 
  description, 
  icon: Icon = Lock 
}: FeatureRestrictedPageProps) {
  const { company } = useAuth();
  const companyAlias = company?.companyAlias || 'test';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Funcionalidad No Disponible
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div>
            <h3 className="font-medium text-lg text-gray-900 dark:text-gray-100 mb-2">{featureName}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{description}</p>
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <p>Esta funcionalidad requiere un complemento adicional.</p>
            <p className="mt-1">Visita la Tienda de Complementos para activarla.</p>
          </div>

          <div className="space-y-2">
            <Link href={`/${companyAlias}/tienda`}>
              <Button className="w-full">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Ir a la Tienda
              </Button>
            </Link>
            <Link href={`/${companyAlias}/inicio`}>
              <Button variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al Inicio
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default FeatureRestrictedPage;
