import { useQuery } from '@tanstack/react-query';
import { ClockWidget } from '@/components/time-tracking/clock-widget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function TimeTracking() {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['/api/work-sessions'],
  });

  const { data: stats } = useQuery({
    queryKey: ['/api/dashboard/stats'],
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
          <div className="h-96 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Time Tracking</h1>
        <p className="text-gray-500 mt-1">
          Track your work hours and view your time history.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Weekly Summary */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="text-oficaz-primary" />
              </div>
              <div>
                <p className="text-sm text-gray-500">This Week</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats?.weekHours || '0.0'}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today Summary */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Clock className="text-oficaz-success" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Today</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats?.todayHours || '0.0'}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Status */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${
                stats?.currentSession ? 'bg-oficaz-success animate-pulse-green' : 'bg-gray-400'
              }`}></div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="text-lg font-semibold text-gray-900">
                  {stats?.currentSession ? 'Clocked In' : 'Not Working'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clock Widget */}
        <div>
          <ClockWidget />
        </div>

        {/* Time History */}
        <Card>
          <CardHeader>
            <CardTitle>Time History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sessions?.length > 0 ? (
                sessions.map((session: any) => (
                  <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">
                        {format(new Date(session.createdAt), 'MMM d, yyyy')}
                      </p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(session.clockIn), 'h:mm a')} - {
                          session.clockOut 
                            ? format(new Date(session.clockOut), 'h:mm a')
                            : 'In Progress'
                        }
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {session.totalHours ? `${parseFloat(session.totalHours).toFixed(1)}h` : 'Active'}
                      </p>
                      <Badge 
                        variant={session.status === 'active' ? 'default' : 'secondary'}
                        className={session.status === 'active' ? 'bg-oficaz-primary' : ''}
                      >
                        {session.status === 'active' ? 'In Progress' : 'Complete'}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="mx-auto mb-4" size={48} />
                  <p>No time entries yet</p>
                  <p className="text-sm">Clock in to start tracking your time</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
