export interface Client {
  id: string;
  username: string;
  fullName: string;
  phone: string;
  email?: string;
  serviceType: 'Hotspot' | 'PPPoE';
  status: 'Active' | 'Inactive' | 'Expired' | 'Suspended' | 'Banned' | 'Disabled' | 'Limited';
  accountType: 'Personal' | 'Business';
  plan?: string;
  router?: string;
  device?: string;
  macAddress?: string;
  method?: string;
  createdOn: string;
  expiresOn?: string;
  activatedAt?: string;
  dataUsed?: string;
  onlineStatus?: 'Online' | 'Offline';
  syncStatus?: string;
}

export interface Package {
  id: string;
  name: string;
  type: 'Hotspot' | 'PPPoE';
  category: 'Personal' | 'Business';
  bandwidth: string;
  uploadSpeed: number;
  uploadUnit: string;
  downloadSpeed: number;
  downloadUnit: string;
  price: number;
  router: string;
  validity: string;
  duration: number;
  durationUnit: 'Minutes' | 'Hours' | 'Days' | 'Months';
  status: 'Active' | 'Inactive';
  burstEnabled?: boolean;
  hotspotType?: 'Unlimited' | 'Data-capped';
  devices?: number;
  payStatus?: 'Prepaid' | 'Postpaid';
  paymentType?: 'Prepaid' | 'Postpaid';
}

export interface Transaction {
  id: string;
  user: string;
  planName?: string;
  amount: number;
  type?: 'Manual' | 'Mobile' | 'Voucher';
  method: string;
  status: 'Completed' | 'Pending' | 'Failed';
  date: string;
  expiryDate?: string;
  reference: string;
}

export interface Router {
  id: string;
  name: string;
  host: string;
  username?: string;
  password?: string;
  port?: number;
  type: 'MikroTik';
  status: 'Online' | 'Offline';
  activeUsers: number;
  cpuLoad: number;
  memoryUsed: number;
  uptime: string;
  lastSeen: string;
}

export interface Equipment {
  id: string;
  name: string;
  type: string;
  serialNumber: string;
  status: 'Active' | 'Inactive' | 'Maintenance';
  location: string;
  assignedTo?: string;
  purchaseDate?: string;
  notes?: string;
}

export interface Voucher {
  id: string;
  code: string;
  plan: string;
  router: string;
  packageType?: string;
  status: 'Unused' | 'Active' | 'Used' | 'Expired' | 'Revoked';
  createdBy: string;
  createdAt: string;
  usedBy?: string;
  usedAt?: string;
  customer?: number;
}

export interface SmsMessage {
  id: string;
  recipient: string;
  message: string;
  status: 'Sent' | 'Failed' | 'Pending';
  sentAt: string;
  type?: 'Broadcast' | 'Individual';
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  type: 'Activation' | 'Expiry' | 'Payment' | 'Custom' | 'Reminder';
  variables?: string[];
}

export interface SystemUser {
  id: string;
  username: string;
  email: string;
  role: 'Super Admin' | 'Admin' | 'Agent' | 'Viewer';
  status: 'Active' | 'Inactive';
  lastLogin: string;
  phone?: string;
}

export interface DashboardStats {
  totalClients: number;
  activeSubscribers: number;
  expiredSubscribers: number;
  totalRevenue: number;
  monthlyRevenue: number;
  onlineUsers: number;
  totalRouters: number;
  onlineRouters: number;
}

export interface ExpiredSubscriber {
  id: string;
  username: string;
  plan: string;
  type: 'Hotspot' | 'PPPoE';
  router: string;
  expiredDate: string;
  days: number;
  method: string;
  status: 'Expired' | 'Extended';
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  reference?: string;
  receipt?: string;
  createdBy: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  client: string;
  amount: number;
  status: 'Paid' | 'Unpaid' | 'Overdue' | 'Draft';
  dueDate: string;
  issuedDate: string;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PaymentChannel {
  id: string;
  name: string;
  provider: 'M-Pesa' | 'Airtel Money' | 'Manual' | 'Bank Transfer' | 'Cash' | 'Other';
  accountNumber?: string;
  apiKey?: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
}

export interface NavItem {
  label: string;
  icon: string;
  path: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface TutorialVideo {
  id: string;
  title: string;
  description: string;
  duration: string;
  category: string;
  thumbnail?: string;
  videoUrl: string;
}
