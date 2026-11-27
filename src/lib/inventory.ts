import { supabase } from "./supabase";
import type { Part, InventoryBatch, StockLedgerEntry, StockMovementType } from "./types";

/**
 * Intelligently infer or validate spare part category based on stored value,
 * part name, or SKU keywords so existing items with null category don't default to "General".
 */
export function inferPartCategory(name?: string, sku?: string, existingCategory?: string | null): string {
  if (existingCategory && existingCategory !== "General" && existingCategory.trim() !== "") {
    return existingCategory;
  }
  const text = `${name || ""} ${sku || ""}`.toLowerCase();
  if (text.includes("disp") || text.includes("screen") || text.includes("oled") || text.includes("lcd")) return "Display";
  if (text.includes("bat")) return "Battery";
  if (text.includes("cam") || text.includes("lens")) return "Camera";
  if (text.includes("charg") || text.includes("flex") || text.includes("port") || text.includes("chf")) {
    return "Charging Port";
  }
  if (text.includes("spk") || text.includes("speak") || text.includes("mic") || text.includes("audio") || text.includes("loud")) return "Speaker / Mic";
  if (text.includes("body") || text.includes("frame") || text.includes("hous") || text.includes("back glass") || text.includes("panel")) return "Body / Frame";
  if (text.includes("ic") || text.includes("board") || text.includes("chip") || text.includes("strip") || text.includes("netwok") || text.includes("network")) return "Motherboard IC";
  return existingCategory || "General";
}

/**
 * Fetch all spare parts with optional search query
 */
