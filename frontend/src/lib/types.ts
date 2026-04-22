export interface Printer {
  id: number;
  name: string;
  model: string | null;
  sector_id: number | null;
  sector_name: string | null;
  local_description: string | null;
  ip_address: string | null;
  snmp_community: string | null;
  active: boolean;
  created_at: string;
}

export interface Sector {
  id: number;
  name: string;
  responsible: string | null;
  active: boolean;
  created_at: string;
}

export interface Quota {
  id: number;
  printer_id: number;
  sector_id: number;
  monthly_limit: number;
  current_usage: number;
  total_released: number;
  period: string;
  created_at: string;
  printer_name?: string;
  sector_name?: string;
}

export interface QuotaStatus extends Quota {
  total_released: number;
  effective_limit: number;
  usage_percentage: number;
}

export interface Release {
  id: number;
  quota_id: number;
  amount: number;
  reason: string | null;
  released_by: string | null;
  created_at: string;
  printer_name?: string;
  sector_name?: string;
  period?: string;
}

export interface UsageLog {
  id: number;
  quota_id: number;
  pages_used: number;
  observation: string | null;
  created_at: string;
}

export interface ReportBySector {
  sector_id: number;
  sector_name: string;
  total_quotas: string;
  total_limit: string;
  total_usage: string;
  usage_percentage: string;
}

export interface ReportByPrinter {
  printer_id: number;
  printer_name: string;
  model: string | null;
  total_quotas: string;
  total_limit: string;
  total_usage: string;
  usage_percentage: string;
}

export interface Summary {
  period: string;
  printers_active: number;
  sectors_active: number;
  total_limit: number;
  total_usage: number;
  quotas_at_limit: number;
  releases_count: number;
  releases_pages: number;
  by_sector: ReportBySector[];
  by_printer: ReportByPrinter[];
}

export interface SnmpReading {
  id: number;
  printer_id: number;
  page_count: number;
  color_count: number | null;
  mono_count: number | null;
  toner_level: number | null;
  toner_cyan: number | null;
  toner_magenta: number | null;
  toner_yellow: number | null;
  toner_black: number | null;
  status: string | null;
  created_at: string;
  printer_name?: string;
  ip_address?: string;
}

export interface SnmpTestResult {
  success: boolean;
  printer_name?: string;
  ip: string;
  pageCount?: number;
  tonerPercent?: number;
  status?: string;
  colorCount?: number;
  monoCount?: number;
  error?: string;
}

export interface SnmpStatus {
  last_collection: string | null;
  total_readings: number;
  printers_monitored: number;
  low_toner: { printer_id: number; toner_level: number; printer_name: string }[];
}

export interface MonthlySnapshot {
  id: number;
  printer_id: number;
  period: string;
  start_count: number;
  end_count: number;
  total_pages: number;
  printer_name?: string;
  created_at: string;
}

export interface User {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'gestor';
  active: boolean;
  created_at: string;
  sectors: { sector_id: number; sector_name: string }[];
}

export type AlertType =
  | 'TONER_CRITICAL'
  | 'TONER_LOW'
  | 'PRINTER_OFFLINE'
  | 'PRINTER_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'QUOTA_WARNING';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Alert {
  id: number;
  printer_id: number | null;
  printer_name: string | null;
  sector_id: number | null;
  sector_name: string | null;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  details: string | null;
  created_at: string;
  resolved_at: string | null;
  acknowledged: number;
  acknowledged_by: number | null;
  acknowledged_by_name: string | null;
  acknowledged_at: string | null;
}

export interface AlertCount {
  total: number;
  critical: number;
  warning: number;
}

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    username: string;
    name: string;
    role: 'admin' | 'gestor';
    sectors: number[];
  };
}
