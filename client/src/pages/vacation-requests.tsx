import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VacationModal } from '@/components/vacation/vacation-modal';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarPlus, Calendar, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function VacationRequests() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['/api/vacation-requests'],
  });

  const { data: companyRequests } = useQuery({
    queryKey: ['/api/vacation-requests/company'],
    enabled: user?.role === 'admin' || user?.role === 'manager',
  });

  const updateRequestMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest('PATCH', `/api/vacation-requests/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests'] });
      toast({
        title: 'Request Updated',
        description: 'The vacation request has been updated.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'denied':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-96 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Vacation Requests</h1>
          <p className="text-gray-500 mt-1">
            Manage your time off requests and view their status.
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <CalendarPlus className="mr-2" size={16} />
          Request Vacation
        </Button>
      </div>

      {/* Summary Card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Calendar className="text-oficaz-primary" />
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                {(user?.vacationDaysTotal || 0) - (user?.vacationDaysUsed || 0)}
              </p>
              <p className="text-sm text-gray-500">Days Remaining</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Check className="text-oficaz-success" />
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                {requests?.filter((r: any) => r.status === 'approved').length || 0}
              </p>
              <p className="text-sm text-gray-500">Approved Requests</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Calendar className="text-oficaz-warning" />
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                {requests?.filter((r: any) => r.status === 'pending').length || 0}
              </p>
              <p className="text-sm text-gray-500">Pending Requests</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Requests */}
        <Card>
          <CardHeader>
            <CardTitle>My Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {requests?.length > 0 ? (
                requests.map((request: any) => (
                  <div key={request.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={getStatusColor(request.status)}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {calculateDays(request.startDate, request.endDate)} days
                      </span>
                    </div>
                    <p className="font-medium text-gray-900">
                      {format(new Date(request.startDate), 'MMM d')} - {format(new Date(request.endDate), 'MMM d, yyyy')}
                    </p>
                    {request.reason && (
                      <p className="text-sm text-gray-600 mt-1">{request.reason}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Submitted {format(new Date(request.createdAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CalendarPlus className="mx-auto mb-4" size={48} />
                  <p>No vacation requests yet</p>
                  <p className="text-sm">Click "Request Vacation" to get started</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Company Requests (Admin/Manager only) */}
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <Card>
            <CardHeader>
              <CardTitle>Team Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {companyRequests?.length > 0 ? (
                  companyRequests.map((request: any) => (
                    <div key={request.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Badge className={getStatusColor(request.status)}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </Badge>
                          <span className="text-sm font-medium text-gray-900">
                            Employee ID: {request.userId}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {calculateDays(request.startDate, request.endDate)} days
                        </span>
                      </div>
                      
                      <p className="font-medium text-gray-900">
                        {format(new Date(request.startDate), 'MMM d')} - {format(new Date(request.endDate), 'MMM d, yyyy')}
                      </p>
                      
                      {request.reason && (
                        <p className="text-sm text-gray-600 mt-1">{request.reason}</p>
                      )}
                      
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-gray-500">
                          Submitted {format(new Date(request.createdAt), 'MMM d, yyyy')}
                        </p>
                        
                        {request.status === 'pending' && (
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateRequestMutation.mutate({ id: request.id, status: 'approved' })}
                              disabled={updateRequestMutation.isPending}
                              className="text-oficaz-success border-oficaz-success hover:bg-green-50"
                            >
                              <Check size={14} className="mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateRequestMutation.mutate({ id: request.id, status: 'denied' })}
                              disabled={updateRequestMutation.isPending}
                              className="text-oficaz-error border-oficaz-error hover:bg-red-50"
                            >
                              <X size={14} className="mr-1" />
                              Deny
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="mx-auto mb-4" size={48} />
                    <p>No team requests</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <VacationModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
