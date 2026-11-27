// PHONE HUB — DOMAIN TYPES

export type UserRole =
  | 'owner'
  | 'workshop_manager'
  | 'technician'
  | 'inventory'
  | 'qc_inspector'
  | 'procurement';

export type TechnicianSpecialization =
  | 'Display specialist'
  | 'Motherboard specialist'
  | 'Software specialist'
  | 'Camera specialist'
  | 'Hardware specialist'
  | 'General mobile technician';

export type Profile = {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  specialization?: TechnicianSpecialization | string;
  created_at?: string;
};

// 1. DEVICES & SHIPMENTS
export type DeviceCondition = 'Brand New' | 'Like New' | 'Excellent' | 'Good' | 'Fair' | 'Damaged' | 'Scrap';
export type DeviceStatus =
  | 'received'
  | 'in_repair'
  | 'ready_for_sale'
  | 'scrapped'
  | 'sold'
  | string;

export type Device = {
  id: string;
  shipment_id?: string | null;
  imei?: string | null;
  imei1?: string | null;
  imei2?: string | null;
  serial_number: string | null;
  brand: string;
  model: string;
  color?: string | null;
  storage_capacity?: string | null;
  condition?: DeviceCondition | string;
  condition_grade?: string | null;
  status: DeviceStatus | string;
  purchase_cost: number;
  received_date?: string | null;
  initial_issue?: string | null;
  accessories?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
};

export type DeviceCostSummary = {
  device_id: string;
  purchase_cost: number;
  parts_cost: number;
  labor_cost: number;
  other_cost?: number;
  total_cost: number;
};

export type Shipment = {
  id: string;
  tracking_number?: string | null;
  shipment_code?: string;
  supplier_name: string | null;
  received_date: string;
  notes: string | null;
  created_by?: string | null;
  created_at: string;
  device_count?: number;
};

export type DeviceTimelineEvent = {
  id: string;
  device_id: string;
  event_type: string;
  title: string;
  description: string | null;
  created_at: string;
};

// 2. INSPECTIONS
export type InspectionCheckItem = {
  item: string;
  passed: boolean;
  notes?: string;
};

export type InspectionChecklist = {
  screen?: boolean;
  touch?: boolean;
  body?: boolean;
  battery?: boolean;
  charging?: boolean;
  camera_front?: boolean;
  camera_rear?: boolean;
  speakers?: boolean;
  microphone?: boolean;
  buttons?: boolean;
  biometrics?: boolean;
  network?: boolean;
  wifi_bluetooth?: boolean;
  [key: string]: boolean | undefined;
};

export type Inspection = {
  id: string;
  device_id: string;
  inspector_id?: string | null;
  checklist: InspectionChecklist | Record<string, any>;
  defects: string[];
  grade: string | null;
  notes: string | null;
  created_at: string;
};

// 3. WORKSHOP & JOB CARDS
export type JobPriority = 'Low' | 'Normal' | 'High' | 'Urgent';
export type JobStatus = 'open' | 'in_progress' | 'waiting_parts' | 'completed' | 'cancelled';

export type Job = {
  id: string;
  job_number?: number | string;
  device_id: string;
  title: string;
  description: string | null;
  complaint?: string | null;
  diagnosis?: string | null;
  problem_description?: string | null;
  status: JobStatus | string;
  priority: JobPriority | string;
  estimated_cost: number;
  actual_labor_cost: number;
  labor_cost?: number;
  final_cost?: number;
  parts_cost?: number;
  total_repair_cost?: number;
  repair_steps?: string[];
  created_by?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  device?: Device;
  assignments?: JobAssignment[];
};

export type JobAssignment = {
  id: string;
  job_card_id: string;
  job_id?: string;
  technician_id: string;
  technician?: { full_name?: string; email?: string } | any;
  task_name?: string;
  status?: 'assigned' | 'in_progress' | 'completed' | 'paused';
  labor_cost?: number;
  assigned_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  created_at?: string;
  technician_name?: string;
};

