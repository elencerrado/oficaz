import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Users, MousePointerClick, UserPlus, TestTube, CreditCard, ArrowRight } from 'lucide-react';

interface CampaignConversionsDialogProps {
  campaign: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CampaignConversionsDialog({ campaign, open, onOpenChange }: CampaignConversionsDialogProps) {
  const { data: conversions, isLoading } = useQuery({
    queryKey: [`/api/super-admin/email-campaigns/${campaign?.id}/conversions`],
    queryFn: async () => {
      const token = localStorage.getItem('superAdminToken');
      const response = await fetch(`/api/super-admin/email-campaigns/${campaign.id}/conversions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch conversions');
      return response.json();
    },
    enabled: !!campaign && open,
    staleTime: 30000,
  });

  const funnelSteps = conversions ? [
    {
      icon: Users,
      label: 'Enviados',
      value: conversions.funnel.sent,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      percentage: 100,
    },
    {
      icon: MousePointerClick,
      label: 'Clicks',
      value: conversions.funnel.clicked,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      percentage: conversions.rates.clickRate,
    },
    {
      icon: UserPlus,
      label: 'Registros',
      value: conversions.funnel.registered,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      percentage: conversions.rates.registrationRate,
    },
    {
      icon: TestTube,
      label: 'En Prueba',
      value: conversions.funnel.trials,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      percentage: conversions.rates.trialRate,
    },
    {
      icon: CreditCard,
      label: 'Pagando',
      value: conversions.funnel.paid,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/20',
      percentage: conversions.rates.paidRate,
    },
  ] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white border-white/20">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Embudo de Conversión
          </DialogTitle>
          <DialogDescription className="text-white/70">
            {campaign?.name} - Seguimiento completo desde emails hasta suscripciones
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center">
            <div className="animate-spin mx-auto h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
            <p className="mt-4 text-white/60">Cargando estadísticas...</p>
          </div>
        ) : conversions ? (
          <div className="space-y-6">
            {/* Overall Conversion Rate */}
            <Card className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-white/60">Tasa de Conversión Total</p>
                      <p className="text-3xl font-bold text-white">
                        {conversions.rates.overallConversionRate}%
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white/60">De {conversions.funnel.sent} enviados</p>
                    <p className="text-lg font-semibold text-emerald-400">
                      {conversions.funnel.paid} pagando
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Funnel Visualization */}
            <div className="space-y-3">
              {funnelSteps.map((step, index) => {
                const Icon = step.icon;
                const nextStep = funnelSteps[index + 1];
                const conversionRate = nextStep ? nextStep.percentage : 0;
                
                return (
                  <div key={step.label} className="space-y-2">
                    <Card className={`border-white/20 hover:border-white/30 transition-all ${step.bgColor}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <div className={`p-2 rounded-lg ${step.bgColor}`}>
                              <Icon className={`h-5 w-5 ${step.color}`} />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-white/60">{step.label}</p>
                              <div className="flex items-center gap-4 mt-1">
                                <p className="text-2xl font-bold text-white">{step.value}</p>
                                {index > 0 && (
                                  <span className={`text-sm font-medium ${step.color}`}>
                                    {step.percentage}% del paso anterior
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {index === 0 && (
                            <div className="text-right">
                              <p className="text-xs text-white/40">Base</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Conversion arrow */}
                    {nextStep && (
                      <div className="flex items-center justify-center py-1">
                        <div className="flex items-center gap-2 text-white/40">
                          <ArrowRight className="h-4 w-4" />
                          <span className="text-xs">
                            {conversionRate > 0 ? `${conversionRate}% convierte` : 'Sin conversiones'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Companies List */}
            {conversions.companies && conversions.companies.length > 0 && (
              <Card className="bg-white/5 border-white/20">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Empresas Registradas ({conversions.companies.length})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {conversions.companies.map((company: any) => (
                      <div
                        key={company.companyId}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            company.subscriptionStatus === 'active' ? 'bg-emerald-400' :
                            company.subscriptionStatus === 'trial' ? 'bg-yellow-400' :
                            'bg-gray-400'
                          }`} />
                          <span className="text-sm text-white/80">Empresa #{company.companyId}</span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          company.subscriptionStatus === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                          company.subscriptionStatus === 'trial' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {company.subscriptionStatus === 'active' ? 'Pagando' :
                           company.subscriptionStatus === 'trial' ? 'En Prueba' :
                           company.subscriptionStatus || 'Desconocido'}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-white/60">
            No hay datos de conversión disponibles
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
