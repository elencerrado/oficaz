import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Search, User, Users } from 'lucide-react';

export interface EmployeeScopeDropdownEmployee {
  id: number;
  fullName: string;
}

export interface EmployeeScopeDropdownTeam {
  id: number;
  name: string;
}

export type EmployeeScopeValue =
  | { type: 'all' }
  | { type: 'employee'; id: number }
  | { type: 'team'; id: number };

interface EmployeeScopeDropdownProps {
  employees: EmployeeScopeDropdownEmployee[];
  teams?: EmployeeScopeDropdownTeam[];
  value: EmployeeScopeValue;
  onChange: (value: EmployeeScopeValue) => void;
  allLabel?: string;
  buttonPlaceholder?: string;
  searchPlaceholder?: string;
  buttonClassName?: string;
  contentClassName?: string;
  emptyLabel?: string;
}

export function EmployeeScopeDropdown({
  employees,
  teams = [],
  value,
  onChange,
  allLabel = 'Todos los empleados',
  buttonPlaceholder = 'Empleado',
  searchPlaceholder = 'Buscar empleado...',
  buttonClassName = 'w-[180px] justify-between font-normal',
  contentClassName = 'w-[240px] p-0',
  emptyLabel = 'No se encontraron resultados',
}: EmployeeScopeDropdownProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredTeams = useMemo(() => {
    if (!normalizedSearch) return teams;
    return teams.filter((team) => team.name.toLowerCase().includes(normalizedSearch));
  }, [normalizedSearch, teams]);

  const filteredEmployees = useMemo(() => {
    if (!normalizedSearch) return employees;
    return employees.filter((employee) => employee.fullName.toLowerCase().includes(normalizedSearch));
  }, [employees, normalizedSearch]);

  const selectedLabel = useMemo(() => {
    if (value.type === 'all') return allLabel;
    if (value.type === 'team') {
      return teams.find((team) => team.id === value.id)?.name || buttonPlaceholder;
    }
    return employees.find((employee) => employee.id === value.id)?.fullName || buttonPlaceholder;
  }, [allLabel, buttonPlaceholder, employees, teams, value]);

  const hasResults = filteredTeams.length > 0 || filteredEmployees.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={buttonClassName}>
          <span className="truncate">{selectedLabel}</span>
          <User className="w-4 h-4 ml-2 flex-shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={contentClassName} align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-8 pl-9"
            />
          </div>
        </div>
        <div className="max-h-[240px] overflow-y-auto p-1">
          <button
            onClick={() => {
              onChange({ type: 'all' });
              setSearchTerm('');
            }}
            className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors ${value.type === 'all' ? 'bg-muted font-medium' : ''}`}
          >
            {allLabel}
          </button>

          {filteredTeams.length > 0 ? (
            <>
              <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Users className="h-3 w-3" />
                Equipos
              </div>
              {filteredTeams.map((team) => (
                <button
                  key={`team-${team.id}`}
                  onClick={() => {
                    onChange({ type: 'team', id: team.id });
                    setSearchTerm('');
                  }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors ${value.type === 'team' && value.id === team.id ? 'bg-muted font-medium' : ''}`}
                >
                  {team.name}
                </button>
              ))}
            </>
          ) : null}

          {filteredEmployees.length > 0 ? (
            <>
              <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <User className="h-3 w-3" />
                Personas
              </div>
              {filteredEmployees.map((employee) => (
                <button
                  key={`employee-${employee.id}`}
                  onClick={() => {
                    onChange({ type: 'employee', id: employee.id });
                    setSearchTerm('');
                  }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors truncate ${value.type === 'employee' && value.id === employee.id ? 'bg-muted font-medium' : ''}`}
                >
                  {employee.fullName}
                </button>
              ))}
            </>
          ) : null}

          {!hasResults ? (
            <div className="px-3 py-6 text-sm text-center text-muted-foreground">
              {emptyLabel}
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
