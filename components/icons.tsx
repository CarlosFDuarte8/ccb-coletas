import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  );
}

export const HomeIcon = (props: IconProps) => <Icon {...props}><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></Icon>;
export const PackageIcon = (props: IconProps) => <Icon {...props}><path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z"/><path d="m3 7.5 9 4.5 9-4.5V17l-9 4-9-4V7.5Z"/><path d="M12 12v9"/></Icon>;
export const CalendarIcon = (props: IconProps) => <Icon {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></Icon>;
export const RouteIcon = (props: IconProps) => <Icon {...props}><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h3a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/></Icon>;
export const UsersIcon = (props: IconProps) => <Icon {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Icon>;
export const ChartIcon = (props: IconProps) => <Icon {...props}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></Icon>;
export const SettingsIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.15.37.36.7.65.96.3.27.68.42 1.08.44H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"/></Icon>;
export const MenuIcon = (props: IconProps) => <Icon {...props}><path d="M4 6h16M4 12h16M4 18h16"/></Icon>;
export const CloseIcon = (props: IconProps) => <Icon {...props}><path d="m6 6 12 12M18 6 6 18"/></Icon>;
export const ChevronLeftIcon = (props: IconProps) => <Icon {...props}><path d="m15 18-6-6 6-6"/></Icon>;
export const ChevronDownIcon = (props: IconProps) => <Icon {...props}><path d="m6 9 6 6 6-6"/></Icon>;
export const BellIcon = (props: IconProps) => <Icon {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></Icon>;
export const SearchIcon = (props: IconProps) => <Icon {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></Icon>;
export const SunIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></Icon>;
export const MoonIcon = (props: IconProps) => <Icon {...props}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></Icon>;
export const MonitorIcon = (props: IconProps) => <Icon {...props}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></Icon>;
export const CheckIcon = (props: IconProps) => <Icon {...props}><path d="m5 12 4 4L19 6"/></Icon>;
export const CheckCircleIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></Icon>;
export const ClockIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>;
export const PlusIcon = (props: IconProps) => <Icon {...props}><path d="M12 5v14M5 12h14"/></Icon>;
export const ArrowUpRightIcon = (props: IconProps) => <Icon {...props}><path d="M7 17 17 7M7 7h10v10"/></Icon>;
export const TrashIcon = (props: IconProps) => <Icon {...props}><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5"/></Icon>;
export const BanknoteIcon = (props: IconProps) => <Icon {...props}><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9H5v1M18 15h1v-1"/></Icon>;
export const BuildingIcon = (props: IconProps) => <Icon {...props}><path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h1M14 10h1M9 14h1M14 14h1M10 21v-3h4v3"/></Icon>;
export const ReceiptIcon = (props: IconProps) => <Icon {...props}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/></Icon>;
export const DownloadIcon = (props: IconProps) => <Icon {...props}><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></Icon>;
