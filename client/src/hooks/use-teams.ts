import { useQuery } from '@tanstack/react-query';

export interface TeamMember {
  id: number;
  fullName: string;
  role: string;
  profilePicture?: string | null;
}

export interface TeamWithMembers {
  id: number;
  companyId: number;
  name: string;
  description?: string | null;
  createdBy?: number | null;
  createdAt: string;
  updatedAt: string;
  members: TeamMember[];
  memberIds: number[];
  memberCount: number;
}

export function useTeams(enabled: boolean = true) {
  return useQuery<TeamWithMembers[]>({
    queryKey: ['/api/teams'],
    enabled,
    staleTime: 60_000,
  });
}

export function resolveTeamMemberIds(
  teams: TeamWithMembers[] | undefined,
  teamId: number,
): number[] {
  const team = (teams || []).find((item) => item.id === teamId);
  if (!team) return [];
  return Array.from(new Set(team.memberIds || team.members.map((member) => member.id)));
}
