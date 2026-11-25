import { supabase } from "./supabase";
import type { Accessory, AccessoryCategory } from "./types";

const LOCAL_STORAGE_KEY = "phonehub_accessories_cache";

// Initial seed catalogue for accessories when starting fresh
const DEFAULT_ACCESSORIES: Accessory[] = [
  {
    id: "acc-001",
    name: "20W Fast USB-C Power Adapter",
    category: "Chargers",
    sku: "CHG-20W-USBC",
    barcode: "8901234560011",
    purchase_price: 250,
    selling_price: 699,
    current_stock: 45,
    minimum_stock: 10,
    notes: "Compatible with iPhone, Samsung, Pixel",
    created_at: new Date().toISOString(),
  },
  {
    id: "acc-002",
    name: "Braided USB-C to USB-C Cable (1.5m)",
    category: "USB cables",
    sku: "CBL-USBC-15M",
    barcode: "8901234560028",
    purchase_price: 90,
    selling_price: 299,
    current_stock: 60,
    minimum_stock: 15,
    notes: "60W PD fast charge supported",
    created_at: new Date().toISOString(),
  },
  {
    id: "acc-003",
    name: "Lightning to USB-A Cable (1m)",
    category: "USB cables",
    sku: "CBL-LTG-1M",
    barcode: "8901234560035",
    purchase_price: 80,
    selling_price: 249,
    current_stock: 35,
    minimum_stock: 10,
    notes: "MFi certified charging cable",
    created_at: new Date().toISOString(),
  },
  {
    id: "acc-004",
    name: "9H HD Tempered Glass (Universal 6.7\")",
    category: "Tempered glass",
    sku: "TMP-GLS-67U",
    barcode: "8901234560042",
    purchase_price: 35,
    selling_price: 199,
    current_stock: 80,
    minimum_stock: 20,
    notes: "Edge-to-edge shatterproof protection",
    created_at: new Date().toISOString(),
  },
  {
    id: "acc-005",
    name: "Shockproof Clear Silicone Case (iPhone 15)",
    category: "Mobile covers",
    sku: "COV-IP15-CLR",
    barcode: "8901234560059",
    purchase_price: 60,
    selling_price: 249,
    current_stock: 28,
    minimum_stock: 8,
    notes: "Anti-yellowing polymer with corner bumpers",
    created_at: new Date().toISOString(),
  },
  {
    id: "acc-006",
    name: "10000mAh Slim Power Bank (22.5W)",
    category: "Power banks",
    sku: "PB-10K-SLIM",
    barcode: "8901234560066",
    purchase_price: 650,
    selling_price: 1399,
    current_stock: 12,
    minimum_stock: 5,
    notes: "Dual USB-A + Type-C ports with LED battery indicator",
    created_at: new Date().toISOString(),
  },
  {
    id: "acc-007",
    name: "TWS True Wireless Earbuds with Mic",
    category: "Earphones",
    sku: "TWS-BASS-PRO",
    barcode: "8901234560073",
    purchase_price: 450,
    selling_price: 999,
    current_stock: 18,
    minimum_stock: 6,
    notes: "ENC noise reduction, 24hr battery with charging case",
    created_at: new Date().toISOString(),
  },
];

function getLocalStore(): Accessory[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Could not read local accessories storage:", e);
  }
  return DEFAULT_ACCESSORIES;
}

function saveLocalStore(items: Accessory[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("Could not write local accessories storage:", e);
  }
}

/**
 * Fetch all accessories with category and search filtering
 */
export async function getAccessories(category = "all", search = ""): Promise<Accessory[]> {
  if (supabase) {
    try {
      let query = supabase.from("accessories").select("*").order("created_at", { ascending: false });
      if (category && category !== "all") {
        query = query.eq("category", category);
      }
      if (search.trim()) {
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%,category.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (!error && data) {
        saveLocalStore(data as Accessory[]);
        return data as Accessory[];
      }
    } catch (err) {
      console.warn("Accessories table query fallback to local store:", err);
    }
  }

  // Graceful fallback to persistent local cache if table migration pending
  let list = getLocalStore();
  if (category && category !== "all") {
    list = list.filter((a) => a.category.toLowerCase() === category.toLowerCase());
  }
  if (search.trim()) {
    const q = search.toLowerCase();
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.sku.toLowerCase().includes(q) ||
        (a.barcode && a.barcode.toLowerCase().includes(q)) ||
        a.category.toLowerCase().includes(q)
    );
  }
  return list;
}

/**
 * Find an accessory immediately by scanned or typed barcode
 */
export async function findAccessoryByBarcode(barcode: string): Promise<Accessory | null> {
  const clean = barcode.trim();
  if (!clean) return null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("accessories")
        .select("*")
        .or(`barcode.eq.${clean},sku.eq.${clean}`)
        .maybeSingle();
      if (!error && data) return data as Accessory;
    } catch (err) {
      console.warn("Barcode search in Supabase warning:", err);
    }
  }

  const list = getLocalStore();
  return list.find((a) => a.barcode === clean || a.sku.toLowerCase() === clean.toLowerCase()) || null;
}

