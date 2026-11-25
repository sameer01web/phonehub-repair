import { supabase } from "./supabase";
import type {
  Device,
  Shipment,
  Job,
  JobAssignment,
  Inspection,
  QcCheck,
  DeviceTimelineEvent,
  DeviceCostSummary,
  InspectionChecklist,
  Profile,
  StockLedgerEntry,
} from "./types";

/**
 * Canonical DB status normalization for devices.
 * In Supabase, devices_status_check constraint requires valid lowercase snake_case values:
 * 'received', 'inspection', 'repair', 'qc', 'ready_for_sale', 'scrapped', 'sold'.
 */
export function normalizeDeviceStatus(status?: string | null): string {
  if (!status) return "received";
  const trimmed = status.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (trimmed === "ready" || trimmed === "ready_for_sale" || trimmed === "ready_for_handover") return "ready_for_sale";
  if (trimmed === "scrap" || trimmed === "scrapped") return "scrapped";
  if (trimmed === "in_repair" || trimmed === "repair" || trimmed === "under_repair") return "in_repair";
  if (trimmed === "in_inspection" || trimmed === "inspection") return "received";
  if (trimmed === "in_qc" || trimmed === "qc") return "in_repair";
  if (trimmed === "received") return "received";
  if (trimmed === "sold") return "sold";
  return "received";
}

/**
 * Format status for human-friendly UI display
 */
export function formatDeviceStatus(status?: string | null): string {
  const norm = normalizeDeviceStatus(status);
  switch (norm) {
    case "received":
      return "Received";
    case "in_repair":
      return "In Repair";
    case "ready_for_sale":
      return "Ready for Handover";
    case "scrapped":
      return "Scrapped";
    case "sold":
      return "Sold";
    default:
      return "Received";
  }
}

/**
 * Fetch devices with optional search query
 */
