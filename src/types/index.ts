// ─── User & Auth ──────────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'branch_manager' | 'lab_technician';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  branch_id: number | null;
  branch_name?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export interface UserFormData {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  branch_id: string | number;
  is_active?: boolean;
}

// ─── Branches ─────────────────────────────────────────────────────────────────

export interface Branch {
  id: number;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  user_count?: number;
  created_at?: string;
}

export interface BranchFormData {
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
}

// ─── Categories ───────────────────────────────────────────────────────────────

export type CategoryType = 'General' | 'Glassware' | 'Consumables' | 'Chemicals' | 'Equipment' | 'Instruments';

export interface Category {
  id: number;
  name: string;
  description: string | null;
  color: string;
  type: CategoryType;
  parent_id: number | null;
  parent_name?: string | null;
  item_count?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryFormData {
  name: string;
  description: string;
  color: string;
  type: CategoryType;
  parent_id: string | number;
}

// ─── Suppliers ────────────────────────────────────────────────────────────────

export interface Supplier {
  id: number;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  item_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SupplierFormData {
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  is_active?: boolean;
}

// ─── Items (Chemical inventory items) ─────────────────────────────────────────

export interface Item {
  id: number;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  category_id: number | null;
  supplier_id: number | null;
  quantity: number;
  min_quantity: number;
  max_quantity: number | null;
  unit: string;
  location: string | null;
  price: number | null;
  expiry_date: string | null;
  notes: string | null;
  is_active: boolean;
  category_name?: string | null;
  category_color?: string | null;
  supplier_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ItemFormData {
  name: string;
  description: string;
  sku: string;
  barcode: string;
  category_id: string | number;
  supplier_id: string | number;
  quantity: string | number;
  min_quantity: string | number;
  max_quantity: string | number;
  unit: string;
  location: string;
  price: string | number;
  expiry_date: string;
  notes: string;
  is_active?: boolean;
}

export interface PaginatedItems {
  items: Item[];
  total: number;
  page: number;
  pages: number;
}

// ─── Stock Movements (formerly Transactions) ──────────────────────────────────

export type MovementType =
  | 'PURCHASE'         // IN  — stock received from supplier / order
  | 'USAGE'            // OUT — used in lab process
  | 'BRANCH_TRANSFER'  // OUT — sent to another branch
  | 'BRANCH_RECEIPT'   // IN  — received from another branch
  | 'EXPIRY_DISPOSAL'  // OUT — removed due to expiry
  | 'SUPPLIER_RETURN'  // OUT — returned to supplier
  | 'ADJUSTMENT';      // ANY — manual stock correction

export type TransactionType = MovementType; // backwards compat alias

export const MOVEMENT_DIRECTION: Record<MovementType, 'IN' | 'OUT' | 'ADJUST'> = {
  PURCHASE: 'IN',
  USAGE: 'OUT',
  BRANCH_TRANSFER: 'OUT',
  BRANCH_RECEIPT: 'IN',
  EXPIRY_DISPOSAL: 'OUT',
  SUPPLIER_RETURN: 'OUT',
  ADJUSTMENT: 'ADJUST',
};

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  PURCHASE: 'Purchase / Received',
  USAGE: 'Lab Usage',
  BRANCH_TRANSFER: 'Branch Transfer (Out)',
  BRANCH_RECEIPT: 'Branch Receipt (In)',
  EXPIRY_DISPOSAL: 'Expiry Disposal',
  SUPPLIER_RETURN: 'Return to Supplier',
  ADJUSTMENT: 'Stock Adjustment',
};

export interface Transaction {
  id: number;
  item_id: number;
  type: MovementType;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  reference_number: string | null;
  notes: string | null;
  performed_by: number | null;
  item_name?: string;
  unit?: string;
  performed_by_name?: string | null;
  created_at: string;
}

export interface TransactionFormData {
  type: MovementType;
  quantity: string | number;
  notes: string;
  reference_number: string;
}

export interface PaginatedTransactions {
  transactions: Transaction[];
  total: number;
  page: number;
  pages: number;
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export type OrderStatus = 'Draft' | 'Submitted' | 'Approved' | 'Ordered' | 'Received' | 'Cancelled';

export interface OrderItem {
  id?: number;
  order_id?: number;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number | null;
  total_price?: number | null;
  notes: string | null;
}

export interface Order {
  id: number;
  order_number: string;
  supplier_id: number;
  supplier_name?: string | null;
  branch_id: number;
  branch_name?: string | null;
  status: OrderStatus;
  order_date: string;
  expected_delivery: string | null;
  total_amount: number | null;
  notes: string | null;
  created_by: number;
  created_by_name?: string | null;
  item_count?: number;
  items?: OrderItem[];
  created_at?: string;
}

export interface OrderFormData {
  supplier_id: string | number;
  expected_delivery: string;
  notes: string;
  items: OrderItemFormData[];
}

export interface OrderItemFormData {
  item_name: string;
  quantity: string | number;
  unit: string;
  unit_price: string | number;
  notes: string;
}

export interface PaginatedOrders {
  items: Order[];
  total: number;
  page: number;
  pages: number;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totals: {
    items: number;
    total_value: string;
    low_stock: number;
    categories: number;
    recent_transactions: number;
  };
  recent_transactions: Transaction[];
  category_breakdown: {
    name: string;
    color: string;
    item_count: number;
    total_qty: number;
  }[];
  low_stock_items: {
    name: string;
    quantity: number;
    min_quantity: number;
    unit: string;
    category_name: string | null;
    category_color: string | null;
  }[];
}

export interface ActivityDay {
  date: string;
  stock_in: number;
  stock_out: number;
}

// ─── Glassware ────────────────────────────────────────────────────────────────

export type GlasswareType =
  | 'Beaker' | 'Erlenmeyer Flask' | 'Volumetric Flask' | 'Graduated Cylinder'
  | 'Test Tube' | 'Petri Dish' | 'Burette' | 'Pipette' | 'Round Bottom Flask'
  | 'Conical Flask' | 'Watch Glass' | 'Funnel' | 'Separating Funnel'
  | 'Crucible' | 'Evaporating Dish';

export type GlasswareCondition = 'Good' | 'Fair' | 'Poor' | 'Broken';
export type GlassMaterial = 'Borosilicate Glass' | 'Soda-Lime Glass' | 'Quartz Glass' | 'Plastic' | 'Porcelain';
export type CapacityUnit = 'ml' | 'L' | 'μL';

export interface Glassware {
  id: number;
  name: string;
  type: GlasswareType | null;
  capacity: number | null;
  capacity_unit: CapacityUnit;
  material: GlassMaterial | null;
  quantity: number;
  min_quantity: number;
  condition: GlasswareCondition;
  location: string | null;
  supplier_id: number | null;
  supplier_name?: string | null;
  purchase_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface GlasswareFormData {
  name: string;
  type: string;
  capacity: string | number;
  capacity_unit: string;
  material: string;
  quantity: string | number;
  min_quantity: string | number;
  condition: string;
  location: string;
  supplier_id: string | number;
  purchase_date: string;
  notes: string;
}

export interface PaginatedGlassware {
  items: Glassware[];
  total: number;
  page: number;
  pages: number;
}

// ─── Consumables ──────────────────────────────────────────────────────────────

export type ConsumableCategory =
  | 'Gloves' | 'Face Masks' | 'Syringes' | 'Filter Paper' | 'Pipette Tips'
  | 'Centrifuge Tubes' | 'Eppendorf Tubes' | 'PCR Tubes' | 'Microscope Slides'
  | 'Cover Slips' | 'pH Strips' | 'Lab Tape' | 'Parafilm' | 'Aluminium Foil'
  | 'Tissue Paper' | 'Cotton Wool' | 'Other';

export interface Consumable {
  id: number;
  name: string;
  brand: string | null;
  category: ConsumableCategory | null;
  batch_number: string | null;
  quantity: number;
  min_quantity: number;
  unit: string;
  pack_size: number | null;
  expiry_date: string | null;
  location: string | null;
  supplier_id: number | null;
  supplier_name?: string | null;
  price: number | null;
  notes: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ConsumableFormData {
  name: string;
  brand: string;
  category: string;
  batch_number: string;
  quantity: string | number;
  min_quantity: string | number;
  unit: string;
  pack_size: string | number;
  expiry_date: string;
  location: string;
  supplier_id: string | number;
  price: string | number;
  notes: string;
}

export interface PaginatedConsumables {
  items: Consumable[];
  total: number;
  page: number;
  pages: number;
}

// ─── Chemicals ────────────────────────────────────────────────────────────────

export type HazardClass =
  | 'Flammable' | 'Corrosive' | 'Toxic' | 'Oxidizer' | 'Explosive'
  | 'Irritant' | 'Carcinogen' | 'Environmental Hazard' | 'Non-Hazardous';

export type PhysicalState = 'Solid' | 'Liquid' | 'Gas' | 'Solution';

export interface Chemical {
  id: number;
  name: string;
  cas_number: string | null;
  molecular_formula: string | null;
  category_id: number | null;
  category_name?: string | null;
  hazard_class: HazardClass | null;
  physical_state: PhysicalState | null;
  concentration: string | null;
  quantity: number;
  min_quantity: number;
  unit: string;
  location: string | null;
  storage_temp: string | null;
  supplier_id: number | null;
  supplier_name?: string | null;
  expiry_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ChemicalFormData {
  name: string;
  cas_number: string;
  molecular_formula: string;
  category_id: string | number;
  hazard_class: string;
  physical_state: string;
  concentration: string;
  quantity: string | number;
  min_quantity: string | number;
  unit: string;
  location: string;
  storage_temp: string;
  supplier_id: string | number;
  expiry_date: string;
  notes: string;
}

export interface PaginatedChemicals {
  items: Chemical[];
  total: number;
  page: number;
  pages: number;
}

// ─── Equipment ────────────────────────────────────────────────────────────────

export type EquipmentStatus = 'Available' | 'In Use' | 'Under Maintenance' | 'Retired';

export interface Equipment {
  id: number;
  name: string;
  model: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  category_id: number | null;
  category_name?: string | null;
  status: EquipmentStatus;
  location: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  supplier_id: number | null;
  supplier_name?: string | null;
  warranty_expiry: string | null;
  last_calibration: string | null;
  next_calibration: string | null;
  notes: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EquipmentFormData {
  name: string;
  model: string;
  serial_number: string;
  manufacturer: string;
  category_id: string | number;
  status: EquipmentStatus;
  location: string;
  purchase_date: string;
  purchase_price: string | number;
  supplier_id: string | number;
  warranty_expiry: string;
  last_calibration: string;
  next_calibration: string;
  notes: string;
}

export interface PaginatedEquipment {
  items: Equipment[];
  total: number;
  page: number;
  pages: number;
}

// ─── Instruments ──────────────────────────────────────────────────────────────

export type InstrumentStatus = 'Operational' | 'Under Maintenance' | 'Out of Service' | 'Retired';

export interface Instrument {
  id: number;
  name: string;
  model: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  category_id: number | null;
  category_name?: string | null;
  status: InstrumentStatus;
  location: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  supplier_id: number | null;
  supplier_name?: string | null;
  warranty_expiry: string | null;
  last_calibration: string | null;
  next_calibration: string | null;
  notes: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface InstrumentFormData {
  name: string;
  model: string;
  serial_number: string;
  manufacturer: string;
  category_id: string | number;
  status: InstrumentStatus;
  location: string;
  purchase_date: string;
  purchase_price: string | number;
  supplier_id: string | number;
  warranty_expiry: string;
  last_calibration: string;
  next_calibration: string;
  notes: string;
}

export interface PaginatedInstruments {
  items: Instrument[];
  total: number;
  page: number;
  pages: number;
}

// ─── Maintenance ──────────────────────────────────────────────────────────────

export type MaintenanceType = 'Preventive' | 'Corrective' | 'Calibration' | 'Inspection';
export type MaintenanceStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';

export interface MaintenanceRecord {
  id: number;
  equipment_id: number;
  equipment_name?: string;
  type: MaintenanceType;
  date: string;
  performed_by: string | null;
  description: string;
  cost: number | null;
  status: MaintenanceStatus;
  next_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface MaintenanceFormData {
  equipment_id: string | number;
  type: MaintenanceType;
  date: string;
  performed_by: string;
  description: string;
  cost: string | number;
  status: MaintenanceStatus;
  next_date: string;
  notes: string;
}

export interface PaginatedMaintenance {
  items: MaintenanceRecord[];
  total: number;
  page: number;
  pages: number;
}
