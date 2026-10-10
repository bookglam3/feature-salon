"use client";

/**
 * DashboardIcons — Lucide React based icon components
 * 2026 Premium SaaS Icon Set
 * All icons use consistent Lucide React family
 */

import {
  LayoutDashboard,
  CalendarDays,
  BookOpenCheck,
  Clock3,
  Users,
  Scissors,
  Dumbbell,
  Stethoscope,
  Sparkles,
  Leaf,
  Wallet,
  BadgeDollarSign,
  ReceiptText,
  BarChart3,
  Gift,
  BadgePercent,
  Star,
  Heart,
  Share2,
  Megaphone,
  Zap,
  Globe,
  ImageIcon,
  CalendarX,
  Settings2,
  Handshake,
  Search,
  Download,
  Plus,
  Bell,
  LogOut,
  ChevronDown,
  Home,
  Menu,
  TrendingUp,
  Upload,
  Tag,
} from "lucide-react";
import type { LucideProps } from "lucide-react";

// ─────────────────────────────────────────────────────────────────
// Base icon wrapper — shared props
// ─────────────────────────────────────────────────────────────────
type IconProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
};

function makeIcon(LucideIcon: React.FC<LucideProps>) {
  const Comp = ({ size = 18, className = "", strokeWidth = 1.6 }: IconProps) => (
    <LucideIcon
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
    />
  );
  Comp.displayName = LucideIcon.displayName;
  return Comp;
}

// ─────────────────────────────────────────────────────────────────
// Individual icon exports — one per nav item
// ─────────────────────────────────────────────────────────────────
export const DashboardIcon    = makeIcon(LayoutDashboard);
export const CalendarIcon     = makeIcon(CalendarDays);
export const BookingsIcon     = makeIcon(BookOpenCheck);
export const WaitlistIcon     = makeIcon(Clock3);
export const ClientsIcon      = makeIcon(Users);
export const ImportClientsIcon = makeIcon(Upload);
export const StaffIcon        = makeIcon(Scissors);
export const ServicesIcon     = makeIcon(Tag);
export const PaymentsIcon     = makeIcon(Wallet);
export const TipsIcon         = makeIcon(BadgeDollarSign);
export const InvoicesIcon     = makeIcon(ReceiptText);
export const ReportsIcon      = makeIcon(BarChart3);
export const GiftCardsIcon    = makeIcon(Gift);
export const DiscountCodesIcon = makeIcon(BadgePercent);
export const ReviewsIcon      = makeIcon(Star);
export const LoyaltyIcon      = makeIcon(Heart);
export const ReferralsIcon    = makeIcon(Share2);
export const BroadcastIcon    = makeIcon(Megaphone);
export const AutomationsIcon  = makeIcon(Zap);
export const ClientPortalIcon = makeIcon(Globe);
export const GalleryIcon      = makeIcon(ImageIcon);
export const ClosedDatesIcon  = makeIcon(CalendarX);
export const SettingsIcon     = makeIcon(Settings2);
export const PartnersIcon     = makeIcon(Handshake);
export const EarningsIcon     = makeIcon(TrendingUp);

// UI utility icons
export const SearchIcon       = makeIcon(Search);
export const DownloadIcon     = makeIcon(Download);
export const PlusIcon         = makeIcon(Plus);
export const BellIcon         = makeIcon(Bell);
export const LogOutIcon       = makeIcon(LogOut);
export const ChevronDownIcon  = makeIcon(ChevronDown);
export const HomeIcon         = makeIcon(Home);
export const MenuIcon         = makeIcon(Menu);

// ─────────────────────────────────────────────────────────────────
// Icon map — for dynamic lookup by nav label
// ─────────────────────────────────────────────────────────────────
// Staff icon variants keyed by verticalConfig.staffIcon value
export const StaffIconByKey: Record<string, React.FC<IconProps>> = {
  "scissors":    makeIcon(Scissors),
  "sparkles":    makeIcon(Sparkles),
  "leaf":        makeIcon(Leaf),
  "dumbbell":    makeIcon(Dumbbell),
  "stethoscope": makeIcon(Stethoscope),
  "users":       makeIcon(Users),
};

export const NAV_ICON_MAP: Record<string, React.FC<IconProps>> = {
  "Dashboard":     DashboardIcon,
  "Calendar":      CalendarIcon,
  "Bookings":      BookingsIcon,
  "Waitlist":      WaitlistIcon,
  "Clients":       ClientsIcon,
  "Import Clients": ImportClientsIcon,
  "Staff":         StaffIcon,
  "Services":      ServicesIcon,
  "Payments":      PaymentsIcon,
  "Tips":          TipsIcon,
  "Invoices":      InvoicesIcon,
  "Reports":       ReportsIcon,
  "Gift Vouchers": GiftCardsIcon,
  "Discount Codes": DiscountCodesIcon,
  "Reviews":       ReviewsIcon,
  "Loyalty":       LoyaltyIcon,
  "Referrals":     ReferralsIcon,
  "Broadcast":     BroadcastIcon,
  "Automations":   AutomationsIcon,
  "Client Portal": ClientPortalIcon,
  "Gallery":       GalleryIcon,
  "Closed Dates":  ClosedDatesIcon,
  "Settings":      SettingsIcon,
  "Partners":      PartnersIcon,
  "Earnings":      EarningsIcon,
};