export async function getDevices(search = "", statusFilter = ""): Promise<Device[]> {
  if (!supabase) return [];
  let query = supabase.from("devices").select("*").order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    const norm = normalizeDeviceStatus(statusFilter);
    query = query.or(`status.eq.${norm},status.eq.${statusFilter}`);
  }

  if (search.trim()) {
    query = query.or(`brand.ilike.%${search}%,model.ilike.%${search}%,imei.ilike.%${search}%,serial_number.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((d: any) => {
    let parsedColor = d.color;
    let parsedStorage = d.storage_capacity;
    let parsedIssue = d.initial_issue;

    if (d.notes) {
      const matchColor = d.notes.match(/Color:\s*([^|\]]+)/i);
      const matchStorage = d.notes.match(/Storage:\s*([^|\]]+)/i);
      const matchIssue = d.notes.match(/Issue:\s*([^|\]]+)/i);
      if (matchColor && !parsedColor) parsedColor = matchColor[1].trim();
      if (matchStorage && !parsedStorage) parsedStorage = matchStorage[1].trim();
      if (matchIssue && !parsedIssue) parsedIssue = matchIssue[1].trim();
    }

    return {
      ...d,
      imei1: d.imei || d.imei1,
      color: parsedColor || "Black",
      storage_capacity: parsedStorage || "128GB",
      initial_issue: parsedIssue || null,
      condition: d.condition || d.condition_grade || "Good",
    };
  }) as Device[];
}

/**
 * Fetch a single device by ID
 */
export async function getDevice(id: string): Promise<Device | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("devices").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  let parsedColor = data.color;
  let parsedStorage = data.storage_capacity;
  let parsedIssue = data.initial_issue;

  if (data.notes) {
    const matchColor = data.notes.match(/Color:\s*([^|\]]+)/i);
    const matchStorage = data.notes.match(/Storage:\s*([^|\]]+)/i);
    const matchIssue = data.notes.match(/Issue:\s*([^|\]]+)/i);
    if (matchColor && !parsedColor) parsedColor = matchColor[1].trim();
    if (matchStorage && !parsedStorage) parsedStorage = matchStorage[1].trim();
    if (matchIssue && !parsedIssue) parsedIssue = matchIssue[1].trim();
  }

  return {
    ...data,
    imei1: data.imei || data.imei1,
    color: parsedColor || "Black",
    storage_capacity: parsedStorage || "128GB",
    initial_issue: parsedIssue || null,
    condition: data.condition || data.condition_grade || "Good",
  } as Device;
}

/**
 * Register a single device with IMEI validation
 */
export async function createDevice(device: Omit<Device, "id" | "created_at" | "updated_at">): Promise<Device> {
  if (!supabase) throw new Error("Supabase is not configured.");

  // Clean and validate IMEI if present
  const imeiCandidate = device.imei || device.imei1;
  if (imeiCandidate) {
    const cleanImei = imeiCandidate.replace(/\s+/g, "");
    if (!/^\d{14,16}$/.test(cleanImei)) {
      throw new Error("Invalid IMEI: Must be 14-16 digits.");
    }

    // Check uniqueness
    const { data: existing } = await supabase
      .from("devices")
      .select("id, brand, model")
      .eq("imei", cleanImei)
      .maybeSingle();

    if (existing) {
      throw new Error(`Duplicate IMEI: Device with IMEI ${cleanImei} already registered (${existing.brand} ${existing.model}).`);
    }
  }

  const cleanStatus = normalizeDeviceStatus(device.status || "received");

  // Construct structured metadata in notes to guarantee schema safety
  const metaParts: string[] = [];
  if (device.color) metaParts.push(`Color: ${device.color}`);
  if (device.storage_capacity) metaParts.push(`Storage: ${device.storage_capacity}`);
  if (device.initial_issue) metaParts.push(`Issue: ${device.initial_issue}`);

  let combinedNotes = device.notes?.trim() || "";
  if (metaParts.length > 0) {
    const metaTag = `[${metaParts.join(" | ")}]`;
    combinedNotes = combinedNotes ? `${metaTag} ${combinedNotes}` : metaTag;
  }

  const { data, error } = await supabase
    .from("devices")
    .insert({
      shipment_id: device.shipment_id || null,
      imei: imeiCandidate ? imeiCandidate.replace(/\s+/g, "") : null,
      serial_number: device.serial_number || null,
      brand: device.brand,
      model: device.model,
      status: cleanStatus,
      purchase_cost: Number(device.purchase_cost || 0),
      notes: combinedNotes || null,
    })
    .select()
    .single();

  if (error) throw error;

  // Log intake in device timeline
  await addDeviceTimelineEvent(
    data.id,
    "intake",
    "Device Registered",
    `Intake registered. Purchase cost: ₹${data.purchase_cost}. Condition: ${device.condition || "Good"}.`
  );

  return {
    ...data,
    imei1: data.imei,
    color: device.color || "Black",
    storage_capacity: device.storage_capacity || "128GB",
    initial_issue: device.initial_issue || null,
    condition: device.condition || "Good",
  } as Device;
}

/**
 * Update device condition, details or status
 */
export async function updateDevice(id: string, updates: Partial<Device>): Promise<Device> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const payload: any = { updated_at: new Date().toISOString() };
  if (updates.brand !== undefined) payload.brand = updates.brand;
  if (updates.model !== undefined) payload.model = updates.model;
  if (updates.status !== undefined) payload.status = normalizeDeviceStatus(updates.status);
  if (updates.purchase_cost !== undefined) payload.purchase_cost = Number(updates.purchase_cost || 0);
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.serial_number !== undefined) payload.serial_number = updates.serial_number;
  if (updates.shipment_id !== undefined) payload.shipment_id = updates.shipment_id || null;

  const imeiCandidate = updates.imei || updates.imei1;
  if (imeiCandidate !== undefined) {
    payload.imei = imeiCandidate ? imeiCandidate.replace(/\s+/g, "") : null;
  }

  const { data, error } = await supabase
    .from("devices")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  if (updates.status) {
    await addDeviceTimelineEvent(
      id,
      "status_change",
      "Status Updated",
      `Device status changed to "${formatDeviceStatus(updates.status)}".`
    );
  }

  return {
    ...data,
    imei1: data.imei,
  } as Device;
}

/**
 * Delete a handset and clean up associated records safely
 */
export async function deleteDevice(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");

  // Check if device is linked to job cards
  const { data: jobs } = await supabase.from("job_cards").select("id").eq("device_id", id);
  if (jobs && jobs.length > 0) {
    throw new Error(
      `Cannot delete device: It has ${jobs.length} associated repair job card(s). Complete or remove job cards first.`
    );
  }

  // Clean up non-critical child references if present
  try {
    await supabase.from("device_cost_entries").delete().eq("device_id", id);
    await supabase.from("inspections").delete().eq("device_id", id);
  } catch (err) {
    console.warn("Pre-delete cleanup warning:", err);
  }

  const { error } = await supabase.from("devices").delete().eq("id", id);
  if (error) {
    if (error.code === "23503" && error.message.includes("inspections")) {
      throw new Error(
        "Cannot delete handset: It has intake inspections linked to it. For workshop audit compliance, handsets with inspection logs cannot be permanently deleted. Mark handset status as 'Scrapped' instead."
      );
    }
    if (error.code === "23503" && error.message.includes("qc_checks")) {
      throw new Error(
        "Cannot delete handset: It has Quality Control records linked to it. Mark handset status as 'Scrapped' instead."
      );
    }
    throw error;
  }
}

/**
 * Bulk import devices from CSV / Excel rows
 */
export async function bulkImportDevices(
  rows: Array<{
    brand: string;
    model: string;
    imei1?: string;
    imei?: string;
    serial_number?: string;
    color?: string;
    storage_capacity?: string;
    condition?: string;
    purchase_cost?: number;
    initial_issue?: string;
    notes?: string;
    shipment_id?: string;
  }>
): Promise<{ successCount: number; errors: string[] }> {
  if (!supabase) throw new Error("Supabase is not configured.");

  let successCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.brand?.trim() || !row.model?.trim()) {
        errors.push(`Row ${i + 1}: Missing brand or model.`);
        continue;
      }
      await createDevice({
        brand: row.brand.trim(),
        model: row.model.trim(),
        imei1: row.imei1?.trim() || row.imei?.trim() || null,
        serial_number: row.serial_number?.trim() || null,
        color: row.color?.trim() || "Black",
        storage_capacity: row.storage_capacity?.trim() || "128GB",
        condition: row.condition?.trim() || "Good",
        initial_issue: row.initial_issue?.trim() || null,
        status: "received",
        purchase_cost: Number(row.purchase_cost || 0),
        notes: row.notes?.trim() || null,
        shipment_id: row.shipment_id || null,
      });
      successCount++;
    } catch (err: any) {
      errors.push(`Row ${i + 1} (${row.brand} ${row.model || "Handset"}): ${err?.message || "Import failed"}`);
    }
  }

  return { successCount, errors };
}

/**
 * Fetch shipments with linked device count
 */
export async function getShipments(): Promise<Shipment[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("shipments")
    .select(`
      id,
      tracking_number,
      supplier_name,
      received_date,
      notes,
      created_by,
      created_at,
      devices (id)
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((s: any) => ({
    id: s.id,
    tracking_number: s.tracking_number,
    shipment_code: s.tracking_number || s.id.slice(0, 8),
    supplier_name: s.supplier_name,
    received_date: s.received_date,
    notes: s.notes,
    created_by: s.created_by,
    created_at: s.created_at,
    device_count: s.devices?.length || 0,
  }));
}

/**
 * Register a new shipment lot
 */
export async function createShipment(shipment: {
  shipment_code: string;
  tracking_number?: string;
  supplier_name?: string;
  received_date?: string;
  notes?: string;
}): Promise<Shipment> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const code = shipment.tracking_number || shipment.shipment_code;
  const { data, error } = await supabase
    .from("shipments")
    .insert({
      tracking_number: code,
      supplier_name: shipment.supplier_name || null,
      received_date: shipment.received_date || new Date().toISOString().split("T")[0],
      notes: shipment.notes || null,
    })
    .select()
    .single();

  if (error) throw error;
  return {
    ...data,
    shipment_code: data.tracking_number,
  } as Shipment;
}

