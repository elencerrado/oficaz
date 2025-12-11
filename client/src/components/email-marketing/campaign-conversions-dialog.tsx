import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Send, Eye, MousePointerClick, UserPlus, CreditCard, ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CampaignConversionsDialogProps {
  campaign: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CampaignConversionsDialog({ campaign, open, onOpenChange }: CampaignConversionsDialogProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const { data: conversions, isLoading } = useQuery({
    queryKey: [`/api/super-admin/email-campaigns/${campaign?.id}/conversions`],
    queryFn: async () => {
      const token = sessionStorage.getItem('superAdminToken');
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

  const funnelSteps = conversions && conversions.funnel ? [
    {
      id: 'sent',
      icon: Send,
      label: 'Enviados',
      value: conversions.funnel.sent,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      percentage: 100,
      details: conversions.details.sent,
    },
    {
      id: 'opened',
      icon: Eye,
      label: 'Abiertos',
      value: conversions.funnel.opened,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      percentage: conversions.rates.openRate,
      details: conversions.details.opened,
    },
    {
      id: 'clicked',
      icon: MousePointerClick,
      label: 'Clicks',
      value: conversions.funnel.clicked,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/20',
      percentage: conversions.rates.clickRate,
      details: conversions.details.clicked,
    },
    {
      id: 'registered',
      icon: UserPlus,
      label: 'Registrados',
      value: conversions.funnel.registered,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      percentage: conversions.rates.registrationRate,
      details: conversions.details.registered,
    },
    {
      id: 'paid',
      icon: CreditCard,
      label: 'Pagando',
      value: conversions.funnel.paid,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/20',
      percentage: conversions.rates.paidRate,
      details: conversions.details.paid,
    },
  ] : [];

  const toggleStep = (stepId: string) => {
    setExpandedStep(expandedStep === stepId ? null : stepId);
  };

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
            <LoadingSpinner size="md" />
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

            {/* Funnel Visualization with Expandable Details */}
            <div className="space-y-3">
              {funnelSteps.map((step, index) => {
                const Icon = step.icon;
                const nextStep = funnelSteps[index + 1];
                const conversionRate = nextStep ? nextStep.percentage : 0;
                const isExpanded = expandedStep === step.id;
                
                return (
                  <div key={step.id} className="space-y-2">
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
                          {step.value > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleStep(step.id)}
                              className="text-white/70 hover:text-white hover:bg-white/10"
                              data-testid={`button-expand-${step.id}`}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-5 w-5" />
                              ) : (
                                <ChevronRight className="h-5 w-5" />
                              )}
                            </Button>
                          )}
                        </div>

                        {/* Expanded Email List */}
                        {isExpanded && step.details && step.details.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-white/10">
                            <div className="max-h-60 overflow-y-auto space-y-2">
                              {step.details.map((detail: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-2 rounded bg-white/5 hover:bg-white/10 transition-colors"
                                >
                                  <div>
                                    <p className="text-sm text-white">{detail.email}</p>
                                    {detail.name && (
                                      <p className="text-xs text-white/60">{detail.name}</p>
                                    )}
                                  </div>
                                  {detail.timestamp && (
                                    <p className="text-xs text-white/50">
                                      {format(new Date(detail.timestamp), "d MMM, HH:mm", { locale: es })}
                                    </p>
                                  )}
                                  {detail.companyId && (
                                    <p className="text-xs text-white/50">
                                      Empresa #{detail.companyId}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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