// 4. QUALITY CONTROL
export type QcCheck = {
  id: string;
  device_id: string;
  job_card_id?: string | null;
  failure_reason?: string | null;
  rework_notes?: string | null;
  checked_at: string;
  is_passed?: boolean;
};

// 5. INVENTORY & SPARE PARTS
export type Part = {
  id: string;
  sku: string;
  part_name: string;
  name: string;
  category: string;
  current_stock: number;
  quantity: number;
  reorder_level: number;
  minimum_stock?: number;
  unit_cost: number;
  purchase_price?: number;
  selling_price?: number;
  is_active?: boolean;
  compatible_models?: string | null;
  created_at?: string;
};

export type InventoryBatch = {
  id: string;
  spare_part_id: string;
  goods_receipt_item_id?: string | null;
  received_quantity: number;
  remaining_quantity: number;
  unit_cost: number;
  received_at: string;
  part_name?: string;
  sku?: string;
};

export type StockMovementType = 'opening' | 'purchase' | 'issue' | 'return' | 'adjustment';

export type StockLedgerEntry = {
  id: string;
  spare_part_id: string;
  part_id: string;
  movement_type: StockMovementType;
  quantity: number;
  quantity_delta: number;
  unit_cost: number;
  total_cost?: number;
  reference_note?: string | null;
  job_card_id?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  idempotency_key?: string | null;
  created_by?: string | null;
  created_at: string;
  part_name?: string;
  sku?: string;
};

// 6. PROCUREMENT & PURCHASING
export type Supplier = {
  id: string;
  supplier_name: string;
  contact_person?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at: string;
};

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';

export type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier_id: string;
  order_date?: string;
  expected_date?: string | null;
  status: PurchaseOrderStatus;
  total_amount: number;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  supplier_name?: string;
  items?: PurchaseOrderItem[];
};

export type PurchaseOrderItem = {
  id: string;
  purchase_order_id: string;
  spare_part_id: string;
  ordered_quantity: number;
  received_quantity?: number;
  unit_cost: number;
  part_name?: string;
  sku?: string;
};

export type GoodsReceipt = {
  id: string;
  grn_number?: string;
  purchase_order_id?: string | null;
  po_number?: string;
  supplier_name?: string | null;
  notes?: string | null;
  received_date?: string;
  received_by?: string | null;
  created_at?: string;
  is_processed?: boolean;
  is_test_receipt?: boolean;
};

export type GoodsReceiptItem = {
  id: string;
  goods_receipt_id: string;
  purchase_order_item_id?: string | null;
  spare_part_id?: string;
  part_id?: string;
  part_sku?: string;
  part_name?: string;
  received_quantity: number;
  accepted_quantity: number;
  rejected_quantity?: number;
  unit_cost: number;
  fifo_processed_at?: string | null;
  status?: string;
  created_at?: string;
};

export type ProcessedItem = {
  item_id?: string;
  part_id?: string;
  part_name?: string;
  sku?: string;
  received_quantity?: number;
  accepted_quantity: number;
  unit_cost?: number;
  status?: string;
};

export type FifoProcessResult = {
  success: boolean;
  message?: string;
  goods_receipt_id: string;
  processed_items_count: number;
  total_accepted_quantity: number;
  processed_items: ProcessedItem[];
  raw_rpc_data?: any;
};

// 6. ACCESSORIES INVENTORY
export type AccessoryCategory =
  | 'Chargers'
  | 'USB cables'
  | 'Mobile covers'
  | 'Tempered glass'
  | 'Earphones'
  | 'Power banks'
  | 'Other mobile accessories'
  | string;

export interface Accessory {
  id: string;
  name: string;
  category: AccessoryCategory;
  sku: string;
  barcode?: string | null;
  purchase_price: number;
  selling_price: number;
  current_stock: number;
  minimum_stock: number;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}