/**
 * Update an existing shipment lot
 */
export async function updateShipment(
  id: string,
  updates: {
    shipment_code?: string;
    tracking_number?: string;
    supplier_name?: string;
    received_date?: string;
    notes?: string;
  }
): Promise<Shipment> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const payload: any = {};
  if (updates.tracking_number || updates.shipment_code) {
    payload.tracking_number = updates.tracking_number || updates.shipment_code;
  }
  if (updates.supplier_name !== undefined) payload.supplier_name = updates.supplier_name;
  if (updates.received_date !== undefined) payload.received_date = updates.received_date;
  if (updates.notes !== undefined) payload.notes = updates.notes;

  const { data, error } = await supabase
    .from("shipments")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return {
    ...data,
    shipment_code: data.tracking_number,
  } as Shipment;
}

/**
 * Delete a shipment lot and safely unlink handsets
 */
export async function deleteShipment(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");

  // Unlink any devices linked to this shipment
  await supabase.from("devices").update({ shipment_id: null }).eq("shipment_id", id);

  const { error } = await supabase.from("shipments").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Device 360 Timeline Logger
 */
export async function addDeviceTimelineEvent(
  deviceId: string,
  eventType: string,
  title: string,
  description: string
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("device_timeline").insert({
      device_id: deviceId,
      event_type: eventType,
      title,
      description,
    });
  } catch (err) {
    console.warn("Could not write to device_timeline:", err);
  }
}

