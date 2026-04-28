import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmationItem {
  label: string;
  value: string | number;
  icon?: string;
  highlight?: boolean;
}

interface AIConfirmationProps {
  title: string;
  description?: string;
  icon: "warning" | "check" | "info";
  items: ConfirmationItem[];
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  confirmText?: string;
  cancelText?: string;
}

const iconComponents = {
  warning: AlertCircle,
  check: CheckCircle2,
  info: Info,
};

const iconColors = {
  warning: "text-amber-600 dark:text-amber-400",
  check: "text-green-600 dark:text-green-400",
  info: "text-blue-600 dark:text-blue-400",
};

const headerBgColors = {
  warning: "bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800",
  check: "bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800",
  info: "bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800",
};

const buttonColors = {
  warning: "bg-amber-600 hover:bg-amber-700",
  check: "bg-green-600 hover:bg-green-700",
  info: "bg-blue-600 hover:bg-blue-700",
};

export function AIConfirmationModal({
  title,
  description,
  icon,
  items,
  onConfirm,
  onCancel,
  isLoading = false,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
}: AIConfirmationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const IconComponent = iconComponents[icon];

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleConfirm = () => {
    setIsVisible(false);
    setTimeout(onConfirm, 200);
  };

  const handleCancel = () => {
    setIsVisible(false);
    setTimeout(onCancel, 200);
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end sm:items-center justify-center transition-opacity duration-200",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onClick={handleCancel}
    >
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black transition-opacity duration-200",
          isVisible ? "opacity-30" : "opacity-0"
        )}
      />

      {/* Modal */}
      <div
        className={cn(
          "relative bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-md w-full mx-4 sm:mx-0 transition-all duration-300 transform",
          isVisible
            ? "translate-y-0 opacity-100"
            : "translate-y-full sm:translate-y-0 sm:scale-95 opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn("px-6 py-5", headerBgColors[icon])}>
          <div className="flex items-start gap-3">
            <IconComponent className={cn("w-6 h-6 flex-shrink-0 mt-1", iconColors[icon])} />
            <div className="flex-1 min-w-0">
              <h2 className={cn(
                "text-lg font-bold tracking-tight",
                icon === "warning" && "text-amber-900 dark:text-amber-100",
                icon === "check" && "text-green-900 dark:text-green-100",
                icon === "info" && "text-blue-900 dark:text-blue-100"
              )}>
                {title}
              </h2>
              {description && (
                <p className={cn(
                  "text-sm mt-1 leading-snug",
                  icon === "warning" && "text-amber-700 dark:text-amber-300",
                  icon === "check" && "text-green-700 dark:text-green-300",
                  icon === "info" && "text-blue-700 dark:text-blue-300"
                )}>
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-lg",
                  item.highlight
                    ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                    : "bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                )}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {item.icon && (
                    <span className="text-base flex-shrink-0">{item.icon}</span>
                  )}
                  <span className={cn(
                    "text-sm font-medium truncate",
                    item.highlight
                      ? "text-blue-900 dark:text-blue-100"
                      : "text-gray-700 dark:text-gray-300"
                  )}>
                    {item.label}
                  </span>
                </div>
                <span className={cn(
                  "text-sm font-semibold ml-2 flex-shrink-0",
                  item.highlight
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-900 dark:text-white"
                )}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Safety Note */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
            <span className="flex-shrink-0">ℹ️</span>
            <span>Esta acción se ejecutará en tu empresa. Asegúrate de que los datos sean correctos.</span>
          </p>
        </div>

        {/* Buttons */}
        <div className="px-6 py-4 flex gap-3">
          <button
            onClick={handleCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-lg border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-lg text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2",
              buttonColors[icon]
            )}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Procesando...</span>
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