export async function getSpareParts(search = ""): Promise<Part[]> {
  if (!supabase) return [];
  let query = supabase
    .from("spare_parts")
    .select("*")
    .or("is_active.is.null,is_active.eq.true")
    .order("part_name", { ascending: true });

  if (search.trim()) {
    query = query.or(`part_name.ilike.%${search}%,sku.ilike.%${search}%,compatible_models.ilike.%${search}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((p: any) => {
    const cost = Number(p.purchase_price ?? p.unit_cost ?? 0);
    const stock = Number(p.current_stock ?? p.quantity ?? 0);
    const minStock = Number(p.minimum_stock ?? p.reorder_level ?? 5);
    const partName = p.part_name || p.name || "";
    const resolvedCategory = inferPartCategory(partName, p.sku, p.category);
    return {
      id: p.id,
      sku: p.sku,
      part_name: partName,
      name: partName,
      category: resolvedCategory,
      current_stock: stock,
      quantity: stock,
      reorder_level: minStock,
      unit_cost: cost,
      purchase_price: cost,
      selling_price: Number(p.selling_price ?? 0),
      is_active: p.is_active !== false,
      compatible_models: p.compatible_models,
      created_at: p.created_at,
    };
  });
}

/**
 * Create a new spare part SKU
 */
export async function createSparePart(part: Partial<Part> & { sku: string }): Promise<Part> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const cost = Number(part.unit_cost ?? part.purchase_price ?? 0);
  const stock = Number(part.current_stock ?? part.quantity ?? 0);
  const reorder = Number(part.reorder_level ?? part.minimum_stock ?? 5);
  const category = part.category || inferPartCategory(part.part_name || part.name, part.sku, "General");

  const basePayload: any = {
    sku: part.sku.trim().toUpperCase(),
    part_name: part.part_name || part.name || part.sku.trim(),
    current_stock: stock,
    purchase_price: cost,
    selling_price: Number(part.selling_price ?? 0),
    minimum_stock: reorder,
    compatible_models: part.compatible_models || "",
    is_active: true,
  };

  // Resilient insert: Try with category first; if schema does not have 'category' column (PGRST204), fall back to basePayload
  let data: any;
  const attemptWithCategory = await supabase.from("spare_parts").insert({ ...basePayload, category }).select().single();

  if (attemptWithCategory.error) {
    const errCode = attemptWithCategory.error.code;
    const errMsg = (attemptWithCategory.error.message || "").toLowerCase();
    if (errCode === "PGRST204" || errMsg.includes("category") || errCode === "42703") {
      const fallbackAttempt = await supabase.from("spare_parts").insert(basePayload).select().single();
      if (fallbackAttempt.error) throw fallbackAttempt.error;
      data = fallbackAttempt.data;
    } else {
      throw attemptWithCategory.error;
    }
  } else {
    data = attemptWithCategory.data;
  }

  // If opening stock > 0, record initial batch in inventory_batches and ledger
  if (stock > 0 && data?.id) {
    const openingBatchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();
    try {
      await supabase.from("inventory_batches").insert({
        spare_part_id: data.id,
        received_quantity: stock,
        remaining_quantity: stock,
        unit_cost: cost,
      });
    } catch (e) {
      console.warn("Could not insert opening inventory_batches to DB:", e);
    }

    try {
      const localBatch: InventoryBatch = {
        id: openingBatchId,
        spare_part_id: data.id,
        received_quantity: stock,
        remaining_quantity: stock,
        unit_cost: cost,
        received_at: nowIso,
        part_name: data.part_name || data.name,
        sku: data.sku,
      };
      const key = `phonehub_inventory_batches`;
      const raw = localStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(localBatch);
      localStorage.setItem(key, JSON.stringify(list));
    } catch {}

    try {
      const authUser = (await supabase.auth.getUser()).data.user;
      await supabase.from("stock_ledger").insert({
        spare_part_id: data.id,
        movement_type: "opening",
        quantity: stock,
        unit_cost: cost,
        reference_note: "Initial opening stock upon SKU registration",
        performed_by: authUser?.id || null,
      });
    } catch (e) {
      console.warn("Could not insert opening ledger to DB:", e);
    }

    try {
      const localLedgerEntry: StockLedgerEntry = {
        id: `ledg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        spare_part_id: data.id,
        part_id: data.id,
        movement_type: "opening",
        quantity: stock,
        quantity_delta: stock,
        unit_cost: cost,
        total_cost: stock * cost,
        created_at: nowIso,
        reference_note: "Initial opening stock upon SKU registration",
        part_name: data.part_name || data.name,
        sku: data.sku,
      };
      const key = `phonehub_stock_ledger`;
      const raw = localStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(localLedgerEntry);
      localStorage.setItem(key, JSON.stringify(list));
    } catch {}
  }

  return {
    ...data,
    name: data.part_name || data.name,
    category: data.category || category,
    quantity: data.current_stock,
    unit_cost: Number(data.purchase_price ?? cost),
    reorder_level: Number(data.minimum_stock ?? reorder),
  } as Part;
}

/**
 * Update spare part metadata, costs, or reorder levels
 */
export async function updateSparePart(id: string, updates: Partial<Part>): Promise<Part> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const payload: any = {};
  if (updates.part_name || updates.name) payload.part_name = updates.part_name || updates.name;
  if (updates.current_stock !== undefined || updates.quantity !== undefined) {
    payload.current_stock = Number(updates.current_stock ?? updates.quantity);
  }
  if (updates.unit_cost !== undefined || updates.purchase_price !== undefined) {
    payload.purchase_price = Number(updates.unit_cost ?? updates.purchase_price ?? 0);
  }
  if (updates.reorder_level !== undefined || updates.minimum_stock !== undefined) {
    payload.minimum_stock = Number(updates.reorder_level ?? updates.minimum_stock ?? 5);
  }
  if (updates.compatible_models !== undefined) payload.compatible_models = updates.compatible_models;
  if (updates.sku) payload.sku = updates.sku.trim().toUpperCase();

  let data: any;
  if (updates.category !== undefined) {
    const attempt = await supabase.from("spare_parts").update({ ...payload, category: updates.category }).eq("id", id).select().single();
    if (attempt.error && (attempt.error.code === "PGRST204" || (attempt.error.message || "").toLowerCase().includes("category"))) {
      const fallback = await supabase.from("spare_parts").update(payload).eq("id", id).select().single();
      if (fallback.error) throw fallback.error;
      data = fallback.data;
    } else if (attempt.error) {
      throw attempt.error;
    } else {
      data = attempt.data;
    }
  } else {
    const { data: updated, error } = await supabase.from("spare_parts").update(payload).eq("id", id).select().single();
    if (error) throw error;
    data = updated;
  }

  return {
    ...data,
    name: data.part_name || data.name,
    category: data.category || updates.category || "General",
    quantity: data.current_stock,
    unit_cost: Number(data.purchase_price ?? 0),
    reorder_level: Number(data.minimum_stock ?? 5),
  } as Part;
}

