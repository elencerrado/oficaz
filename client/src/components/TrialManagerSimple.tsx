import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PaymentMethodManager } from "./PaymentMethodManager";
import { useAuth } from "@/hooks/use-auth";

interface TrialStatus {
  isTrialActive: boolean;
  daysRemaining: number;
  trialEndDate: string;
  nextPaymentDate: string;
  status: string;
  plan: string;
  hasPaymentMethod: boolean;
  isBlocked: boolean;
}


export function TrialManagerSimple() {
  const queryClient = useQueryClient();
  const { subscription } = useAuth();

  // Fetch trial status - trial rarely changes, use long cache
  const { data: trialStatus, isLoading: loadingTrial } = useQuery<TrialStatus>({
    queryKey: ['/api/account/trial-status'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes - trial status rarely changes
  });

  // Fetch payment methods
  const { data: paymentMethods } = useQuery<any[]>({
    queryKey: ['/api/account/payment-methods'],
    staleTime: 30 * 1000,
  });

  const getPlanPrice = (): string => {
    // Use custom monthly price if available (regardless of useCustomSettings)
    if (subscription?.customMonthlyPrice) {
      const customPrice = Number(subscription.customMonthlyPrice);
      if (customPrice > 0) {
        return customPrice.toFixed(2);
      }
    }
    // Default Oficaz plan price
    return '39.00';
  };

  if (loadingTrial) {
    return (
      <Card>
        <div className="p-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </Card>
    );
  }

  if (!trialStatus) return null;

  // If account is blocked, don't show (handled elsewhere)
  if (trialStatus.isBlocked) {
    return null;
  }

  // Determine display based on trial status
  const isActivePaidAccount = trialStatus.status === 'active' && !trialStatus.isTrialActive;
  const isActiveTrial = trialStatus.status === 'trial' && trialStatus.isTrialActive;

  if (!isActivePaidAccount && !isActiveTrial) {
    return null;
  }

  // For active paid accounts, don't show any notification
  if (isActivePaidAccount) {
    return null;
  }

  // For active trial, show trial notification
  return (
    <div className={`rounded-lg border p-4 transition-colors ${
      trialStatus.daysRemaining <= 3 
        ? "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800/50" 
        : "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800/50"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-full transition-colors ${
            trialStatus.daysRemaining <= 3 
              ? "bg-amber-100 dark:bg-amber-900/50" 
              : "bg-blue-100 dark:bg-blue-900/50"
          }`}>
            <Clock className={`w-4 h-4 ${
              trialStatus.daysRemaining <= 3 
                ? "text-amber-600 dark:text-amber-400" 
                : "text-blue-600 dark:text-blue-400"
            }`} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-foreground">
                Período de Prueba Oficaz
              </span>
              <Badge variant="outline" className={`text-xs border-current ${
                trialStatus.daysRemaining <= 3
                  ? "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30"
                  : "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30"
              }`}>
                {trialStatus.daysRemaining} días restantes
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {trialStatus.hasPaymentMethod ? (
                `Período de prueba activo. Se cobrará el ${new Date(trialStatus.trialEndDate).toLocaleDateString('es-ES')} • €${getPlanPrice()}/mes`
              ) : trialStatus.daysRemaining <= 3 ? (
                "Período de prueba termina pronto. Añade un método de pago para continuar"
              ) : (
                `Período de prueba hasta el ${new Date(trialStatus.trialEndDate).toLocaleDateString('es-ES')} • €${getPlanPrice()}/mes después`
              )}
            </p>
          </div>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              variant="ghost"
              size="sm"
              className={`text-xs transition-colors ${
                trialStatus.daysRemaining <= 3 
                  ? "text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30" 
                  : "text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/30"
              }`}
            >
              <Plus className="w-3 h-3 mr-1" />
              Añadir pago
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Gestionar métodos de pago</DialogTitle>
              <DialogDescription>
                Añade un método de pago para continuar usando Oficaz cuando termine tu período de prueba.
              </DialogDescription>
            </DialogHeader>
            <PaymentMethodManager paymentMethods={paymentMethods || []} />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}