/**
 * Create a new accessory record
 */
export async function createAccessory(item: Omit<Accessory, "id" | "created_at" | "updated_at">): Promise<Accessory> {
  const cleanSku = item.sku.trim().toUpperCase();
  const cleanBarcode = item.barcode?.trim() || null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("accessories")
        .insert({
          name: item.name.trim(),
          category: item.category,
          sku: cleanSku,
          barcode: cleanBarcode,
          purchase_price: Number(item.purchase_price || 0),
          selling_price: Number(item.selling_price || 0),
          current_stock: Math.max(0, Math.floor(Number(item.current_stock || 0))),
          minimum_stock: Math.max(0, Math.floor(Number(item.minimum_stock || 5))),
          notes: item.notes?.trim() || null,
        })
        .select()
        .single();

      if (!error && data) {
        const list = getLocalStore();
        list.unshift(data as Accessory);
        saveLocalStore(list);
        return data as Accessory;
      }
    } catch (err) {
      console.warn("createAccessory supabase insert fallback:", err);
    }
  }

  // Fallback creation
  const newItem: Accessory = {
    id: `acc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: item.name.trim(),
    category: item.category,
    sku: cleanSku,
    barcode: cleanBarcode,
    purchase_price: Number(item.purchase_price || 0),
    selling_price: Number(item.selling_price || 0),
    current_stock: Math.max(0, Math.floor(Number(item.current_stock || 0))),
    minimum_stock: Math.max(0, Math.floor(Number(item.minimum_stock || 5))),
    notes: item.notes?.trim() || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const list = getLocalStore();
  list.unshift(newItem);
  saveLocalStore(list);
  return newItem;
}

/**
 * Update an existing accessory
 */
export async function updateAccessory(id: string, updates: Partial<Accessory>): Promise<Accessory> {
  const payload: any = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.sku !== undefined) payload.sku = updates.sku.trim().toUpperCase();
  if (updates.barcode !== undefined) payload.barcode = updates.barcode?.trim() || null;
  if (updates.purchase_price !== undefined) payload.purchase_price = Number(updates.purchase_price || 0);
  if (updates.selling_price !== undefined) payload.selling_price = Number(updates.selling_price || 0);
  if (updates.current_stock !== undefined) payload.current_stock = Math.max(0, Math.floor(Number(updates.current_stock)));
  if (updates.minimum_stock !== undefined) payload.minimum_stock = Math.max(0, Math.floor(Number(updates.minimum_stock)));
  if (updates.notes !== undefined) payload.notes = updates.notes?.trim() || null;

  if (supabase) {
    try {
      const { data, error } = await supabase.from("accessories").update(payload).eq("id", id).select().single();
      if (!error && data) {
        const list = getLocalStore().map((a) => (a.id === id ? (data as Accessory) : a));
        saveLocalStore(list);
        return data as Accessory;
      }
    } catch (err) {
      console.warn("updateAccessory supabase fallback:", err);
    }
  }

  const list = getLocalStore();
  const index = list.findIndex((a) => a.id === id);
  if (index === -1) throw new Error("Accessory not found");
  const updated = { ...list[index], ...payload };
  list[index] = updated;
  saveLocalStore(list);
  return updated;
}

/**
 * Quick stock adjustment (+ or -)
 */
export async function adjustAccessoryStock(id: string, delta: number, reason?: string): Promise<Accessory> {
  const list = getLocalStore();
  const current = list.find((a) => a.id === id);
  const newStock = Math.max(0, (current?.current_stock || 0) + delta);
  if (reason) {
    console.info(`Accessory ${id} stock adjusted by ${delta} (${reason})`);
  }
  return updateAccessory(id, { current_stock: newStock });
}

/**
 * Get aggregated accessories summary metrics
 */
export async function getAccessoriesMetrics() {
  const items = await getAccessories();
  const totalSkus = items.length;
  const totalUnits = items.reduce((s, a) => s + Number(a.current_stock || 0), 0);
  const totalValuation = items.reduce(
    (s, a) => s + Number(a.current_stock || 0) * Number(a.purchase_price || 0),
    0
  );
  const lowStockCount = items.filter((a) => a.current_stock <= a.minimum_stock).length;
  return { totalSkus, totalUnits, totalValuation, lowStockCount };
}

/**
 * Delete an accessory record
 */
export async function deleteAccessory(id: string): Promise<void> {
  if (supabase) {
    try {
      await supabase.from("accessories").delete().eq("id", id);
    } catch (err) {
      console.warn("deleteAccessory supabase delete warning:", err);
    }
  }
  const list = getLocalStore().filter((a) => a.id !== id);
  saveLocalStore(list);
}
