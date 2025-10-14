import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';

interface RecipientSelectorProps {
  selectedEmails: string[];
  onSelectionChange: (emails: string[]) => void;
}

export function RecipientSelector({ selectedEmails, onSelectionChange }: RecipientSelectorProps) {
  const { data: usersByStatus, isLoading } = useQuery({
    queryKey: ['/api/super-admin/users-by-subscription-status'],
    queryFn: async () => {
      const token = localStorage.getItem('superAdminToken');
      const response = await fetch('/api/super-admin/users-by-subscription-status', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
      </div>
    );
  }

  const categories = [
    { key: 'active', label: 'Suscripciones Activas', users: usersByStatus?.active || [], color: 'blue' },
    { key: 'trial', label: 'En Período de Prueba', users: usersByStatus?.trial || [], color: 'yellow' },
    { key: 'blocked', label: 'Bloqueadas', users: usersByStatus?.blocked || [], color: 'red' },
    { key: 'cancelled', label: 'Canceladas', users: usersByStatus?.cancelled || [], color: 'gray' },
  ];

  return (
    <div className="space-y-3">
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
                    onCheckedChange={(e) => {
                      e.stopPropagation();
                      toggleCategory(users);
                    }}
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
                      className="flex items-center gap-3 p-2 rounded hover:bg-white/5 cursor-pointer"
                      onClick={() => toggleEmail(user.email)}
                    >
                      <Checkbox
                        checked={selectedEmails.includes(user.email)}
                        onCheckedChange={() => toggleEmail(user.email)}
                        className="border-white/30 data-[state=checked]:bg-blue-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{user.email}</p>
                        <p className="text-xs text-white/50 truncate">{user.companyName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
