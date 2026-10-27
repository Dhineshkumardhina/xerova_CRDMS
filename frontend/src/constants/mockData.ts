import { CriminalProfile, Officer, ActivityItem, CategoryStat } from '../types';

export const CURRENT_OFFICER: Officer = {
  id: 'usr-admin-01',
  badgeNumber: '8829-JD',
  name: 'Officer J. Daniels',
  rank: 'Senior Inspector',
  department: 'Justice Department',
  clearanceLevel: 'Level 5 - Top Secret',
  avatarUrl: '/icons/icon-192.png',
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