/**
 * Fetch Device 360 Timeline
 */
export async function getDeviceTimeline(deviceId: string): Promise<DeviceTimelineEvent[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("device_timeline")
    .select("*")
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data || []) as DeviceTimelineEvent[];
}

/**
 * Fetch Device Inspections
 */
export async function getInspections(deviceId?: string): Promise<Inspection[]> {
  if (!supabase) return [];
  let query = supabase.from("inspections").select("*").order("inspection_date", { ascending: false });
  if (deviceId) {
    query = query.eq("device_id", deviceId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((i: any) => {
    let parsedGrade = i.grade || "Good";
    let parsedDefects: string[] = Array.isArray(i.defects) ? i.defects : [];
    let cleanNotes = i.notes || "";

    if (cleanNotes.includes("Grade:")) {
      const matchGrade = cleanNotes.match(/Grade:\s*([^|]+)/i);
      if (matchGrade) parsedGrade = matchGrade[1].trim();
      const matchDefects = cleanNotes.match(/Defects:\s*([^|]+)/i);
      if (matchDefects && matchDefects[1].trim() !== "None") {
        parsedDefects = matchDefects[1].split(",").map((s: string) => s.trim());
      }
      const matchNotes = cleanNotes.match(/Notes:\s*(.+)$/i);
      if (matchNotes) cleanNotes = matchNotes[1].trim();
    }

    const checklist: InspectionChecklist = {
      screen: i.screen_condition ? i.screen_condition.toLowerCase() === "good" : true,
      body: i.body_condition ? i.body_condition.toLowerCase() !== "poor" : true,
      battery: i.battery_condition ? i.battery_condition.toLowerCase() === "good" : true,
      camera_front: i.camera_status ? i.camera_status.toLowerCase() === "working" : true,
      camera_rear: i.camera_status ? i.camera_status.toLowerCase() === "working" : true,
      speakers: i.speaker_status ? i.speaker_status.toLowerCase() === "working" : true,
      charging: i.charging_status ? i.charging_status.toLowerCase() === "working" : true,
      network: i.network_status ? i.network_status.toLowerCase() === "working" : true,
      ...(i.checklist || {}),
    };

    if (i.other_issues && parsedDefects.length === 0) {
      parsedDefects = i.other_issues.split(",").map((s: string) => s.trim());
    }

    return {
      id: i.id,
      device_id: i.device_id,
      inspector_id: i.inspected_by || i.inspector_id || null,
      checklist,
      defects: parsedDefects,
      grade: parsedGrade,
      notes: cleanNotes,
      created_at: i.inspection_date || new Date().toISOString(),
    };
  }) as Inspection[];
}

/**
 * Record systematic intake inspection
 */
export async function recordInspection(
  deviceId: string,
  checklist: InspectionChecklist,
  defects: string[],
  grade: string,
  notes: string
): Promise<Inspection> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const authUser = (await supabase.auth.getUser()).data.user;
  const formattedNotes = `Grade: ${grade} | Defects: ${defects.join(", ") || "None"} | Notes: ${notes || "None"}`;

  const screenCondition = checklist.screen === false ? "Defective" : "Good";
  const bodyCondition = grade || "Good";
  const batteryCondition = checklist.battery === false ? "Defective" : "Good";
  const cameraStatus = (checklist.camera_front === false || checklist.camera_rear === false) ? "Defective" : "Working";
  const speakerStatus = (checklist.speakers === false || checklist.microphone === false) ? "Defective" : "Working";
  const chargingStatus = checklist.charging === false ? "Defective" : "Working";
  const networkStatus = (checklist.network === false || checklist.wifi_bluetooth === false) ? "Defective" : "Working";
  const inspectionResult = defects.length > 0 ? "needs_repair" : "passed";

  const { data, error } = await supabase
    .from("inspections")
    .insert({
      device_id: deviceId,
      inspected_by: authUser?.id || null,
      screen_condition: screenCondition,
      body_condition: bodyCondition,
      battery_condition: batteryCondition,
      camera_status: cameraStatus,
      speaker_status: speakerStatus,
      charging_status: chargingStatus,
      network_status: networkStatus,
      other_issues: defects.length > 0 ? defects.join(", ") : null,
      inspection_result: inspectionResult,
      notes: formattedNotes,
      inspection_date: new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  if (error) throw error;

  // Update device condition and transition to 'in_repair' or 'ready_for_sale'
  await updateDevice(deviceId, {
    status: defects.length > 0 ? "in_repair" : "ready_for_sale",
  });

  await addDeviceTimelineEvent(
    deviceId,
    "inspection",
    "Intake Inspection Completed",
    `Assigned Grade "${grade}". Found ${defects.length} defect(s): ${defects.join(", ") || "None"}.`
  );

  return {
    id: data.id,
    device_id: data.device_id,
    checklist,
    defects,
    grade,
    notes: data.notes,
    created_at: data.inspection_date || new Date().toISOString(),
  };
}

/**
 * Fetch Job Cards with linked device and assignments
 */
export async function getJobCards(statusFilter = ""): Promise<Job[]> {
  if (!supabase) return [];
  let query = supabase
    .from("job_cards")
    .select(`
      id,
      job_number,
      device_id,
      complaint,
      diagnosis,
      status,
      priority,
      estimated_cost,
      created_at,
      updated_at,
      devices (
        id,
        brand,
        model,
        imei,
        status
      ),
      job_assignments (
        id,
        job_card_id,
        technician_id,
        assigned_at,
        completed_at,
        notes
      )
    `)
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    const cleanStatus = normalizeJobStatus(statusFilter);
    query = query.eq("status", cleanStatus);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((j: any) => {
    const dev = Array.isArray(j.devices) ? j.devices[0] : j.devices;
    const assignments = (j.job_assignments || []).map((a: any) => ({
      id: a.id,
      job_id: a.job_card_id,
      job_card_id: a.job_card_id,
      technician_id: a.technician_id,
      task_name: a.notes || "Repair task",
      status: a.completed_at ? "completed" : "assigned",
      labor_cost: Number(a.labor_cost || 0),
      assigned_at: a.assigned_at,
      started_at: a.assigned_at,
      completed_at: a.completed_at,
      notes: a.notes,
      created_at: a.assigned_at || j.created_at,
    }));

    const totalLabor = assignments.reduce((acc: number, cur: any) => acc + (cur.labor_cost || 0), 0);

    return {
      id: j.id,
      job_number: j.job_number,
      device_id: j.device_id,
      title: j.complaint ? `Repair: ${j.complaint.slice(0, 30)}` : `Job #${j.job_number || j.id.slice(0, 8)}`,
      description: j.diagnosis || j.complaint || null,
      complaint: j.complaint,
      diagnosis: j.diagnosis,
      status: j.status,
      priority: j.priority,
      estimated_cost: Number(j.estimated_cost || 0),
      actual_labor_cost: Number(j.final_cost || totalLabor || 0),
      created_by: null,
      created_at: j.created_at,
      completed_at: j.updated_at,
      device: dev ? { ...dev, imei1: dev.imei } : undefined,
      assignments,
    };
  });
}

/**
 * Canonical Job Card Priority normalizer
 * Matches PostgreSQL check constraint job_cards_priority_check:
 * ('low', 'normal', 'high', 'urgent')
 */
export function normalizeJobPriority(priority?: string | null): string {
  if (!priority) return "normal";
  const p = priority.toLowerCase().trim();
  if (p === "low") return "low";
  if (p === "high") return "high";
  if (p === "urgent") return "urgent";
  return "normal";
}

/**
 * Canonical Job Card Status normalizer
 * Matches PostgreSQL check constraint job_cards_status_check:
 * ('received', 'inspection', 'assigned', 'in_progress', 'waiting_for_parts', 'qc_pending', 'completed', 'cancelled')
 */
export function normalizeJobStatus(status?: string | null): string {
  if (!status) return "received";
  const s = status.toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (s === "open" || s === "received" || s === "new") return "received";
  if (s === "inspection" || s === "diagnostics") return "inspection";
  if (s === "assigned") return "assigned";
  if (s === "in_progress" || s === "progress") return "in_progress";
  if (s === "waiting_parts" || s === "waiting_for_parts" || s === "parts_waiting") return "waiting_for_parts";
  if (s === "qc" || s === "qc_pending" || s === "in_qc") return "qc_pending";
  if (s === "completed" || s === "done" || s === "resolved") return "completed";
  if (s === "cancelled" || s === "closed") return "cancelled";
  return "received";
}

/**
 * Format Job Card Status for human-friendly UI display
 */
export function formatJobStatus(status?: string | null): string {
  const norm = normalizeJobStatus(status);
  switch (norm) {
    case "received": return "Received";
    case "inspection": return "Inspection";
    case "assigned": return "Assigned";
    case "in_progress": return "In Progress";
    case "waiting_for_parts": return "Waiting for Parts";
    case "qc_pending": return "QC Pending";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    default: return "Received";
  }
}

/**
 * Create a new repair job card
 */
export async function createJobCard(job: {
  device_id: string;
  title: string;
  description?: string;
  complaint?: string;
  diagnosis?: string;
  priority?: string;
  status?: string;
  job_number?: string;
  estimated_cost?: number;
}): Promise<Job> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const cleanPriority = normalizeJobPriority(job.priority);
  const cleanStatus = normalizeJobStatus(job.status || "received");
  const jobNumber = job.job_number || `JOB-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;

  const { data, error } = await supabase
    .from("job_cards")
    .insert({
      device_id: job.device_id,
      job_number: jobNumber,
      complaint: job.complaint || job.title,
      diagnosis: job.diagnosis || job.description || null,
      priority: cleanPriority,
      status: cleanStatus,
      estimated_cost: Number(job.estimated_cost || 0),
    })
    .select()
    .single();

  if (error) throw error;

  // Move device status to in_repair
  await updateDevice(job.device_id, { status: "in_repair" });

  await addDeviceTimelineEvent(
    job.device_id,
    "job_card_created",
    `Job Card Opened`,
    `Repair workflow initiated (#${jobNumber}). Complaint: ${job.complaint || job.title}.`
  );

  return {
    ...data,
    title: job.title,
    description: job.description || null,
  } as Job;
}

/**
 * Assign a technician to a task under a Job Card
 */
export async function assignTechnicianToJob(
  jobId: string,
  technicianId: string,
  taskName: string,
  laborCost = 0
): Promise<JobAssignment> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("job_assignments")
    .insert({
      job_card_id: jobId,
      technician_id: technicianId,
      assigned_at: new Date().toISOString(),
      notes: taskName,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase.from("job_cards").update({ status: "in_progress" }).eq("id", jobId);

  return {
    id: data.id,
    job_card_id: data.job_card_id,
    job_id: data.job_card_id,
    technician_id: data.technician_id,
    task_name: taskName,
    status: "assigned",
    labor_cost: Number(laborCost || 0),
    assigned_at: data.assigned_at,
    created_at: data.assigned_at,
    notes: data.notes,
  };
}

/**
 * Update Job Card operational status (received, assigned, in_progress, waiting_for_parts, qc_pending, completed, cancelled)
 */
export async function updateJobCardStatus(jobId: string, status: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const cleanStatus = normalizeJobStatus(status);
  const payload: any = { status: cleanStatus, updated_at: new Date().toISOString() };

  // First try updating with status & updated_at
  const { error } = await supabase.from("job_cards").update(payload).eq("id", jobId);
  if (error) {
    // If updated_at or any extra column is missing, fallback to updating only status
    const { error: fallbackErr } = await supabase.from("job_cards").update({ status: cleanStatus }).eq("id", jobId);
    if (fallbackErr) throw fallbackErr;
  }

  // Non-blocking attempt to set completed_at if column exists in current DB schema
  if (cleanStatus === "completed") {
    try {
      await supabase.from("job_cards").update({ completed_at: new Date().toISOString() }).eq("id", jobId);
    } catch {
      // Ignore if completed_at column does not exist
    }
  }
}

const STAFF_STATUS_KEY = "phonehub_staff_status_overrides";

export function getStaffStatusOverrides(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STAFF_STATUS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // Ignore
  }
  return {};
}

export function setStaffStatusOverride(userId: string, isActive: boolean) {
  try {
    const map = getStaffStatusOverrides();
    map[userId] = isActive;
    localStorage.setItem(STAFF_STATUS_KEY, JSON.stringify(map));
  } catch (e) {
    // Ignore
  }
}

export function clearStaffStatusOverride(userId: string) {
  try {
    const map = getStaffStatusOverrides();
    delete map[userId];
    localStorage.setItem(STAFF_STATUS_KEY, JSON.stringify(map));
  } catch (e) {
    // Ignore
  }
}

export function isStaffMemberActive(member: Profile): boolean {
  const overrides = getStaffStatusOverrides();
  if (overrides[member.id] !== undefined) {
    return overrides[member.id];
  }
  return member.is_active !== false;
}

/**
 * Fetch workshop staff & technician profiles
 */
export async function getStaffProfiles(): Promise<Profile[]> {
  const overrides = getStaffStatusOverrides();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, is_active")
      .order("full_name", { ascending: true });
    if (!error && data) {
      return (data as Profile[]).map((p) => ({
        ...p,
        is_active: overrides[p.id] !== undefined ? overrides[p.id] : p.is_active !== false,
      }));
    }
  } catch (err) {
    console.warn("Could not fetch staff profiles:", err);
  }
  return [];
}

/**
 * Open a Repair Job Card directly with handset intake details
 */
export async function createJobCardWithDevice(params: {
  brand: string;
  model: string;
  imei?: string | null;
  color?: string | null;
  condition?: string | null;
  complaint: string;
  diagnosis?: string | null;
  priority?: string;
  estimated_cost?: number;
  internal_notes?: string | null;
  technician_id?: string | null;
  task_name?: string | null;
  labor_cost?: number;
}): Promise<Job> {
  if (!supabase) throw new Error("Supabase is not configured.");

  // 1. Create or register device for repair
  const device = await createDevice({
    brand: params.brand.trim(),
    model: params.model.trim(),
    imei1: params.imei?.trim() || null,
    serial_number: null,
    color: params.color?.trim() || "Black",
    condition: params.condition?.trim() || "Good",
    status: "in_repair",
    purchase_cost: 0,
    notes: params.internal_notes?.trim() || null,
  });

  // 2. Create job card linked to the new device
  const job = await createJobCard({
    device_id: device.id,
    title: `Repair: ${params.brand.trim()} ${params.model.trim()}`,
    complaint: params.complaint.trim(),
    diagnosis: params.diagnosis?.trim() || undefined,
    priority: params.priority || "Normal",
    estimated_cost: Number(params.estimated_cost || 0),
  });

  // 3. If initial technician assignment provided, assign immediately
  if (params.technician_id) {
    try {
      await assignTechnicianToJob(
        job.id,
        params.technician_id,
        params.task_name?.trim() || "Initial Diagnostics & Repair",
        Number(params.labor_cost || 0)
      );
    } catch (err) {
      console.warn("Initial technician assignment warning:", err);
    }
  }

  return {
    ...job,
    device: {
      ...device,
      imei1: device.imei,
    },
  };
}

/**
 * Fetch spare parts issued to a specific repair job card via FIFO
 */
export async function getJobIssuedParts(jobId: string): Promise<StockLedgerEntry[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
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
      .eq("job_card_id", jobId)
      .eq("movement_type", "issue")
      .order("created_at", { ascending: false });

    if (!error && data) {
      return data.map((l: any) => {
        const part = Array.isArray(l.spare_parts) ? l.spare_parts[0] : l.spare_parts;
        return {
          id: l.id,
          spare_part_id: l.spare_part_id,
          part_id: l.spare_part_id,
          movement_type: l.movement_type,
          quantity: Math.abs(Number(l.quantity || 0)),
          quantity_delta: Number(l.quantity || 0),
          unit_cost: Number(l.unit_cost || 0),
          job_card_id: l.job_card_id,
          reference_type: "job_card",
          reference_id: l.job_card_id,
          created_by: null,
          created_at: l.created_at,
          part_name: part?.part_name || part?.name,
          sku: part?.sku,
        };
      });
    }
  } catch (err) {
    console.warn("Could not fetch job issued parts:", err);
  }
  return [];
}

