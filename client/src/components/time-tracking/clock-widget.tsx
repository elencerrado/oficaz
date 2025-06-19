import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export function ClockWidget() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: activeSession, isLoading } = useQuery({
    queryKey: ['/api/work-sessions/active'],
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const clockInMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/work-sessions/clock-in'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: 'Clocked In',
        description: 'Your work session has started.',
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

  const clockOutMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/work-sessions/clock-out'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: 'Clocked Out',
        description: 'Your work session has ended.',
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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatSessionTime = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-lg">
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded-xl mb-2"></div>
            <div className="h-8 bg-gray-200 rounded-xl"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-lg">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Time Tracking</h2>
        
        {/* Current Status */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Current Status</p>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  activeSession ? 'bg-oficaz-success animate-pulse-green' : 'bg-gray-400'
                }`}></div>
                <span className="text-lg font-semibold text-gray-900">
                  {activeSession ? 'Clocked In' : 'Not Clocked In'}
                </span>
              </div>
              {activeSession && (
                <p className="text-sm text-gray-500 mt-1">
                  Since {formatTime(new Date((activeSession as any).clockIn))}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">
                {activeSession ? 'Current Session' : 'Current Time'}
              </p>
              <p className="text-2xl font-bold text-oficaz-primary">
                {activeSession ? formatSessionTime((activeSession as any).clockIn) : formatTime(currentTime)}
              </p>
            </div>
          </div>
        </div>

        {/* Clock In/Out Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button
            onClick={() => clockInMutation.mutate()}
            disabled={!!activeSession || clockInMutation.isPending}
            className={`
              flex flex-col items-center justify-center p-6 h-auto border-2 rounded-2xl
              ${activeSession 
                ? 'border-gray-300 text-gray-400 bg-gray-50 cursor-not-allowed'
                : 'border-oficaz-success text-oficaz-success bg-white hover:bg-green-50'
              }
            `}
            variant="outline"
          >
            <Play className="text-2xl mb-2" />
            <span className="font-semibold">Clock In</span>
            <span className="text-sm opacity-75">Start your workday</span>
          </Button>
          
          <Button
            onClick={() => clockOutMutation.mutate()}
            disabled={!activeSession || clockOutMutation.isPending}
            className={`
              flex flex-col items-center justify-center p-6 h-auto border-2 rounded-2xl
              ${!activeSession 
                ? 'border-gray-300 text-gray-400 bg-gray-50 cursor-not-allowed'
                : 'border-oficaz-error text-oficaz-error bg-white hover:bg-red-50'
              }
            `}
            variant="outline"
          >
            <Square className="text-2xl mb-2" />
            <span className="font-semibold">Clock Out</span>
            <span className="text-sm opacity-75">End your workday</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
