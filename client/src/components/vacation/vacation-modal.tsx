import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface VacationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VacationModal({ isOpen, onClose }: VacationModalProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createVacationRequest = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/vacation-requests', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vacation-requests'] });
      toast({
        title: 'Request Submitted',
        description: 'Your vacation request has been submitted for review.',
      });
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setStartDate('');
    setEndDate('');
    setReason('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!startDate || !endDate) {
      toast({
        title: 'Error',
        description: 'Please select both start and end dates.',
        variant: 'destructive',
      });
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast({
        title: 'Error',
        description: 'End date must be after start date.',
        variant: 'destructive',
      });
      return;
    }

    createVacationRequest.mutate({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason: reason.trim() || null,
    });
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Vacation</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || format(new Date(), 'yyyy-MM-dd')}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for vacation request"
            />
          </div>
          
          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createVacationRequest.isPending}
              className="flex-1"
            >
              {createVacationRequest.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
