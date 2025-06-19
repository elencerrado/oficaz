import { usePageLoading } from "@/hooks/use-page-loading";
import { PageLoading } from "@/components/ui/page-loading";

interface PageWrapperProps {
  children: React.ReactNode;
}

export function PageWrapper({ children }: PageWrapperProps) {
  const { isLoading, loadingMessage } = usePageLoading();

  if (isLoading) {
    return <PageLoading message={loadingMessage} />;
  }

  return <>{children}</>;
}

export default PageWrapper;