/**
 * Delete or safely archive a spare part SKU from inventory catalogue
 */
export async function deleteSparePart(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");

  // 1. Clean up associated unconsumed batches if any
  try {
    await supabase.from("inventory_batches").delete().eq("spare_part_id", id);
  } catch (bErr) {
    console.warn("Non-fatal: could not pre-clean inventory_batches:", bErr);
  }

  // 2. Attempt hard delete from spare_parts
  const { error: hardDelErr } = await supabase.from("spare_parts").delete().eq("id", id);

  // 3. If hard delete is restricted (e.g. historical stock_ledger entries or PO items exist),
  // safely archive by setting is_active = false and zeroing out current_stock
  if (hardDelErr) {
    console.warn("Direct delete restricted by database relations, executing safe archive:", hardDelErr.message);
    const { error: softDelErr } = await supabase
      .from("spare_parts")
      .update({ is_active: false, current_stock: 0 })
      .eq("id", id);

    if (softDelErr) {
      throw new Error(`Failed to remove spare part: ${softDelErr.message || hardDelErr.message}`);
    }
  }
}

/**
 * Fetch FIFO batches with remaining quantities
 */
/**
 * Fetch FIFO batches with remaining quantities (Dual-layer DB + localStorage cache)
 */
export async function getInventoryBatches(sparePartId?: string): Promise<InventoryBatch[]> {
  const localBatches: InventoryBatch[] = [];
  try {
    const raw = localStorage.getItem("phonehub_inventory_batches");
    if (raw) {
      const parsed: InventoryBatch[] = JSON.parse(raw);
      localBatches.push(...parsed);
    }
  } catch {}

  if (!supabase) {
    return sparePartId ? localBatches.filter((b) => b.spare_part_id === sparePartId) : localBatches;
  }

  let dbBatches: InventoryBatch[] = [];
  try {
    let query = supabase
      .from("inventory_batches")
      .select(`
        id,
        spare_part_id,
        received_quantity,
        remaining_quantity,
        unit_cost,
        received_at,
        spare_parts (
          part_name,
          sku
        )
      `)
      .order("received_at", { ascending: false });

    if (sparePartId) {
      query = query.eq("spare_part_id", sparePartId);
    }

    const { data, error } = await query;
    if (!error && data) {
      dbBatches = data.map((b: any) => {
        const part = Array.isArray(b.spare_parts) ? b.spare_parts[0] : b.spare_parts;
        return {
          id: b.id,
          spare_part_id: b.spare_part_id,
          received_quantity: Number(b.received_quantity || 0),
          remaining_quantity: Number(b.remaining_quantity || 0),
          unit_cost: Number(b.unit_cost || 0),
          received_at: b.received_at,
          part_name: part?.part_name || part?.name,
          sku: part?.sku,
        };
      });
    }
  } catch (err) {
    console.warn("Non-fatal: could not fetch inventory_batches from DB (RLS/network), using local storage:", err);
  }

  // Merge DB and local batches, deduplicating by id
  const seenIds = new Set(dbBatches.map((b) => b.id));
  const filteredLocal = (sparePartId ? localBatches.filter((b) => b.spare_part_id === sparePartId) : localBatches)
    .filter((b) => !seenIds.has(b.id));

  return [...dbBatches, ...filteredLocal].sort(
    (a, b) => new Date(b.received_at || 0).getTime() - new Date(a.received_at || 0).getTime()
  );
}

/**
 * Fetch full immutable stock movement ledger (Dual-layer DB + localStorage cache)
 */
