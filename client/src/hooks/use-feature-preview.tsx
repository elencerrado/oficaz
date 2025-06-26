import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { FeaturePreviewOverlay } from '@/components/feature-preview-overlay';
import { type SubscriptionFeatures } from '@/lib/feature-restrictions';

interface UseFeaturePreviewProps {
  feature: keyof SubscriptionFeatures;
  featureName: string;
  description: string;
  requiredPlan: string;
  icon: React.ComponentType<{ className?: string }>;
  demoData?: any;
}

export function useFeaturePreview({
  feature,
  featureName,
  description,
  requiredPlan,
  icon,
  demoData = []
}: UseFeaturePreviewProps) {
  const { hasAccess } = useFeatureCheck();
  const canAccess = hasAccess(feature);
  const showPreview = !canAccess;

  console.log(`useFeaturePreview for ${feature}:`, { canAccess, showPreview, featureName });

  const PreviewOverlay = showPreview ? (
    <FeaturePreviewOverlay
      featureName={featureName}
      description={description}
      requiredPlan={requiredPlan}
      Icon={icon}
    />
  ) : null;

  return {
    canAccess,
    showPreview,
    PreviewOverlay,
    data: canAccess ? undefined : demoData // Solo retorna demo data cuando no tiene acceso
  };
}

export default useFeaturePreview;