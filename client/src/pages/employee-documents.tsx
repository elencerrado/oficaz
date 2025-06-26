import { useFeatureCheck } from "@/hooks/use-feature-check";
import FeatureUnavailable from "@/components/feature-unavailable";

export default function EmployeeDocuments() {
  const { hasAccess } = useFeatureCheck();
  const canAccess = hasAccess('documents');

  if (!canAccess) {
    return <FeatureUnavailable feature="documents" />;
  }

  // Placeholder for when documents are enabled
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-700 via-slate-600 to-slate-700 flex items-center justify-center">
      <div className="text-center p-6">
        <h2 className="text-2xl font-semibold text-white mb-2">Documentos Habilitado</h2>
        <p className="text-white/70">
          La funcionalidad completa de documentos estará disponible aquí.
        </p>
      </div>
    </div>
  );
}