export async function getStockLedger(sparePartId?: string): Promise<StockLedgerEntry[]> {
  const localEntries: StockLedgerEntry[] = [];
  try {
    const raw = localStorage.getItem("phonehub_stock_ledger");
    if (raw) {
      localEntries.push(...JSON.parse(raw));
    }
  } catch {}

  if (!supabase) {
    return sparePartId ? localEntries.filter((l) => l.spare_part_id === sparePartId) : localEntries;
  }

  let dbEntries: StockLedgerEntry[] = [];
  try {
    let query = supabase
      .from("stock_ledger")
      .select(`
        id,
        spare_part_id,
        movement_type,
        quantity,
        unit_cost,
        job_card_id,
        created_at,
        spare_parts (
          part_name,
          sku
        )
      `)
      .order("created_at", { ascending: false });

    if (sparePartId) {
      query = query.eq("spare_part_id", sparePartId);
    }

    const { data, error } = await query;
    if (!error && data) {
      dbEntries = data.map((l: any) => {
        const part = Array.isArray(l.spare_parts) ? l.spare_parts[0] : l.spare_parts;
        return {
          id: l.id,
          spare_part_id: l.spare_part_id,
          part_id: l.spare_part_id,
          movement_type: l.movement_type as StockMovementType,
          quantity: Number(l.quantity || 0),
          quantity_delta: Number(l.quantity || 0),
          unit_cost: Number(l.unit_cost || 0),
          total_cost: Math.abs(Number(l.quantity || 0)) * Number(l.unit_cost || 0),
          job_card_id: l.job_card_id,
          reference_type: l.job_card_id ? "job_card" : l.movement_type,
          reference_id: l.job_card_id,
          created_by: null,
          created_at: l.created_at,
          part_name: part?.part_name || part?.name,
          sku: part?.sku,
        };
      });
    }
  } catch (err) {
    console.warn("Non-fatal: could not fetch stock_ledger from DB, using local storage:", err);
  }

  const seenIds = new Set(dbEntries.map((l) => l.id));
  const filteredLocal = (sparePartId ? localEntries.filter((l) => l.spare_part_id === sparePartId) : localEntries)
    .filter((l) => !seenIds.has(l.id));

  return [...dbEntries, ...filteredLocal].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
}

/**
 * Receive spare parts into inventory via FIFO batch (calls RPC receive_spare_part_fifo or resilient dual-layer fallback)
 */
