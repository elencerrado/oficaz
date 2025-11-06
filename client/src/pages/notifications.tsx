import { NotificationSystem } from '@/components/notification-system';
import { usePageTitle } from '@/hooks/use-page-title';

export default function NotificationsPage() {
  usePageTitle('Notificaciones');
  return <NotificationSystem />;
}