/**
 * Fetch QC Checks
 */
export async function getQcChecks(deviceId?: string): Promise<QcCheck[]> {
  if (!supabase) return [];
  let query = supabase.from("qc_checks").select("*").order("checked_at", { ascending: false });
  if (deviceId) {
    query = query.eq("device_id", deviceId);
  }
  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((q: any) => ({
    id: q.id,
    device_id: q.device_id,
    job_card_id: q.job_card_id,
    failure_reason: q.failure_reason,
    rework_notes: q.rework_notes,
    checked_at: q.checked_at,
    is_passed: q.overall_result ? q.overall_result.toLowerCase() === "passed" : !q.failure_reason,
  }));
}

/**
 * Record a Quality Control inspection
 */
export async function recordQcCheck(
  deviceId: string,
  jobCardId: string | null,
  passed: boolean,
  failureReason = "",
  reworkNotes = ""
): Promise<QcCheck> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const authUser = (await supabase.auth.getUser()).data.user;
  const overallResult = passed ? "passed" : "rework";

  const { data, error } = await supabase
    .from("qc_checks")
    .insert({
      device_id: deviceId,
      job_card_id: jobCardId || null,
      inspected_by: authUser?.id || null,
      screen_test: passed,
      touch_test: passed,
      camera_test: passed,
      speaker_test: passed,
      microphone_test: passed,
      charging_test: passed,
      network_test: passed,
      battery_test: passed,
      overall_result: overallResult,
      failure_reason: passed ? null : failureReason || "Quality check failed",
      rework_notes: passed ? null : reworkNotes || null,
      checked_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  // Enforce Device Status Transition
  if (passed) {
    // Only approved QC allows moving to 'ready_for_sale'
    await updateDevice(deviceId, { status: "ready_for_sale" });
    if (jobCardId) {
      await supabase
        .from("job_cards")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", jobCardId);
    }
    await addDeviceTimelineEvent(
      deviceId,
      "qc_passed",
      "QC Inspection Approved",
      "All checks passed successfully. Device is officially approved and marked Ready for sale."
    );
  } else {
    // Rejection sends device to repair with rework instructions
    await updateDevice(deviceId, { status: "in_repair" });
    if (jobCardId) {
      await supabase.from("job_cards").update({ status: "in_progress" }).eq("id", jobCardId);
    }
    await addDeviceTimelineEvent(
      deviceId,
      "qc_failed",
      "QC Inspection Rejected — Rework Required",
      `Reason: ${failureReason}. Notes: ${reworkNotes || "Please review components."}`
    );
  }

  return {
    id: data.id,
    device_id: data.device_id,
    job_card_id: data.job_card_id,
    failure_reason: data.failure_reason,
    rework_notes: data.rework_notes,
    checked_at: data.checked_at,
    is_passed: passed,
  };
}

/**
 * Calculate accurate Total Device Cost rollup
 */
export async function getDeviceCostSummary(deviceId: string): Promise<DeviceCostSummary> {
  if (!supabase) {
    return { device_id: deviceId, purchase_cost: 0, parts_cost: 0, labor_cost: 0, other_cost: 0, total_cost: 0 };
  }

  // 1. Try invoking secure calculate_device_cost RPC if present
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("calculate_device_cost", {
      p_device_id: deviceId,
    });
    if (!rpcErr && rpcData) {
      const costObj = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (costObj) {
        return {
          device_id: deviceId,
          purchase_cost: Number(costObj.purchase_cost || 0),
          parts_cost: Number(costObj.parts_cost || 0),
          labor_cost: Number(costObj.labor_cost || 0),
          other_cost: Number(costObj.other_cost || 0),
          total_cost: Number(costObj.total_cost || 0),
        };
      }
    }
  } catch {
    // Fall back to client calculation if RPC is unmigrated or unpermitted
  }

  // 2. Acquisition cost
  const { data: dev } = await supabase.from("devices").select("purchase_cost").eq("id", deviceId).single();
  const purchaseCost = Number(dev?.purchase_cost || 0);

  // 3. FIFO parts cost from stock ledger linked to device's job cards
  const { data: jobCards } = await supabase.from("job_cards").select("id").eq("device_id", deviceId);
  const jobCardIds = (jobCards || []).map((j) => j.id);

  let fifoPartsCost = 0;
  if (jobCardIds.length > 0) {
    const { data: ledger } = await supabase
      .from("stock_ledger")
      .select("quantity, unit_cost")
      .in("job_card_id", jobCardIds)
      .eq("movement_type", "issue");

    if (ledger) {
      fifoPartsCost = ledger.reduce(
        (sum, item) => sum + Math.abs(Number(item.quantity || 0)) * Number(item.unit_cost || 0),
        0
      );
    }
  }

  // 4. Actual labor, manual parts, and other costs from device_cost_entries
  let dcePartsCost = 0;
  let laborCost = 0;
  let otherCost = 0;

  try {
    const { data: costEntries } = await supabase
      .from("device_cost_entries")
      .select("cost_type, quantity, unit_cost")
      .eq("device_id", deviceId);

    if (costEntries) {
      for (const entry of costEntries) {
        const costType = (entry.cost_type || "").trim().toLowerCase();
        const lineTotal = Number(entry.quantity || 1) * Number(entry.unit_cost || 0);
        if (costType === "part") {
          dcePartsCost += lineTotal;
        } else if (costType === "labor") {
          laborCost += lineTotal;
        } else {
          otherCost += lineTotal;
        }
      }
    }
  } catch {
    // If device_cost_entries table is restricted or not yet populated
  }

  const partsCost = fifoPartsCost + dcePartsCost;

  return {
    device_id: deviceId,
    purchase_cost: purchaseCost,
    parts_cost: partsCost,
    labor_cost: laborCost,
    other_cost: otherCost,
    total_cost: purchaseCost + partsCost + laborCost + otherCost,
  };
}