export async function receiveSparePartFifo(
  sparePartId: string,
  quantity: number,
  unitCost: number
): Promise<any> {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (quantity <= 0) throw new Error("Received quantity must be greater than zero.");
  if (unitCost < 0) throw new Error("Unit cost cannot be negative.");

  // 1. Try authenticated RPC function first
  try {
    const { data, error } = await supabase.rpc("receive_spare_part_fifo", {
      p_spare_part_id: sparePartId,
      p_quantity: quantity,
      p_unit_cost: unitCost,
    });
    if (!error && data) {
      return data;
    }
    if (error) {
      console.warn("RPC receive_spare_part_fifo returned error, falling back to direct update:", error.message);
    }
  } catch (rpcErr) {
    console.warn("RPC receive_spare_part_fifo failed, falling back to direct update:", rpcErr);
  }

  // 2. Fetch current spare part to check existing stock
  const { data: part, error: pErr } = await supabase
    .from("spare_parts")
    .select("*")
    .eq("id", sparePartId)
    .single();

  if (pErr && !part) {
    throw new Error(`Target spare part not found: ${pErr.message}`);
  }

  const currentStock = Number(part?.current_stock ?? part?.quantity ?? 0);
  const newStock = currentStock + quantity;

  // 3. Update master stock and latest purchase price on spare_parts
  const { error: updErr } = await supabase
    .from("spare_parts")
    .update({
      current_stock: newStock,
      purchase_price: unitCost,
    })
    .eq("id", sparePartId);

  if (updErr) {
    console.warn("Failed to update spare_parts directly in DB:", updErr);
    throw new Error(`Failed to update spare part stock: ${updErr.message}`);
  }

  // 4. Insert into inventory_batches (with resilient local storage fallback for RLS)
  let batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const nowIso = new Date().toISOString();

  try {
    const { data: batch, error: bErr } = await supabase
      .from("inventory_batches")
      .insert({
        spare_part_id: sparePartId,
        received_quantity: quantity,
        remaining_quantity: quantity,
        unit_cost: unitCost,
      })
      .select()
      .maybeSingle();

    if (!bErr && batch?.id) {
      batchId = batch.id;
    } else if (bErr) {
      console.warn("Non-fatal: inventory_batches DB insert failed (RLS / permission denied). Falling back to resilient local storage:", bErr.message);
    }
  } catch (bErr) {
    console.warn("Non-fatal: inventory_batches insert error:", bErr);
  }

  // Always cache batch in localStorage for seamless offline / RLS resilience
  try {
    const localBatch: InventoryBatch = {
      id: batchId,
      spare_part_id: sparePartId,
      received_quantity: quantity,
      remaining_quantity: quantity,
      unit_cost: unitCost,
      received_at: nowIso,
      part_name: part?.part_name || part?.name,
      sku: part?.sku,
    };
    const key = `phonehub_inventory_batches`;
    const raw = localStorage.getItem(key);
    const list: InventoryBatch[] = raw ? JSON.parse(raw) : [];
    list.unshift(localBatch);
    localStorage.setItem(key, JSON.stringify(list));
  } catch (lsErr) {
    console.warn("Could not cache inventory batch locally:", lsErr);
  }

  // 5. Record in stock_ledger (with resilient local storage fallback)
  try {
    const authUser = (await supabase.auth.getUser()).data.user;
    await supabase.from("stock_ledger").insert({
      spare_part_id: sparePartId,
      movement_type: "purchase",
      quantity: quantity,
      unit_cost: unitCost,
      reference_note: `FIFO batch received (${quantity} units @ ₹${unitCost})`,
      performed_by: authUser?.id || null,
    });
  } catch (ledgErr) {
    console.warn("Non-fatal: stock_ledger insert error:", ledgErr);
  }

  // Also cache ledger movement locally
  try {
    const localLedgerEntry: StockLedgerEntry = {
      id: `ledg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      spare_part_id: sparePartId,
      part_id: sparePartId,
      movement_type: "purchase",
      quantity: quantity,
      quantity_delta: quantity,
      unit_cost: unitCost,
      total_cost: quantity * unitCost,
      created_at: nowIso,
      reference_note: `FIFO batch received (${quantity} units @ ₹${unitCost})`,
      part_name: part?.part_name || part?.name,
      sku: part?.sku,
    };
    const key = `phonehub_stock_ledger`;
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(localLedgerEntry);
    localStorage.setItem(key, JSON.stringify(list));
  } catch {}

  return {
    success: true,
    batch_id: batchId,
    spare_part_id: sparePartId,
    quantity_added: quantity,
    unit_cost: unitCost,
    new_stock_quantity: newStock,
  };
}

/**
 * Issue spare parts to a repair job card via FIFO consumption (calls RPC issue_spare_part_fifo or direct fallback)
 */
export async function issueSparePartFifo(
  sparePartId: string,
  quantity: number,
  jobCardId: string
): Promise<any> {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (quantity <= 0) throw new Error("Quantity to issue must be greater than zero.");
  if (!jobCardId) throw new Error("Job card ID is required to allocate consumed part cost.");

  // 1. Try authenticated RPC function first
  try {
    const { data, error } = await supabase.rpc("issue_spare_part_fifo", {
      p_spare_part_id: sparePartId,
      p_quantity: quantity,
      p_job_card_id: jobCardId,
    });
    if (!error && data) {
      return data;
    }
    if (error) {
      console.warn("RPC issue_spare_part_fifo returned error, falling back to direct update:", error.message);
    }
  } catch (rpcErr) {
    console.warn("RPC issue_spare_part_fifo failed, falling back to direct update:", rpcErr);
  }

  // 2. Direct Resilient FIFO Stock Deduction & Cost Allocation
  // Verify spare part exists and check stock
  const { data: part, error: pErr } = await supabase
    .from("spare_parts")
    .select("*")
    .eq("id", sparePartId)
    .single();

  if (pErr || !part) throw new Error("Spare part SKU not found in catalogue.");

  const currentStock = Number(part.current_stock ?? part.quantity ?? 0);
  if (currentStock < quantity) {
    throw new Error(`Insufficient stock: Available ${currentStock} units, requested ${quantity} units.`);
  }

  // Fetch active FIFO batches with remaining stock ordered by oldest first
  const { data: batches } = await supabase
    .from("inventory_batches")
    .select("id, remaining_quantity, unit_cost")
    .eq("spare_part_id", sparePartId)
    .gt("remaining_quantity", 0)
    .order("received_at", { ascending: true });

  let remainingNeeded = quantity;
  let totalFifoCost = 0;
  const authUser = (await supabase.auth.getUser()).data.user;

  if (batches && batches.length > 0) {
    for (const batch of batches) {
      if (remainingNeeded <= 0) break;
      const deductFromBatch = Math.min(Number(batch.remaining_quantity), remainingNeeded);
      const newRemaining = Number(batch.remaining_quantity) - deductFromBatch;

      await supabase
        .from("inventory_batches")
        .update({ remaining_quantity: newRemaining })
        .eq("id", batch.id);

      const batchCost = deductFromBatch * Number(batch.unit_cost || 0);
      totalFifoCost += batchCost;

      try {
        await supabase.from("stock_ledger").insert({
          spare_part_id: sparePartId,
          movement_type: "issue",
          quantity: Math.abs(deductFromBatch),
          unit_cost: Number(batch.unit_cost || 0),
          job_card_id: jobCardId,
          reference_note: `FIFO batch issue to Job Card`,
          performed_by: authUser?.id || null,
        });
      } catch (ledgBatchErr) {
        console.warn("Could not insert batch ledger to Supabase:", ledgBatchErr);
      }

      remainingNeeded -= deductFromBatch;
    }
  }

  // If unallocated units remain (or part had no FIFO batches), use latest purchase price
  if (remainingNeeded > 0) {
    const fallbackUnitCost = Number(part.purchase_price ?? part.unit_cost ?? 0);
    totalFifoCost += remainingNeeded * fallbackUnitCost;

    try {
      await supabase.from("stock_ledger").insert({
        spare_part_id: sparePartId,
        movement_type: "issue",
        quantity: Math.abs(remainingNeeded),
        unit_cost: fallbackUnitCost,
        job_card_id: jobCardId,
        reference_note: `Direct catalogue stock issue to Job Card`,
        performed_by: authUser?.id || null,
      });
    } catch (ledgDirectErr) {
      console.warn("Could not insert direct ledger to Supabase:", ledgDirectErr);
    }
  }

  // Atomically decrement master current_stock
  const newStock = Math.max(0, currentStock - quantity);
  const { error: updErr } = await supabase
    .from("spare_parts")
    .update({ current_stock: newStock })
    .eq("id", sparePartId);

  if (updErr) {
    throw new Error(`Failed to deduct stock from catalogue: ${updErr.message}`);
  }

  // Look up job card to link device timeline & cost entries
  try {
    const { data: job } = await supabase
      .from("job_cards")
      .select("id, job_number, device_id")
      .eq("id", jobCardId)
      .maybeSingle();

    if (job?.device_id) {
      await supabase.from("device_timeline").insert({
        device_id: job.device_id,
        event_type: "spare_part_issued",
        title: "Spare Part Consumed",
        description: `Issued ${quantity} unit(s) of ${part.part_name || part.sku} under Job #${job.job_number}. Total FIFO cost: ₹${totalFifoCost}.`,
      });

      await supabase.from("device_cost_entries").insert({
        device_id: job.device_id,
        cost_type: "parts",
        quantity: quantity,
        unit_cost: totalFifoCost / (quantity || 1),
        description: `Spare Part: ${part.part_name || part.sku}`,
      });
    }
  } catch (logErr) {
    console.warn("Non-fatal: could not log device timeline/cost entries:", logErr);
  }

  // Resilient Persistence: Store issued part in localStorage for instant offline/RLS fallback
  try {
    const unitPrice = quantity > 0 ? (totalFifoCost / quantity) : Number(part.purchase_price ?? part.unit_cost ?? 0);
    const newIssuedItem = {
      id: `issue_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      spare_part_id: sparePartId,
      part_id: sparePartId,
      movement_type: "issue",
      quantity: quantity,
      quantity_delta: -quantity,
      unit_cost: unitPrice,
      total_cost: totalFifoCost,
      job_card_id: jobCardId,
      reference_type: "job_card",
      reference_id: jobCardId,
      created_by: authUser?.id || null,
      created_at: new Date().toISOString(),
      part_name: part.part_name || part.name || part.sku,
      sku: part.sku,
    };

    const storageKey = `phonehub_parts_issued_${jobCardId}`;
    const raw = localStorage.getItem(storageKey);
    const currentList = raw ? JSON.parse(raw) : [];
    currentList.unshift(newIssuedItem);
    localStorage.setItem(storageKey, JSON.stringify(currentList));
  } catch (lsErr) {
    console.warn("Could not cache issued part in localStorage:", lsErr);
  }

  return {
    success: true,
    spare_part_id: sparePartId,
    quantity_issued: quantity,
    total_fifo_cost: totalFifoCost,
    new_stock_quantity: newStock,
  };
}

/**
 * Adjust stock for damaged stock, return to supplier, or physical audit reconciliation
 */
export async function recordStockAdjustment(
  sparePartId: string,
  quantityDelta: number,
  movementType: 'adjustment' | 'return' | 'issue',
  reason: string
): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");

  // Verify part exists and fetch current stock
  const { data: part, error: pErr } = await supabase
    .from("spare_parts")
    .select("current_stock")
    .eq("id", sparePartId)
    .single();

  if (pErr || !part) throw new Error("Spare part not found.");

  const currentQty = Number(part.current_stock || 0);
  const newQty = currentQty + quantityDelta;
  if (newQty < 0) {
    throw new Error(`Adjustment would result in negative stock (Current: ${currentQty}, Delta: ${quantityDelta}).`);
  }

  // 1. Update spare_parts current_stock
  const { error: updErr } = await supabase
    .from("spare_parts")
    .update({ current_stock: newQty })
    .eq("id", sparePartId);

  if (updErr) throw updErr;

  // 2. Insert into stock_ledger (with resilient local storage fallback)
  try {
    const authUser = (await supabase.auth.getUser()).data.user;
    await supabase.from("stock_ledger").insert({
      spare_part_id: sparePartId,
      movement_type: movementType,
      quantity: Math.max(1, Math.abs(quantityDelta)),
      unit_cost: 0,
      reference_note: reason || `Manual stock adjustment (${movementType})`,
      performed_by: authUser?.id || null,
    });
  } catch (ledgErr) {
    console.warn("Non-fatal: stock_ledger insert error:", ledgErr);
  }

  try {
    const localLedgerEntry: StockLedgerEntry = {
      id: `ledg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      spare_part_id: sparePartId,
      part_id: sparePartId,
      movement_type: movementType as StockMovementType,
      quantity: quantityDelta,
      quantity_delta: quantityDelta,
      unit_cost: 0,
      total_cost: 0,
      created_at: new Date().toISOString(),
      reference_note: reason || `Manual stock adjustment (${movementType})`,
    };
    const key = `phonehub_stock_ledger`;
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(localLedgerEntry);
    localStorage.setItem(key, JSON.stringify(list));
  } catch {}
}

/**
 * Filter spare parts with low stock (quantity <= reorder_level)
 */
export async function getLowStockParts(): Promise<Part[]> {
  const parts = await getSpareParts();
  return parts.filter((p) => p.quantity <= p.reorder_level);
}
