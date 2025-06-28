import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PaymentMethodManager } from "./PaymentMethodManager";

interface TrialStatus {
  isTrialActive: boolean;
  daysRemaining: number;
  trialEndDate: string;
  status: string;
  plan: string;
  hasPaymentMethod: boolean;
  isBlocked: boolean;
}

interface PaymentMethod {
  id: number;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export function TrialManagerSimple() {
  const queryClient = useQueryClient();

  // Fetch trial status
  const { data: trialStatus, isLoading: loadingTrial } = useQuery<TrialStatus>({
    queryKey: ['/api/account/trial-status'],
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  // Fetch subscription plans for price display
  const { data: subscriptionPlans } = useQuery({
    queryKey: ['/api/subscription-plans'],
    staleTime: 300 * 1000,
  });

  // Fetch payment methods
  const { data: paymentMethods } = useQuery<PaymentMethod[]>({
    queryKey: ['/api/account/payment-methods'],
    staleTime: 30 * 1000,
  });

  const getPlanPrice = (planName: string): number => {
    if (!subscriptionPlans) return 0;
    const plan = subscriptionPlans.find((p: any) => p.name.toLowerCase() === planName.toLowerCase());
    return plan ? plan.pricePerUser : 0;
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

  // If account is active (paid), show success status
  if (trialStatus.status === 'active' && !trialStatus.isTrialActive) {
    return null; // Don't show anything for active accounts
  }

  // If account is blocked or trial expired, don't show (handled elsewhere)
  if (trialStatus.isBlocked || !trialStatus.isTrialActive) {
    return null;
  }

  // If trial is active, show discrete notification about adding payment method
  return (
    <div className={`rounded-lg border p-4 ${trialStatus.daysRemaining <= 3 ? "bg-amber-50/50 border-amber-200/50" : "bg-blue-50/30 border-blue-200/50"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-full ${trialStatus.daysRemaining <= 3 ? "bg-amber-100" : "bg-blue-100"}`}>
            <Clock className={`w-4 h-4 ${trialStatus.daysRemaining <= 3 ? "text-amber-600" : "text-blue-600"}`} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900">
                Plan {trialStatus.plan.charAt(0).toUpperCase() + trialStatus.plan.slice(1)}
              </span>
              <Badge variant="outline" className="text-xs">
                {trialStatus.daysRemaining} días restantes
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {trialStatus.daysRemaining <= 3 ? (
                "Añade un método de pago para continuar sin interrupciones"
              ) : (
                `Expira el ${new Date(trialStatus.trialEndDate).toLocaleDateString('es-ES')} • €${getPlanPrice(trialStatus.plan)}/mes`
              )}
            </p>
          </div>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              variant="ghost"
              size="sm"
              className={`text-xs ${trialStatus.daysRemaining <= 3 ? "text-amber-700 hover:text-amber-800 hover:bg-amber-100" : "text-blue-700 hover:text-blue-800 hover:bg-blue-100"}`}
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