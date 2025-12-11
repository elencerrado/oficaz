import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface RecipientSelectorProps {
  selectedEmails: string[];
  onSelectionChange: (emails: string[]) => void;
  audienceType?: 'subscribers' | 'one_time';
}

export function RecipientSelector({ selectedEmails, onSelectionChange, audienceType = 'one_time' }: RecipientSelectorProps) {
  // Fetch users by category (parallel queries) - force fresh data
  const { data: activeUsers = [], isLoading: loadingActive } = useQuery({
    queryKey: ['/api/super-admin/recipients', 'active'],
    queryFn: async () => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/recipients/active', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch active users');
      return response.json();
    },
    staleTime: 0,
    gcTime: 0
  });

  const { data: trialUsers = [], isLoading: loadingTrial } = useQuery({
    queryKey: ['/api/super-admin/recipients', 'trial'],
    queryFn: async () => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/recipients/trial', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch trial users');
      return response.json();
    },
    staleTime: 0,
    gcTime: 0
  });

  const { data: blockedUsers = [], isLoading: loadingBlocked } = useQuery({
    queryKey: ['/api/super-admin/recipients', 'blocked'],
    queryFn: async () => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/recipients/blocked', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch blocked users');
      return response.json();
    },
    staleTime: 0,
    gcTime: 0
  });

  const { data: cancelledUsers = [], isLoading: loadingCancelled } = useQuery({
    queryKey: ['/api/super-admin/recipients', 'cancelled'],
    queryFn: async () => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/recipients/cancelled', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch cancelled users');
      return response.json();
    },
    staleTime: 0,
    gcTime: 0
  });

  const { data: prospects = [], isLoading: loadingProspects } = useQuery({
    queryKey: ['/api/super-admin/email-prospects'],
    queryFn: async () => {
      const token = sessionStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/email-prospects', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch prospects');
      return response.json();
    },
    staleTime: 0,
    gcTime: 0
  });

  const isLoading = loadingActive || loadingTrial || loadingBlocked || loadingCancelled || loadingProspects;

  const toggleEmail = (email: string) => {
    if (selectedEmails.includes(email)) {
      onSelectionChange(selectedEmails.filter(e => e !== email));
    } else {
      onSelectionChange([...selectedEmails, email]);
    }
  };

  const toggleCategory = (category: any[]) => {
    const categoryEmails = category.map(u => u.email);
    const allSelected = categoryEmails.every(email => selectedEmails.includes(email));
    
    if (allSelected) {
      // Deselect all from this category
      onSelectionChange(selectedEmails.filter(email => !categoryEmails.includes(email)));
    } else {
      // Select all from this category
      const newEmails = [...selectedEmails];
      categoryEmails.forEach(email => {
        if (!newEmails.includes(email)) {
          newEmails.push(email);
        }
      });
      onSelectionChange(newEmails);
    }
  };

  const selectAll = () => {
    // Filtrar usuarios según tipo de audiencia antes de seleccionar todos
    const filteredActiveUsers = audienceType === 'subscribers' 
      ? activeUsers.filter(u => u.marketingConsent === true) 
      : activeUsers;
    const filteredTrialUsers = audienceType === 'subscribers' 
      ? trialUsers.filter(u => u.marketingConsent === true) 
      : trialUsers;
    const filteredBlockedUsers = audienceType === 'subscribers' 
      ? blockedUsers.filter(u => u.marketingConsent === true) 
      : blockedUsers;
    const filteredCancelledUsers = audienceType === 'subscribers' 
      ? cancelledUsers.filter(u => u.marketingConsent === true) 
      : cancelledUsers;
      
    const allEmails = [
      ...filteredActiveUsers.map(u => u.email),
      ...filteredTrialUsers.map(u => u.email),
      ...filteredBlockedUsers.map(u => u.email),
      ...filteredCancelledUsers.map(u => u.email),
      ...prospects.map(p => p.email)
    ];
    onSelectionChange(allEmails);
  };

  const deselectAll = () => {
    onSelectionChange([]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
      </div>
    );
  }

  // Filtrar usuarios según el tipo de audiencia
  const filteredActiveUsers = audienceType === 'subscribers' 
    ? activeUsers.filter(u => u.marketingConsent === true) 
    : activeUsers;
  const filteredTrialUsers = audienceType === 'subscribers' 
    ? trialUsers.filter(u => u.marketingConsent === true) 
    : trialUsers;
  const filteredBlockedUsers = audienceType === 'subscribers' 
    ? blockedUsers.filter(u => u.marketingConsent === true) 
    : blockedUsers;
  const filteredCancelledUsers = audienceType === 'subscribers' 
    ? cancelledUsers.filter(u => u.marketingConsent === true) 
    : cancelledUsers;

  const categories = [
    { key: 'active', label: 'Suscripciones Activas', users: filteredActiveUsers, color: 'blue' },
    { key: 'trial', label: 'En Período de Prueba', users: filteredTrialUsers, color: 'yellow' },
    { key: 'blocked', label: 'Bloqueadas', users: filteredBlockedUsers, color: 'red' },
    { key: 'cancelled', label: 'Canceladas', users: filteredCancelledUsers, color: 'gray' },
    { key: 'prospects', label: 'Prospects Externos', users: prospects, color: 'purple' },
  ];

  const totalEmails = filteredActiveUsers.length + filteredTrialUsers.length + filteredBlockedUsers.length + filteredCancelledUsers.length + prospects.length;
  const allSelected = totalEmails > 0 && selectedEmails.length === totalEmails;

  // Para tipo "subscribers", combinar todos los usuarios en una lista simple
  const allSubscribers = [
    ...filteredActiveUsers,
    ...filteredTrialUsers,
    ...filteredBlockedUsers,
    ...filteredCancelledUsers
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">
          {selectedEmails.length} de {totalEmails} seleccionados
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={allSelected ? deselectAll : selectAll}
          className="text-blue-400 hover:text-blue-300 hover:bg-white/10"
        >
          {allSelected ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
        </Button>
      </div>
      
      {audienceType === 'subscribers' ? (
        // Lista plana para suscritos
        <div className="border border-white/20 rounded-lg bg-white/5 p-4">
          {allSubscribers.length === 0 ? (
            <p className="text-white/60 text-center py-4">No hay usuarios suscritos disponibles</p>
          ) : (
            <div className="space-y-1.5">
              {allSubscribers.map((user: any) => (
                <div 
                  key={user.email}
                  className="flex items-center gap-3 p-2 rounded hover:bg-white/5"
                >
                  <Checkbox
                    checked={selectedEmails.includes(user.email)}
                    onCheckedChange={() => toggleEmail(user.email)}
                    className="border-white/30 data-[state=checked]:bg-blue-600"
                  />
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => toggleEmail(user.email)}
                  >
                    <p className="text-sm text-white truncate">{user.email}</p>
                    {user.companyName && (
                      <p className="text-xs text-white/50 truncate">{user.companyName}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Acordeones para campañas puntuales
        <Accordion type="multiple" className="w-full space-y-2">
          {categories.map(({ key, label, users, color }) => {
            if (users.length === 0) return null;
            
            const categoryEmails = users.map(u => u.email);
            const selectedCount = categoryEmails.filter(email => selectedEmails.includes(email)).length;
            const allSelected = selectedCount === users.length;
            const someSelected = selectedCount > 0 && selectedCount < users.length;
            
            return (
              <AccordionItem 
                key={key} 
                value={key}
                className="border border-white/20 rounded-lg bg-white/5 overflow-hidden"
              >
                <AccordionTrigger className="px-4 py-3 hover:bg-white/5 hover:no-underline">
                  <div className="flex items-center gap-3 w-full">
                    <Checkbox
                      checked={allSelected}
                      data-state={someSelected ? 'indeterminate' : undefined}
                      onCheckedChange={() => toggleCategory(users)}
                      onClick={(e) => e.stopPropagation()}
                      className="border-white/30 data-[state=checked]:bg-blue-600"
                    />
                    <div className="flex-1 text-left">
                      <span className="text-white font-medium">{label}</span>
                      <span className="text-white/60 text-sm ml-2">
                        ({selectedCount}/{users.length})
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3">
                  <div className="space-y-1.5 mt-2">
                    {users.map((user: any) => (
                      <div 
                        key={user.email}
                        className="flex items-center gap-3 p-2 rounded hover:bg-white/5"
                      >
                        <Checkbox
                          checked={selectedEmails.includes(user.email)}
                          onCheckedChange={() => toggleEmail(user.email)}
                          className="border-white/30 data-[state=checked]:bg-blue-600"
                        />
                        <div 
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => toggleEmail(user.email)}
                        >
                          <p className="text-sm text-white truncate">{user.email}</p>
                          {user.companyName && (
                            <p className="text-xs text-white/50 truncate">{user.companyName}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
