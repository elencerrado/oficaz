import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { PageLoading } from "@/components/ui/page-loading";

export default function NotFound() {
  const { user, company, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;

    if (user && company) {
      const alias = company.companyAlias || 'app';
      if (user.role === 'employee') {
        setLocation(`/${alias}/employee`);
      } else {
        setLocation(`/${alias}/dashboard`);
      }
    } else {
      setLocation('/login');
    }
  }, [user, company, isLoading, setLocation]);

  return <PageLoading />;
}
