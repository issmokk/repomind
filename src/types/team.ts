export type TeamRole = 'admin' | 'member' | 'viewer';

export type Team = {
  id: string;
  name: string;
  createdAt: string;
};

export type TeamMember = {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: string;
};
