import { useFeatureCheck } from "@/hooks/use-feature-check";
import FeatureUnavailable from "@/components/feature-unavailable";

export default function Messages() {
  const { hasAccess } = useFeatureCheck();
  const canAccess = hasAccess('messages');

  if (!canAccess) {
    return <FeatureUnavailable feature="messages" />;
  }

  // Aquí iría la funcionalidad completa de mensajes cuando esté disponible
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Mensajes Habilitado</h2>
        <p className="text-gray-600">
          La funcionalidad completa de mensajes estará disponible aquí.
        </p>
      </div>
    </div>
  );
}