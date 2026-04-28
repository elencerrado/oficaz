import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Briefcase,
  Calendar,
  CalendarClock,
  CalendarDays,
  Calculator,
  Clock,
  CreditCard,
  FileText,
  FolderOpen,
  LayoutGrid,
  Mail,
  MessageCircle,
  Package,
  Sparkles,
  Store,
  Users,
  Users2,
} from 'lucide-react';

const ADDON_ICON_BY_KEY: Record<string, LucideIcon> = {
  employees: Users,
  crm: Briefcase,
  accounting: CreditCard,
  ai_assistant: Sparkles,
  work_reports: FileText,
  messages: MessageCircle,
  reminders: Bell,
  documents: FolderOpen,
  time_tracking: Clock,
  vacation: CalendarDays,
  schedules: LayoutGrid,
  inventory: Package,
};

const LEGACY_ICON_BY_NAME: Record<string, LucideIcon> = {
  Users,
  Users2,
  Clock,
  Calendar,
  CalendarClock,
  CalendarDays,
  Mail,
  Bell,
  FileText,
  Sparkles,
  Package,
  Calculator,
};

export function getAddonIconComponent(addonKey: string, iconName?: string | null): LucideIcon {
  if (ADDON_ICON_BY_KEY[addonKey]) {
    return ADDON_ICON_BY_KEY[addonKey];
  }
  if (iconName && LEGACY_ICON_BY_NAME[iconName]) {
    return LEGACY_ICON_BY_NAME[iconName];
  }
  return Store;
}

export function getAddonColorClasses(addonKey: string, isFreeFeature: boolean = false): string {
  if (isFreeFeature) {
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  }

  switch (addonKey) {
    case 'employees':
      return 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400';
    case 'crm':
      return 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400';
    case 'accounting':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'ai_assistant':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'work_reports':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'messages':
      return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
    case 'reminders':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'documents':
      return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400';
    case 'time_tracking':
      return 'bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-300';
    case 'vacation':
      return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
    case 'schedules':
      return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
    case 'inventory':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  }
}
