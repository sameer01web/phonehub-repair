import { supabase } from "./supabase";
import type { Supplier, PurchaseOrder, PurchaseOrderItem, GoodsReceipt } from "./types";
import { getGoodsReceiptsList } from "./fifo";

/**
 * Fetch all registered suppliers
 */
export async function getSuppliers(): Promise<Supplier[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("suppliers").select("*").order("supplier_name", { ascending: true });
  if (error) throw error;
  return (data || []).map((s: any) => ({
    id: s.id,
    supplier_name: s.supplier_name,
    contact_person: s.contact_person || s.contact_name || null,
    contact_name: s.contact_person || s.contact_name || null,
    email: s.email,
    phone: s.phone,
    address: s.address,
    notes: s.notes,
    created_at: s.created_at,
  }));
}

/**
 * Register a new supplier
 */
export async function createSupplier(supplier: Omit<Supplier, "id" | "created_at">): Promise<Supplier> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const payload = {
    supplier_name: supplier.supplier_name,
    contact_person: supplier.contact_person || supplier.contact_name || null,
    email: supplier.email || null,
    phone: supplier.phone || null,
    address: supplier.address || null,
    notes: supplier.notes || null,
  };
  const { data, error } = await supabase.from("suppliers").insert(payload).select().single();
  if (error) throw error;
  return {
    ...data,
    contact_name: data.contact_person,
  } as Supplier;
}

/**
 * Update existing supplier details
 */
export async function updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const payload: any = {};
  if (updates.supplier_name !== undefined) payload.supplier_name = updates.supplier_name;
  if (updates.contact_person !== undefined || updates.contact_name !== undefined) {
    payload.contact_person = updates.contact_person || updates.contact_name || null;
  }
  if (updates.email !== undefined) payload.email = updates.email;
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.address !== undefined) payload.address = updates.address;
  if (updates.notes !== undefined) payload.notes = updates.notes;

  const { data, error } = await supabase
    .from("suppliers")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return {
    ...data,
    contact_name: data.contact_person,
  } as Supplier;
}

/**
 * Delete a supplier if no purchase orders are linked
 */
export async function deleteSupplier(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: pos } = await supabase.from("purchase_orders").select("id").eq("supplier_id", id);
  if (pos && pos.length > 0) {
    throw new Error(`Cannot delete supplier: ${pos.length} purchase order(s) are associated with this vendor.`);
  }
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Update Purchase Order status (ordered, partially_received, received, cancelled)
 */
export async function updatePurchaseOrderStatus(poId: string, status: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase
    .from("purchase_orders")
    .update({ status })
    .eq("id", poId);
  if (error) throw error;
}

/**
 * Fetch purchase orders with joined supplier details and items
 */
export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(`
      id,
      po_number,
      supplier_id,
      order_date,
      expected_date,
      status,
      total_amount,
      notes,
      created_by,
      created_at,
      suppliers (
        supplier_name
      ),
      purchase_order_items (
        id,
        purchase_order_id,
        spare_part_id,
        ordered_quantity,
        received_quantity,
        unit_cost,
        spare_parts (
          part_name,
          sku
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((po: any) => {
    const sup = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers;
    const items = (po.purchase_order_items || []).map((item: any) => {
      const part = Array.isArray(item.spare_parts) ? item.spare_parts[0] : item.spare_parts;
      return {
        id: item.id,
        purchase_order_id: item.purchase_order_id,
        spare_part_id: item.spare_part_id,
        ordered_quantity: Number(item.ordered_quantity || 0),
        received_quantity: Number(item.received_quantity || 0),
        unit_cost: Number(item.unit_cost || 0),
        part_name: part?.part_name || part?.name,
        sku: part?.sku,
      };
    });

    return {
      id: po.id,
      po_number: po.po_number,
      supplier_id: po.supplier_id,
      order_date: po.order_date,
      expected_date: po.expected_date,
      status: po.status,
      total_amount: Number(po.total_amount || 0),
      notes: po.notes,
      created_by: po.created_by,
      created_at: po.created_at,
      supplier_name: sup?.supplier_name || "Unknown Supplier",
      items,
    };
  });
}

/**
 * Create a new Purchase Order with line items
 */
export async function createPurchaseOrder(
  poData: {
    po_number: string;
    supplier_id: string;
    order_date?: string;
    expected_date?: string;
    notes?: string;
  },
  items: Array<{
    spare_part_id: string;
    ordered_quantity: number;
    unit_cost: number;
  }>
): Promise<PurchaseOrder> {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (items.length === 0) throw new Error("A purchase order must have at least one line item.");

  const totalAmount = items.reduce(
    (sum, item) => sum + item.ordered_quantity * item.unit_cost,
    0
  );

  // 1. Create Purchase Order header
  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .insert({
      po_number: poData.po_number,
      supplier_id: poData.supplier_id,
      order_date: poData.order_date || new Date().toISOString().split("T")[0],
      expected_date: poData.expected_date || null,
      status: "ordered",
      total_amount: totalAmount,
      notes: poData.notes || null,
    })
    .select()
    .single();

  if (poErr) throw poErr;

  // 2. Insert line items
  const lineItems = items.map((i) => ({
    purchase_order_id: po.id,
    spare_part_id: i.spare_part_id,
    ordered_quantity: i.ordered_quantity,
    received_quantity: 0,
    unit_cost: i.unit_cost,
  }));

  const { error: itemsErr } = await supabase.from("purchase_order_items").insert(lineItems);
  if (itemsErr) throw itemsErr;

  return po as PurchaseOrder;
}

/**
 * Fetch Goods Receipts
 */
export async function getGoodsReceipts(): Promise<GoodsReceipt[]> {
  return getGoodsReceiptsList();
}
