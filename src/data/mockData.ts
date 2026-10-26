import { CriminalProfile, Officer, ActivityItem, CategoryStat } from '../types';

export const CURRENT_OFFICER: Officer = {
  id: 'OFF-8829',
  badgeNumber: '8829',
  name: 'Det. Alex Vance',
  rank: 'Senior Special Agent',
  department: 'Major Crimes Division // DOJ',
  clearanceLevel: 'Level 4 - High Security',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
  status: 'On Duty',
};

// Clean initial state: no dummy/mock criminal profiles
export const INITIAL_PROFILES: CriminalProfile[] = [];

export const CATEGORY_STATS: CategoryStat[] = [
  {
    category: 'Theft',
    recordsCount: 0,
    iconName: 'local_police',
    badgeColorClass: 'bg-neutral-100 text-black border border-neutral-200',
    textColorClass: 'text-neutral-900',
  },
  {
    category: 'Assault',
    recordsCount: 0,
    iconName: 'gavel',
    badgeColorClass: 'bg-neutral-100 text-black border border-neutral-200',
    textColorClass: 'text-neutral-900',
  },
  {
    category: 'Fraud',
    recordsCount: 0,
    iconName: 'account_balance_wallet',
    badgeColorClass: 'bg-neutral-100 text-black border border-neutral-200',
    textColorClass: 'text-neutral-900',
  },
  {
    category: 'Narcotics',
    recordsCount: 0,
    iconName: 'medication',
    badgeColorClass: 'bg-neutral-100 text-black border border-neutral-200',
    textColorClass: 'text-neutral-900',
  },
  {
    category: 'Fugitive',
    recordsCount: 0,
    iconName: 'directions_run',
    badgeColorClass: 'bg-neutral-100 text-black border border-neutral-200',
    textColorClass: 'text-neutral-900',
  },
  {
    category: 'Vehicle',
    recordsCount: 0,
    iconName: 'directions_car',
    badgeColorClass: 'bg-neutral-100 text-black border border-neutral-200',
    textColorClass: 'text-neutral-900',
  },
  {
    category: 'Cybercrime',
    recordsCount: 0,
    iconName: 'terminal',
    badgeColorClass: 'bg-neutral-100 text-black border border-neutral-200',
    textColorClass: 'text-neutral-900',
  },
  {
    category: 'Homicide',
    recordsCount: 0,
    iconName: 'warning',
    badgeColorClass: 'bg-neutral-100 text-black border border-neutral-200',
    textColorClass: 'text-neutral-900',
  },
];

// Clean initial state: no dummy activity entries
export const INITIAL_ACTIVITY: ActivityItem[] = [];
