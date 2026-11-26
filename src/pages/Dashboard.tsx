import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardList,
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  Activity,
  Layers,
  Smartphone,
  Plus,
  CheckSquare,
  PackageCheck,
  Headphones,
  Truck,
  Package,
  Calendar,
  Filter,
  TrendingUp,
  Tag,
  DollarSign,
  Users,
  X,
  ExternalLink,
  Search,
  type LucideIcon,
} from "lucide-react";
import { getJobCards, getInspections, getQcChecks, getDevices, getStaffProfiles } from "../lib/repairs";
import { getSpareParts, getInventoryBatches } from "../lib/inventory";
import { getAccessories } from "../lib/accessories";
import { getPurchaseOrders, getGoodsReceipts } from "../lib/procurement";
import type {
  Job,
  Inspection,
  QcCheck,
  Part,
  InventoryBatch,
  PurchaseOrder,
  GoodsReceipt,
  Device,
  Accessory,
  Profile,
} from "../lib/types";

interface StatItem {
  id: string;
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  subtitle: string;
  link: string;
}

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [qcChecks, setQcChecks] = useState<QcCheck[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [staffList, setStaffList] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Card Drilldown & Filter State
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState<string>("");
  const drilldownRef = React.useRef<HTMLDivElement | null>(null);

  function handleCardClick(id: string) {
    if (activeFilterId === id) {
      setActiveFilterId(null);
      setFilterSearch("");
    } else {
      setActiveFilterId(id);
      setFilterSearch("");
      setTimeout(() => {
        drilldownRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 70);
    }
  }

  // Date Filter State
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        const [jobList, devList, accList, inspList, qcList, partList, batchList, poList, grnList, stList] =
          await Promise.all([
            getJobCards().catch(() => []),
            getDevices().catch(() => []),
            getAccessories().catch(() => []),
            getInspections().catch(() => []),
            getQcChecks().catch(() => []),
            getSpareParts().catch(() => []),
            getInventoryBatches().catch(() => []),
            getPurchaseOrders().catch(() => []),
            getGoodsReceipts().catch(() => []),
            getStaffProfiles().catch(() => []),
          ]);
        setJobs(jobList);
        setDevices(devList);
        setAccessories(accList);
        setInspections(inspList);
        setQcChecks(qcList);
        setParts(partList);
        setBatches(batchList);
        setOrders(poList);
        setReceipts(grnList);
        setStaffList(stList);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  // Filter items by date
  const filteredJobs = useMemo(() => {
    if (dateFilter === "all") return jobs;
    const now = new Date();
    const todayStr = now.toDateString();

    return jobs.filter((j) => {
      if (!j.created_at) return true;
      const d = new Date(j.created_at);
      if (dateFilter === "today") return d.toDateString() === todayStr;
      if (dateFilter === "week") {
        const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
        return diffDays <= 7;
      }
      if (dateFilter === "month") {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [jobs, dateFilter]);

  const filteredDevices = useMemo(() => {
    if (dateFilter === "all") return devices;
    const now = new Date();
    const todayStr = now.toDateString();

    return devices.filter((d) => {
      if (!d.created_at) return true;
      const date = new Date(d.created_at);
      if (dateFilter === "today") return date.toDateString() === todayStr;
      if (dateFilter === "week") {
        const diffDays = (now.getTime() - date.getTime()) / (1000 * 3600 * 24);
        return diffDays <= 7;
      }
      if (dateFilter === "month") {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [devices, dateFilter]);

  // Real-time Database Counts (All 11 exact required statistics):
  // 1. Total phones in inventory
  const totalPhonesInInventory = devices.length;

  // 2. Total phones received
  const totalPhonesReceived = filteredDevices.length;

  // 3. Pending repairs (received / open / inspection awaiting assignment or parts)
  const pendingRepairs = filteredJobs.filter(
    (j) =>
      j.status === "received" ||
      j.status === "open" ||
      j.status === "inspection" ||
      j.status === "waiting_for_parts" ||
      j.status === "waiting_parts"
  ).length;

  // 4. Assigned repairs
  const assignedRepairs = filteredJobs.filter((j) => j.status === "assigned").length;

  // 5. In-progress repairs
  const inProgressRepairs = filteredJobs.filter((j) => j.status === "in_progress").length;

  // 6. QC testing
  const qcTestingRepairs = filteredJobs.filter(
    (j) => j.status === "qc_pending" || j.status === "qc" || j.status === "qc_check"
  ).length;

  // 7. Completed repairs
  const completedRepairs = filteredJobs.filter((j) => j.status === "completed").length;

  // 8. Delivered phones
  const deliveredPhones = devices.filter(
    (d) => d.status === "ready_for_sale" || d.status === "sold"
  ).length;

  // 9. Total spare parts stock
  const totalSparePartsStock = parts.reduce((sum, p) => sum + Number(p.quantity || 0), 0);

  // 10. Total accessories stock
  const totalAccessoriesStock = accessories.reduce((sum, a) => sum + Number(a.current_stock || 0), 0);

  // 11. Low stock alerts (Parts below reorder + Accessories below minimum stock)
  const lowStockParts = parts.filter((p) => p.quantity <= p.reorder_level);
  const lowStockAccessories = accessories.filter((a) => a.current_stock <= a.minimum_stock);
  const totalLowStockAlerts = lowStockParts.length + lowStockAccessories.length;

  // Valuations
  const partsValuation = batches.reduce(
    (sum, b) => sum + Number(b.remaining_quantity || 0) * Number(b.unit_cost || 0),
    0
  );
  const accessoriesValuation = accessories.reduce(
    (sum, a) => sum + Number(a.current_stock || 0) * Number(a.purchase_price || 0),
    0
  );

  // QC failed
  const qcFailedCount = qcChecks.filter((q) => !q.is_passed || Boolean(q.failure_reason)).length;

  // Priorities for charts
  const urgentCount = filteredJobs.filter((j) => (j.priority || "").toLowerCase() === "urgent").length;
  const highCount = filteredJobs.filter((j) => (j.priority || "").toLowerCase() === "high").length;
  const normalCount = filteredJobs.filter(
    (j) => !j.priority || (j.priority || "").toLowerCase() === "normal"
  ).length;
  const lowCount = filteredJobs.filter((j) => (j.priority || "").toLowerCase() === "low").length;

  // Primary 11 KPIs
  const all11Stats: StatItem[] = [
    {
      id: "phones_inventory",
      label: "Phones in Inventory",
      value: totalPhonesInInventory,
      icon: Smartphone,
      color: "Blue",
      subtitle: `${deliveredPhones} handsets ready/delivered`,
      link: "/devices",
    },
    {
      id: "phones_received",
      label: "Phones Received",
      value: totalPhonesReceived,
      icon: PackageCheck,
      color: "Blue",
      subtitle: `${dateFilter === "all" ? "Total intake" : `Intake (${dateFilter})`}`,
      link: "/devices",
    },
    {
      id: "pending_repairs",
      label: "Pending Repairs",
      value: pendingRepairs,
      icon: Clock,
      color: "Purple",
      subtitle: "Awaiting bench assignment",
      link: "/jobs",
    },
    {
      id: "assigned_repairs",
      label: "Assigned Repairs",
      value: assignedRepairs,
      icon: ClipboardList,
      color: "Purple",
      subtitle: "Technicians allocated",
      link: "/jobs",
    },
    {
      id: "in_progress_repairs",
      label: "In-Progress Repairs",
      value: inProgressRepairs,
      icon: Wrench,
      color: "Orange",
      subtitle: "Currently on technician bench",
      link: "/jobs",
    },
    {
      id: "qc_testing",
      label: "QC Testing",
      value: qcTestingRepairs,
      icon: ShieldCheck,
      color: "Orange",
      subtitle: `${qcFailedCount} rework flagged`,
      link: "/qc",
    },
    {
      id: "completed_repairs",
      label: "Completed Repairs",
      value: completedRepairs,
      icon: CheckCircle2,
      color: "Green",
      subtitle: "Hardware verified & passed",
      link: "/jobs",
    },
    {
      id: "delivered_phones",
      label: "Delivered Phones",
      value: deliveredPhones,
      icon: CheckSquare,
      color: "Green",
      subtitle: "Handed over / ready",
      link: "/devices",
    },
    {
      id: "spare_parts",
      label: "Spare Parts Stock",
      value: totalSparePartsStock,
      icon: Wrench,
      color: "Blue",
      subtitle: `₹${partsValuation.toLocaleString("en-IN")} FIFO valuation`,
      link: "/parts",
    },
    {
      id: "accessories",
      label: "Accessories Stock",
      value: totalAccessoriesStock,
      icon: Headphones,
      color: "Purple",
      subtitle: `₹${accessoriesValuation.toLocaleString("en-IN")} inventory value`,
      link: "/accessories",
    },
    {
      id: "low_stock",
      label: "Low Stock Alerts",
      value: totalLowStockAlerts,
      icon: AlertTriangle,
      color: totalLowStockAlerts > 0 ? "Orange" : "Green",
      subtitle: `${lowStockParts.length} parts, ${lowStockAccessories.length} acc. low`,
      link: "/parts",
    },
  ];

  // Compute technician repair metrics: who repaired how many phones
  const technicianStats = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        role: string;
        repairedCount: number;
        inProgressCount: number;
        assignedCount: number;
        solvedIssues: string[];
      }
    >();

    staffList.forEach((s) => {
      map.set(s.id, {
        id: s.id,
        name: s.full_name || "Technician",
        role: s.role || "technician",
        repairedCount: 0,
        inProgressCount: 0,
        assignedCount: 0,
        solvedIssues: [],
      });
    });

    filteredJobs.forEach((j) => {
      const isCompleted = j.status === "completed" || j.status === "delivered";
      const isInProgress = j.status === "in_progress";

      (j.assignments || []).forEach((a) => {
        let entry = map.get(a.technician_id);
        if (!entry) {
          entry = {
            id: a.technician_id,
            name: a.technician_name || "Technician",
            role: "technician",
            repairedCount: 0,
            inProgressCount: 0,
            assignedCount: 0,
            solvedIssues: [],
          };
          map.set(a.technician_id, entry);
        }

        entry.assignedCount += 1;
        if (isCompleted || a.status === "completed") {
          entry.repairedCount += 1;
          if (j.complaint && !entry.solvedIssues.includes(j.complaint)) {
            entry.solvedIssues.push(j.complaint);
          }
        } else if (isInProgress || a.status === "in_progress") {
          entry.inProgressCount += 1;
        }
      });
    });

    return Array.from(map.values())
      .filter((t) => t.role === "technician" || t.role === "owner" || t.assignedCount > 0)
      .sort((a, b) => b.repairedCount - a.repairedCount);
  }, [staffList, filteredJobs]);

  // Active Card Drilldown Data Resolution
  const activeFilteredData = useMemo(() => {
    if (!activeFilterId) return null;
    const q = filterSearch.trim().toLowerCase();

    switch (activeFilterId) {
      case "phones_inventory": {
        let list = devices;
        if (q) {
          list = list.filter(
            (d) =>
              d.brand?.toLowerCase().includes(q) ||
              d.model?.toLowerCase().includes(q) ||
              (d.imei1 || d.imei || "").toLowerCase().includes(q) ||
              (d.status || "").toLowerCase().includes(q) ||
              (d.notes || "").toLowerCase().includes(q)
          );
        }
        return {
          type: "devices" as const,
          title: "Phones in Inventory",
          subtitle: "Complete mobile handset inventory currently registered in workshop",
          icon: Smartphone,
          color: "#0176d3",
          count: list.length,
          total: devices.length,
          fullLink: "/devices",
          linkText: "Open in Phone Inventory →",
          items: list,
        };
      }
      case "phones_received": {
        let list = filteredDevices;
        if (q) {
          list = list.filter(
            (d) =>
              d.brand?.toLowerCase().includes(q) ||
              d.model?.toLowerCase().includes(q) ||
              (d.imei1 || d.imei || "").toLowerCase().includes(q) ||
              (d.status || "").toLowerCase().includes(q)
          );
        }
        return {
          type: "devices" as const,
          title: `Phones Received (${dateFilter === "all" ? "All Time" : dateFilter.toUpperCase()})`,
          subtitle: "Handsets registered during selected date filter",
          icon: PackageCheck,
          color: "#0176d3",
          count: list.length,
          total: filteredDevices.length,
          fullLink: "/devices?status=received",
          linkText: "Open in Phone Inventory →",
          items: list,
        };
      }
      case "pending_repairs": {
        let list = filteredJobs.filter(
          (j) =>
            j.status === "received" ||
            j.status === "open" ||
            j.status === "inspection" ||
            j.status === "waiting_for_parts" ||
            j.status === "waiting_parts"
        );
        if (q) {
          list = list.filter(
            (j) =>
              String(j.job_number || "").toLowerCase().includes(q) ||
              j.title?.toLowerCase().includes(q) ||
              j.complaint?.toLowerCase().includes(q) ||
              j.diagnosis?.toLowerCase().includes(q) ||
              j.device?.brand?.toLowerCase().includes(q) ||
              j.device?.model?.toLowerCase().includes(q)
          );
        }
        return {
          type: "jobs" as const,
          title: "Pending Repairs",
          subtitle: "Repair tickets awaiting bench assignment or replacement components",
          icon: Clock,
          color: "#8b5cf6",
          count: list.length,
          total: pendingRepairs,
          fullLink: "/jobs?status=received",
          linkText: "Open in Repair Job Cards →",
          items: list,
        };
      }
      case "assigned_repairs": {
        let list = filteredJobs.filter((j) => j.status === "assigned");
        if (q) {
          list = list.filter(
            (j) =>
              String(j.job_number || "").toLowerCase().includes(q) ||
              j.title?.toLowerCase().includes(q) ||
              j.complaint?.toLowerCase().includes(q) ||
              j.device?.brand?.toLowerCase().includes(q) ||
              j.device?.model?.toLowerCase().includes(q)
          );
        }
        return {
          type: "jobs" as const,
          title: "Assigned Repairs",
          subtitle: "Repair tickets allocated to workshop technicians",
          icon: ClipboardList,
          color: "#8b5cf6",
          count: list.length,
          total: assignedRepairs,
          fullLink: "/jobs?status=assigned",
          linkText: "Open in Repair Job Cards →",
          items: list,
        };
      }
      case "in_progress_repairs": {
        let list = filteredJobs.filter((j) => j.status === "in_progress");
        if (q) {
          list = list.filter(
            (j) =>
              String(j.job_number || "").toLowerCase().includes(q) ||
              j.title?.toLowerCase().includes(q) ||
              j.complaint?.toLowerCase().includes(q) ||
              j.device?.brand?.toLowerCase().includes(q) ||
              j.device?.model?.toLowerCase().includes(q)
          );
        }
        return {
          type: "jobs" as const,
          title: "In-Progress Bench Repairs",
          subtitle: "Handsets currently actively undergoing bench diagnostics or repair",
          icon: Wrench,
          color: "#f59e0b",
          count: list.length,
          total: inProgressRepairs,
          fullLink: "/jobs?status=in_progress",
          linkText: "Open in Repair Job Cards →",
          items: list,
        };
      }
      case "qc_testing": {
        let list = filteredJobs.filter(
          (j) => j.status === "qc_pending" || j.status === "qc" || j.status === "qc_check"
        );
        if (q) {
          list = list.filter(
            (j) =>
              String(j.job_number || "").toLowerCase().includes(q) ||
              j.title?.toLowerCase().includes(q) ||
              j.complaint?.toLowerCase().includes(q) ||
              j.device?.brand?.toLowerCase().includes(q) ||
              j.device?.model?.toLowerCase().includes(q)
          );
        }
        return {
          type: "jobs" as const,
          title: "Quality Control Testing Gate",
          subtitle: "Repaired devices undergoing pre/post quality assurance checks",
          icon: ShieldCheck,
          color: "#0284c7",
          count: list.length,
          total: qcTestingRepairs,
          fullLink: "/qc",
          linkText: "Open in Quality Control →",
          items: list,
        };
      }
      case "completed_repairs": {
        let list = filteredJobs.filter((j) => j.status === "completed");
        if (q) {
          list = list.filter(
            (j) =>
              String(j.job_number || "").toLowerCase().includes(q) ||
              j.title?.toLowerCase().includes(q) ||
              j.complaint?.toLowerCase().includes(q) ||
              j.device?.brand?.toLowerCase().includes(q) ||
              j.device?.model?.toLowerCase().includes(q)
          );
        }
        return {
          type: "jobs" as const,
          title: "Completed Repairs",
          subtitle: "Hardware repairs verified, tested, and resolved",
          icon: CheckCircle2,
          color: "#10b981",
          count: list.length,
          total: completedRepairs,
          fullLink: "/jobs?status=completed",
          linkText: "Open in Repair Job Cards →",
          items: list,
        };
      }
      case "delivered_phones": {
        let list = devices.filter((d) => d.status === "ready_for_sale" || d.status === "sold");
        if (q) {
          list = list.filter(
            (d) =>
              d.brand?.toLowerCase().includes(q) ||
              d.model?.toLowerCase().includes(q) ||
              (d.imei1 || d.imei || "").toLowerCase().includes(q)
          );
        }
        return {
          type: "devices" as const,
          title: "Delivered & Ready Handsets",
          subtitle: "Phones ready for customer handover or marked sold/delivered",
          icon: CheckSquare,
          color: "#059669",
          count: list.length,
          total: deliveredPhones,
          fullLink: "/devices?status=ready_for_sale",
          linkText: "Open in Phone Inventory →",
          items: list,
        };
      }
      case "spare_parts": {
        let list = parts;
        if (q) {
          list = list.filter(
            (p) =>
              p.part_name?.toLowerCase().includes(q) ||
              p.sku?.toLowerCase().includes(q) ||
              p.category?.toLowerCase().includes(q)
          );
        }
        return {
          type: "parts" as const,
          title: "Spare Parts Inventory",
          subtitle: "Display screens, batteries, ports, and hardware components",
          icon: Wrench,
          color: "#0176d3",
          count: list.length,
          total: parts.length,
          fullLink: "/parts",
          linkText: "Open in Spare Parts & FIFO →",
          items: list,
        };
      }
      case "accessories": {
        let list = accessories;
        if (q) {
          list = list.filter(
            (a) =>
              a.name?.toLowerCase().includes(q) ||
              a.sku?.toLowerCase().includes(q) ||
              a.category?.toLowerCase().includes(q) ||
              (a.barcode || "").toLowerCase().includes(q)
          );
        }
        return {
          type: "accessories" as const,
          title: "Accessories Stock",
          subtitle: "Chargers, cables, tempered glass, cases, and audio accessories",
          icon: Headphones,
          color: "#8b5cf6",
          count: list.length,
          total: accessories.length,
          fullLink: "/accessories",
          linkText: "Open in Accessories →",
          items: list,
        };
      }
      case "low_stock": {
        let pList = lowStockParts;
        let aList = lowStockAccessories;
        if (q) {
          pList = pList.filter((p) => p.part_name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
          aList = aList.filter((a) => a.name?.toLowerCase().includes(q) || a.sku?.toLowerCase().includes(q));
        }
        return {
          type: "low_stock" as const,
          title: "Low Stock Reorder Alerts",
          subtitle: "Parts and accessories below minimum safety threshold",
          icon: AlertTriangle,
          color: "#ea580c",
          count: pList.length + aList.length,
          total: totalLowStockAlerts,
          fullLink: "/parts",
          linkText: "Open in Spare Parts →",
          parts: pList,
          accessories: aList,
        };
      }
      case "urgent_priority": {
        let list = filteredJobs.filter((j) => (j.priority || "").toLowerCase() === "urgent");
        if (q) {
          list = list.filter(
            (j) =>
              String(j.job_number || "").toLowerCase().includes(q) ||
              j.title?.toLowerCase().includes(q) ||
              j.complaint?.toLowerCase().includes(q) ||
              j.device?.brand?.toLowerCase().includes(q) ||
              j.device?.model?.toLowerCase().includes(q)
          );
        }
        return {
          type: "jobs" as const,
          title: "Urgent Priority Repairs",
          subtitle: "Critical repair jobs requiring immediate bench attention",
          icon: AlertTriangle,
          color: "#dc2626",
          count: list.length,
          total: urgentCount,
          fullLink: "/jobs?priority=urgent",
          linkText: "Open in Repair Job Cards →",
          items: list,
        };
      }
      case "high_priority": {
        let list = filteredJobs.filter((j) => (j.priority || "").toLowerCase() === "high");
        if (q) {
          list = list.filter(
            (j) =>
              String(j.job_number || "").toLowerCase().includes(q) ||
              j.title?.toLowerCase().includes(q) ||
              j.complaint?.toLowerCase().includes(q) ||
              j.device?.brand?.toLowerCase().includes(q) ||
              j.device?.model?.toLowerCase().includes(q)
          );
        }
        return {
          type: "jobs" as const,
          title: "High Priority Repairs",
          subtitle: "High priority tickets in workshop queue",
          icon: Clock,
          color: "#ea580c",
          count: list.length,
          total: highCount,
          fullLink: "/jobs?priority=high",
          linkText: "Open in Repair Job Cards →",
          items: list,
        };
      }
      case "normal_priority": {
        let list = filteredJobs.filter((j) => !j.priority || (j.priority || "").toLowerCase() === "normal");
        if (q) {
          list = list.filter(
            (j) =>
              String(j.job_number || "").toLowerCase().includes(q) ||
              j.title?.toLowerCase().includes(q) ||
              j.complaint?.toLowerCase().includes(q) ||
              j.device?.brand?.toLowerCase().includes(q) ||
              j.device?.model?.toLowerCase().includes(q)
          );
        }
        return {
          type: "jobs" as const,
          title: "Normal Priority Repairs",
          subtitle: "Standard repair jobs in regular workshop bench workflow",
          icon: ClipboardList,
          color: "#16a34a",
          count: list.length,
          total: normalCount,
          fullLink: "/jobs?priority=normal",
          linkText: "Open in Repair Job Cards →",
          items: list,
        };
      }
      case "low_priority": {
        let list = filteredJobs.filter((j) => (j.priority || "").toLowerCase() === "low");
        if (q) {
          list = list.filter(
            (j) =>
              String(j.job_number || "").toLowerCase().includes(q) ||
              j.title?.toLowerCase().includes(q) ||
              j.complaint?.toLowerCase().includes(q) ||
              j.device?.brand?.toLowerCase().includes(q) ||
              j.device?.model?.toLowerCase().includes(q)
          );
        }
        return {
          type: "jobs" as const,
          title: "Low Priority Repairs",
          subtitle: "Buffer / non-critical repair tasks",
          icon: Layers,
          color: "#64748b",
          count: list.length,
          total: lowCount,
          fullLink: "/jobs?priority=low",
          linkText: "Open in Repair Job Cards →",
          items: list,
        };
      }
      default:
        return null;
    }
  }, [
    activeFilterId,
    filterSearch,
    devices,
    filteredDevices,
    filteredJobs,
    parts,
    accessories,
    lowStockParts,
    lowStockAccessories,
    pendingRepairs,
    assignedRepairs,
    inProgressRepairs,
    qcTestingRepairs,
    completedRepairs,
    deliveredPhones,
    totalLowStockAlerts,
    urgentCount,
    highCount,
    normalCount,
    lowCount,
    dateFilter,
  ]);

  return (
    <>
      {/* Page Header */}
      <div className="page-head">
        <div>
          <div className="eyebrow">REAL-TIME WORKSHOP COMMAND CENTER</div>
          <h1 style={{ fontSize: "22px", letterSpacing: "-0.5px", margin: 0 }}>
            Mobile Repair Workshop Overview
          </h1>
          <p>Live repair lifecycle tracking, technician bench workload, and inventory valuation.</p>
        </div>

        {/* Date Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              background: "#fff",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              padding: "3px",
              gap: "2px",
            }}
          >
            {(
              [
                { label: "All Time", value: "all" },
                { label: "Today", value: "today" },
                { label: "This Week", value: "week" },
                { label: "This Month", value: "month" },
              ] as const
            ).map((f) => (
              <button
                key={f.value}
                onClick={() => setDateFilter(f.value)}
                style={{
                  border: 0,
                  borderRadius: "6px",
                  padding: "6px 12px",
                  fontSize: "11px",
                  fontWeight: dateFilter === f.value ? 700 : 500,
                  background: dateFilter === f.value ? "#0176d3" : "transparent",
                  color: dateFilter === f.value ? "#fff" : "#64748b",
                  cursor: "pointer",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="date-chip">
            <Calendar size={13} style={{ display: "inline-block", marginRight: "4px" }} />
            {new Date().toLocaleDateString("en-IN", {
              weekday: "short",
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </div>
        </div>
      </div>

      {/* 11 Real-Time KPI Cards (Organized Grid) */}
      <div className="dashboard-kpi-grid">
        {all11Stats.map(({ id, label, value, icon: Icon, color, subtitle, link }) => {
          const isActive = activeFilterId === id;
          return (
            <div
              key={label}
              onClick={() => handleCardClick(id)}
              className={`stat-card clickable ${isActive ? "active" : ""}`}
              style={{
                cursor: "pointer",
                position: "relative",
              }}
              title={`Click to show ${label} data below`}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div className={`stat-icon ${color}`} style={{ width: "34px", height: "34px", marginBottom: "8px" }}>
                  <Icon size={18} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {isActive && (
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        color: "#0176d3",
                        background: "#e0f2fe",
                        padding: "2px 6px",
                        borderRadius: "10px",
                        letterSpacing: "0.2px",
                      }}
                    >
                      ● VIEWING
                    </span>
                  )}
                  <Link
                    to={link}
                    onClick={(e) => e.stopPropagation()}
                    title={`Open full ${label} module`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#64748b",
                      padding: "2px",
                      borderRadius: "4px",
                    }}
                  >
                    <ArrowUpRight size={14} className="muted" />
                  </Link>
                </div>
              </div>
              <div className="stat-label" style={{ fontSize: "11px" }}>{label}</div>
              <div className="stat-value" style={{ fontSize: "24px", margin: "4px 0" }}>
                {loading ? "..." : value}
              </div>
              <div className="stat-foot" style={{ fontSize: "10px" }}>{subtitle}</div>
            </div>
          );
        })}
      </div>

      {/* Interactive Filtered Drilldown Panel */}
      {activeFilteredData && (
        <div
          ref={drilldownRef}
          className="panel"
          style={{
            marginBottom: "24px",
            border: `2px solid ${activeFilteredData.color}`,
            borderRadius: "12px",
            boxShadow: "0 4px 20px rgba(1, 118, 211, 0.08)",
          }}
        >
          {/* Header */}
          <div
            className="section-head"
            style={{
              paddingBottom: "14px",
              borderBottom: "1px solid #edf2f7",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: `${activeFilteredData.color}15`,
                  color: activeFilteredData.color,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                {React.createElement(activeFilteredData.icon, { size: 20 })}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h2 style={{ fontSize: "16px", margin: 0, color: "#0f172a" }}>
                    {activeFilteredData.title}
                  </h2>
                  <span
                    style={{
                      background: `${activeFilteredData.color}18`,
                      color: activeFilteredData.color,
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "12px",
                    }}
                  >
                    {activeFilteredData.count} record{activeFilteredData.count !== 1 ? "s" : ""}
                  </span>
                </div>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                  {activeFilteredData.subtitle}
                </p>
              </div>
            </div>

            {/* Controls: Search, Full Module Link, Close */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginLeft: "auto", flexWrap: "wrap" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#f8fafc",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "0 10px",
                  height: "36px",
                }}
              >
                <Search size={15} style={{ color: "#94a3b8" }} />
                <input
                  type="text"
                  placeholder="Filter these records..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  style={{
                    border: 0,
                    outline: "none",
                    background: "transparent",
                    fontSize: "12px",
                    color: "#0f172a",
                    width: "160px",
                  }}
                />
                {filterSearch && (
                  <button
                    onClick={() => setFilterSearch("")}
                    style={{ background: "transparent", border: 0, cursor: "pointer", padding: 0, color: "#94a3b8" }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <Link
                to={activeFilteredData.fullLink}
                className="secondary-btn"
                style={{
                  fontSize: "12px",
                  height: "36px",
                  padding: "0 12px",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>{activeFilteredData.linkText}</span>
                <ExternalLink size={13} />
              </Link>

              <button
                type="button"
                onClick={() => setActiveFilterId(null)}
                className="icon-btn"
                title="Close filtered view"
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#64748b",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Table Content */}
          <div className="table-wrap" style={{ marginTop: "12px" }}>
            {/* JOBS TABLE */}
            {activeFilteredData.type === "jobs" && (
              activeFilteredData.items.length === 0 ? (
                <div style={{ textAlign: "center", padding: "36px", color: "#64748b", fontSize: "13px" }}>
                  No repair jobs found matching this filter.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Job #</th>
                      <th>Handset / Device</th>
                      <th>Complaint & Diagnosis</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Assigned Tech</th>
                      <th>Created</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeFilteredData.items.map((job: Job) => {
                      const priorityColor =
                        (job.priority || "").toLowerCase() === "urgent"
                          ? "#dc2626"
                          : (job.priority || "").toLowerCase() === "high"
                          ? "#ea580c"
                          : (job.priority || "").toLowerCase() === "normal"
                          ? "#16a34a"
                          : "#64748b";

                      const statusColor =
                        job.status === "completed"
                          ? "#15803d"
                          : job.status === "in_progress"
                          ? "#ea580c"
                          : job.status === "assigned"
                          ? "#0176d3"
                          : "#64748b";

                      return (
                        <tr key={job.id}>
                          <td>
                            <b style={{ color: "#0176d3", fontFamily: "monospace" }}>
                              {job.job_number || "JOB-TICKET"}
                            </b>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: "#1e293b" }}>
                              {job.device?.brand || "Handset"} {job.device?.model || ""}
                            </div>
                            {job.device?.imei && (
                              <small style={{ color: "#64748b", fontSize: "10px" }}>
                                IMEI: {job.device.imei}
                              </small>
                            )}
                          </td>
                          <td>
                            <div style={{ color: "#334155", fontSize: "12px" }}>
                              {job.complaint || job.title || "Hardware repair"}
                            </div>
                            {job.diagnosis && (
                              <small style={{ color: "#64748b", fontSize: "11px" }}>
                                Diag: {job.diagnosis}
                              </small>
                            )}
                          </td>
                          <td>
                            <span
                              style={{
                                color: priorityColor,
                                fontWeight: 700,
                                fontSize: "10.5px",
                                textTransform: "capitalize",
                                background: `${priorityColor}15`,
                                padding: "2px 8px",
                                borderRadius: "10px",
                              }}
                            >
                              {job.priority || "Normal"}
                            </span>
                          </td>
                          <td>
                            <span
                              className="tag"
                              style={{
                                color: statusColor,
                                background: `${statusColor}18`,
                                fontSize: "10.5px",
                                fontWeight: 600,
                                textTransform: "capitalize",
                              }}
                            >
                              {(job.status || "received").replace(/_/g, " ")}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: "12px", color: "#334155" }}>
                              {job.assignments?.[0]?.technician?.full_name ||
                                (job.assignments?.[0]?.technician_id
                                  ? staffList.find((s) => s.id === job.assignments?.[0]?.technician_id)?.full_name ||
                                    "Assigned Tech"
                                  : "Unassigned")}
                            </span>
                          </td>
                          <td>
                            <small style={{ color: "#64748b" }}>
                              {job.created_at ? new Date(job.created_at).toLocaleDateString("en-IN") : "—"}
                            </small>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Link to={`/jobs`} className="secondary-btn" style={{ fontSize: "11px", padding: "4px 8px", textDecoration: "none" }}>
                              View Job →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}

            {/* DEVICES TABLE */}
            {activeFilteredData.type === "devices" && (
              activeFilteredData.items.length === 0 ? (
                <div style={{ textAlign: "center", padding: "36px", color: "#64748b", fontSize: "13px" }}>
                  No devices found matching this filter.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Brand & Model</th>
                      <th>IMEI Number</th>
                      <th>Storage & Color</th>
                      <th>Current Status</th>
                      <th>Intake Date</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeFilteredData.items.map((dev: Device) => (
                      <tr key={dev.id}>
                        <td>
                          <b style={{ color: "#1e293b" }}>{dev.brand} {dev.model}</b>
                        </td>
                        <td>
                          <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#0176d3" }}>
                            {dev.imei || dev.imei1 || "No IMEI"}
                          </span>
                        </td>
                        <td style={{ fontSize: "12px", color: "#475569" }}>
                          {dev.storage_capacity || "128GB"} • {dev.color || "Standard"}
                        </td>
                        <td>
                          <span
                            className="tag"
                            style={{
                              background:
                                dev.status === "ready_for_sale" || dev.status === "sold"
                                  ? "#dcfce7"
                                  : dev.status === "in_repair"
                                  ? "#ffedd5"
                                  : "#e0f2fe",
                              color:
                                dev.status === "ready_for_sale" || dev.status === "sold"
                                  ? "#15803d"
                                  : dev.status === "in_repair"
                                  ? "#c2410c"
                                  : "#0369a1",
                              fontWeight: 600,
                              textTransform: "capitalize",
                            }}
                          >
                            {(dev.status || "received").replace(/_/g, " ")}
                          </span>
                        </td>
                        <td>
                          <small style={{ color: "#64748b" }}>
                            {dev.created_at ? new Date(dev.created_at).toLocaleDateString("en-IN") : "—"}
                          </small>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Link to="/devices" className="secondary-btn" style={{ fontSize: "11px", padding: "4px 8px", textDecoration: "none" }}>
                            View Device →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {/* SPARE PARTS TABLE */}
            {activeFilteredData.type === "parts" && (
              activeFilteredData.items.length === 0 ? (
                <div style={{ textAlign: "center", padding: "36px", color: "#64748b", fontSize: "13px" }}>
                  No spare parts found matching this filter.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Part Name</th>
                      <th>SKU Code</th>
                      <th>Category</th>
                      <th>Current Stock</th>
                      <th>Reorder Level</th>
                      <th>Unit Cost</th>
                      <th>Stock Status</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeFilteredData.items.map((part: Part) => {
                      const isLow = (part.quantity || part.current_stock || 0) <= (part.reorder_level || 5);
                      return (
                        <tr key={part.id}>
                          <td><b style={{ color: "#1e293b" }}>{part.part_name || part.name}</b></td>
                          <td><span style={{ fontFamily: "monospace", color: "#0176d3" }}>{part.sku}</span></td>
                          <td><span className="tag">{part.category || "General"}</span></td>
                          <td>
                            <b style={{ fontSize: "14px", color: isLow ? "#dc2626" : "#15803d" }}>
                              {part.quantity ?? part.current_stock ?? 0}
                            </b>
                          </td>
                          <td>{part.reorder_level || 5} units</td>
                          <td>₹{Number(part.unit_cost || 0).toLocaleString("en-IN")}</td>
                          <td>
                            <span
                              style={{
                                fontSize: "10.5px",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "10px",
                                background: isLow ? "#fee2e2" : "#dcfce7",
                                color: isLow ? "#991b1b" : "#166534",
                              }}
                            >
                              {isLow ? "Low Stock (Reorder)" : "In Stock"}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Link to="/parts" className="secondary-btn" style={{ fontSize: "11px", padding: "4px 8px", textDecoration: "none" }}>
                              View Part →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}

            {/* ACCESSORIES TABLE */}
            {activeFilteredData.type === "accessories" && (
              activeFilteredData.items.length === 0 ? (
                <div style={{ textAlign: "center", padding: "36px", color: "#64748b", fontSize: "13px" }}>
                  No accessories found matching this filter.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Accessory Name</th>
                      <th>Category</th>
                      <th>SKU / Barcode</th>
                      <th>Current Stock</th>
                      <th>Min Safety Stock</th>
                      <th>Selling Price</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeFilteredData.items.map((acc: Accessory) => {
                      const isLow = acc.current_stock <= acc.minimum_stock;
                      return (
                        <tr key={acc.id}>
                          <td><b style={{ color: "#1e293b" }}>{acc.name}</b></td>
                          <td><span className="tag">{acc.category}</span></td>
                          <td>
                            <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#0176d3" }}>{acc.sku}</div>
                            {acc.barcode && <small style={{ color: "#64748b" }}>{acc.barcode}</small>}
                          </td>
                          <td>
                            <b style={{ fontSize: "14px", color: isLow ? "#dc2626" : "#15803d" }}>
                              {acc.current_stock}
                            </b>
                          </td>
                          <td>{acc.minimum_stock} units</td>
                          <td>₹{Number(acc.selling_price || 0).toLocaleString("en-IN")}</td>
                          <td>
                            <span
                              style={{
                                fontSize: "10.5px",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "10px",
                                background: isLow ? "#fee2e2" : "#dcfce7",
                                color: isLow ? "#991b1b" : "#166534",
                              }}
                            >
                              {isLow ? "Low Stock" : "In Stock"}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Link to="/accessories" className="secondary-btn" style={{ fontSize: "11px", padding: "4px 8px", textDecoration: "none" }}>
                              View Item →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}

            {/* COMBINED LOW STOCK TABLE */}
            {activeFilteredData.type === "low_stock" && (
              activeFilteredData.parts.length === 0 && activeFilteredData.accessories.length === 0 ? (
                <div style={{ textAlign: "center", padding: "36px", color: "#15803d", fontSize: "13px" }}>
                  All items are healthy! No parts or accessories are currently below safety thresholds.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Item Type</th>
                      <th>Name / Description</th>
                      <th>SKU Code</th>
                      <th>Current Stock</th>
                      <th>Reorder Threshold</th>
                      <th>Deficit</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeFilteredData.parts.map((p: Part) => (
                      <tr key={`part-${p.id}`}>
                        <td>
                          <span className="tag" style={{ background: "#e0f2fe", color: "#0284c7" }}>
                            Spare Part
                          </span>
                        </td>
                        <td><b style={{ color: "#1e293b" }}>{p.part_name || p.name}</b></td>
                        <td><span style={{ fontFamily: "monospace" }}>{p.sku}</span></td>
                        <td><b style={{ color: "#dc2626" }}>{p.quantity ?? p.current_stock ?? 0}</b></td>
                        <td>{p.reorder_level || 5} units</td>
                        <td>
                          <span style={{ color: "#b91c1c", fontWeight: 700 }}>
                            -{Math.max(0, (p.reorder_level || 5) - (p.quantity ?? p.current_stock ?? 0))} needed
                          </span>
                        </td>
                        <td>
                          <Link to="/procurement" className="primary-btn" style={{ fontSize: "11px", padding: "4px 8px", textDecoration: "none" }}>
                            Create PO →
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {activeFilteredData.accessories.map((a: Accessory) => (
                      <tr key={`acc-${a.id}`}>
                        <td>
                          <span className="tag" style={{ background: "#f3e8ff", color: "#7e22ce" }}>
                            Accessory
                          </span>
                        </td>
                        <td><b style={{ color: "#1e293b" }}>{a.name}</b></td>
                        <td><span style={{ fontFamily: "monospace" }}>{a.sku}</span></td>
                        <td><b style={{ color: "#dc2626" }}>{a.current_stock}</b></td>
                        <td>{a.minimum_stock} units</td>
                        <td>
                          <span style={{ color: "#b91c1c", fontWeight: 700 }}>
                            -{Math.max(0, a.minimum_stock - a.current_stock)} needed
                          </span>
                        </td>
                        <td>
                          <Link to="/accessories" className="secondary-btn" style={{ fontSize: "11px", padding: "4px 8px", textDecoration: "none" }}>
                            Restock →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>
      )}

      {/* Visual Workflow Progress & Workload Charts */}
      <div className="dashboard-grid" style={{ marginBottom: "22px" }}>
        {/* Left: Repair Lifecycle Stages Chart */}
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Repair Stage Progression</h2>
              <p>Current distribution of repair tickets across workshop checkpoints</p>
            </div>
            <Activity size={18} className="muted" />
          </div>

          <div style={{ display: "grid", gap: "10px", marginTop: "16px" }}>
            {[
              { id: "phones_received", label: "1. Intake / Received", count: filteredJobs.filter((j) => j.status === "received").length, color: "#94a3b8" },
              { id: "assigned_repairs", label: "2. Assigned to Tech", count: assignedRepairs, color: "#818cf8" },
              { id: "in_progress_repairs", label: "3. In Bench Repair", count: inProgressRepairs, color: "#f59e0b" },
              { id: "qc_testing", label: "4. QC Testing Gate", count: qcTestingRepairs, color: "#0ea5e9" },
              { id: "completed_repairs", label: "5. Completed Repair", count: completedRepairs, color: "#10b981" },
              { id: "delivered_phones", label: "6. Handover / Delivered", count: deliveredPhones, color: "#059669" },
            ].map((stage) => {
              const maxVal = Math.max(1, filteredJobs.length);
              const pct = Math.min(100, Math.round((stage.count / maxVal) * 100));
              const isStageActive = activeFilterId === stage.id;

              return (
                <div
                  key={stage.label}
                  onClick={() => handleCardClick(stage.id)}
                  className={`stage-prog-item ${isStageActive ? "active" : ""}`}
                  style={{
                    cursor: "pointer",
                    padding: "6px 8px",
                    borderRadius: "8px",
                    background: isStageActive ? `${stage.color}18` : "transparent",
                    border: isStageActive ? `1.5px solid ${stage.color}` : "1.5px solid transparent",
                    transition: "all 0.15s ease",
                  }}
                  title={`Click to show ${stage.label} tickets`}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                    <span style={{ fontWeight: isStageActive ? 700 : 600, color: isStageActive ? stage.color : "#334155" }}>
                      {stage.label} {isStageActive && "● Active"}
                    </span>
                    <b style={{ color: stage.color }}>{stage.count} jobs</b>
                  </div>
                  <div style={{ height: "8px", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: stage.color,
                        borderRadius: "4px",
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right: Repair Priority & Inventory Breakdown */}
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Priority & Inventory Health</h2>
              <p>Job urgency classification & stock availability (Click to filter data)</p>
            </div>
            <Layers size={18} className="muted" />
          </div>

          {/* Priority Pill Counters */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "14px" }}>
            <div
              onClick={() => handleCardClick("urgent_priority")}
              className={`priority-stat-box ${activeFilterId === "urgent_priority" ? "active" : ""}`}
              style={{
                background: "#fef2f2",
                border: activeFilterId === "urgent_priority" ? "2px solid #dc2626" : "1px solid #fecaca",
                padding: "12px",
                borderRadius: "8px",
              }}
              title="Click to show Urgent Priority repair tickets"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#dc2626", textTransform: "uppercase" }}>Urgent Priority</div>
                {activeFilterId === "urgent_priority" && (
                  <span style={{ fontSize: "9px", fontWeight: 700, background: "#dc2626", color: "#fff", padding: "1px 5px", borderRadius: "8px" }}>ACTIVE</span>
                )}
              </div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#991b1b", marginTop: "2px" }}>{urgentCount}</div>
              <div style={{ fontSize: "10px", color: "#b91c1c" }}>Immediate bench attention</div>
            </div>

            <div
              onClick={() => handleCardClick("high_priority")}
              className={`priority-stat-box ${activeFilterId === "high_priority" ? "active" : ""}`}
              style={{
                background: "#fff7ed",
                border: activeFilterId === "high_priority" ? "2px solid #ea580c" : "1px solid #fed7aa",
                padding: "12px",
                borderRadius: "8px",
              }}
              title="Click to show High Priority repair tickets"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#ea580c", textTransform: "uppercase" }}>High Priority</div>
                {activeFilterId === "high_priority" && (
                  <span style={{ fontSize: "9px", fontWeight: 700, background: "#ea580c", color: "#fff", padding: "1px 5px", borderRadius: "8px" }}>ACTIVE</span>
                )}
              </div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#c2410c", marginTop: "2px" }}>{highCount}</div>
              <div style={{ fontSize: "10px", color: "#9a3412" }}>Standard priority queue</div>
            </div>

            <div
              onClick={() => handleCardClick("normal_priority")}
              className={`priority-stat-box ${activeFilterId === "normal_priority" ? "active" : ""}`}
              style={{
                background: "#f0fdf4",
                border: activeFilterId === "normal_priority" ? "2px solid #16a34a" : "1px solid #bbf7d0",
                padding: "12px",
                borderRadius: "8px",
              }}
              title="Click to show Normal Priority repair tickets"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#16a34a", textTransform: "uppercase" }}>Normal Priority</div>
                {activeFilterId === "normal_priority" && (
                  <span style={{ fontSize: "9px", fontWeight: 700, background: "#16a34a", color: "#fff", padding: "1px 5px", borderRadius: "8px" }}>ACTIVE</span>
                )}
              </div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#15803d", marginTop: "2px" }}>{normalCount}</div>
              <div style={{ fontSize: "10px", color: "#166534" }}>Regular bench workflow</div>
            </div>

            <div
              onClick={() => handleCardClick("low_priority")}
              className={`priority-stat-box ${activeFilterId === "low_priority" ? "active" : ""}`}
              style={{
                background: "#f8fafc",
                border: activeFilterId === "low_priority" ? "2px solid #64748b" : "1px solid #e2e8f0",
                padding: "12px",
                borderRadius: "8px",
              }}
              title="Click to show Low Priority repair tickets"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Low Priority</div>
                {activeFilterId === "low_priority" && (
                  <span style={{ fontSize: "9px", fontWeight: 700, background: "#64748b", color: "#fff", padding: "1px 5px", borderRadius: "8px" }}>ACTIVE</span>
                )}
              </div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#334155", marginTop: "2px" }}>{lowCount}</div>
              <div style={{ fontSize: "10px", color: "#64748b" }}>Buffer / non-critical</div>
            </div>
          </div>

          {/* Low Stock Warning Box */}
          {totalLowStockAlerts > 0 ? (
            <div
              onClick={() => handleCardClick("low_stock")}
              className={`priority-stat-box ${activeFilterId === "low_stock" ? "active" : ""}`}
              style={{
                marginTop: "14px",
                padding: "12px",
                background: "#fff7ed",
                border: activeFilterId === "low_stock" ? "2px solid #ea580c" : "1px solid #fdba74",
                borderRadius: "8px",
                cursor: "pointer",
              }}
              title="Click to show low stock parts and accessories"
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#c2410c", fontWeight: 700, fontSize: "12px" }}>
                  <AlertTriangle size={15} /> Attention: {totalLowStockAlerts} items require reordering
                </div>
                {activeFilterId === "low_stock" && (
                  <span style={{ fontSize: "9px", fontWeight: 700, background: "#ea580c", color: "#fff", padding: "1px 5px", borderRadius: "8px" }}>ACTIVE</span>
                )}
              </div>
              <div style={{ fontSize: "11px", color: "#9a3412", marginTop: "4px" }}>
                {lowStockParts.length} spare parts and {lowStockAccessories.length} accessories are below minimum safety stock levels. (Click to view)
              </div>
            </div>
          ) : (
            <div style={{ marginTop: "14px", padding: "12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", color: "#15803d", fontSize: "11px" }}>
              <b>Inventory Optimal:</b> All parts and accessories are within healthy safety stock levels.
            </div>
          )}
        </section>
      </div>

      {/* TECHNICIAN REPAIR RECORD & PERFORMANCE LEADERBOARD */}
      <section className="panel" style={{ marginBottom: "22px" }}>
        <div className="section-head">
          <div>
            <h2>Technician Workload & Repaired Handsets Record</h2>
            <p>Real-time repair counts, phones fixed, and active bench assignments per technician</p>
          </div>
          <Link to="/reports" className="secondary-btn" style={{ fontSize: "11px", textDecoration: "none" }}>
            <Users size={14} /> Full Analytics →
          </Link>
        </div>

        <div style={{ marginTop: "14px" }}>
          {technicianStats.length === 0 ? (
            <div className="empty">No technicians or repair assignments recorded yet.</div>
          ) : (
            <div className="technician-workload-grid">
              {technicianStats.map((tech) => (
                <div
                  key={tech.id}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "#e0f2fe",
                        color: "#0284c7",
                        fontWeight: 700,
                        display: "grid",
                        placeItems: "center",
                        fontSize: "14px",
                      }}
                    >
                      {tech.name[0].toUpperCase()}
                    </div>
                    <div style={{ overflow: "hidden", flex: 1 }}>
                      <b style={{ fontSize: "13px", color: "#1e293b", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {tech.name}
                      </b>
                      <span className="tag" style={{ background: "#f1f5f9", color: "#475569", fontSize: "9px" }}>
                        {tech.role === "owner" ? "Owner / Tech" : tech.role === "workshop_manager" ? "Manager" : "Bench Technician"}
                      </span>
                    </div>
                  </div>

                  {/* Repaired Count Highlight */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid #edf2f7" }}>
                    <div>
                      <small style={{ fontSize: "10px", color: "#64748b", display: "block" }}>Phones Repaired</small>
                      <b style={{ fontSize: "18px", color: "#15945b" }}>{tech.repairedCount}</b>
                    </div>
                    <div>
                      <small style={{ fontSize: "10px", color: "#64748b", display: "block" }}>In Bench Repair</small>
                      <b style={{ fontSize: "18px", color: "#ea580c" }}>{tech.inProgressCount}</b>
                    </div>
                    <div>
                      <small style={{ fontSize: "10px", color: "#64748b", display: "block" }}>Total Assigned</small>
                      <b style={{ fontSize: "18px", color: "#0176d3" }}>{tech.assignedCount}</b>
                    </div>
                  </div>

                  {/* Solved Issues Pills */}
                  {tech.solvedIssues.length > 0 && (
                    <div style={{ fontSize: "10px", color: "#64748b" }}>
                      <span style={{ fontWeight: 600, display: "block", marginBottom: "4px" }}>Problems Solved:</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {tech.solvedIssues.slice(0, 2).map((issue, idx) => (
                          <span key={idx} style={{ background: "#e8f8f0", color: "#15945b", padding: "2px 6px", borderRadius: "4px", fontSize: "9px" }}>
                            ✓ {issue.slice(0, 24)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Recent Repair Activities Queue */}
      <section className="panel" style={{ overflow: "hidden" }}>
        <div
          className="section-head"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "14px",
          }}
        >
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#0f172a" }}>
              Recent Repair Activities & Work Orders
            </h2>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0 0" }}>
              Live feed of smartphones registered, diagnosed, and repaired in the workshop
            </p>
          </div>
          <Link
            to="/jobs"
            className="secondary-btn"
            style={{
              fontSize: "12px",
              fontWeight: 600,
              padding: "7px 14px",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              borderRadius: "8px",
            }}
          >
            View Full Job Cards List →
          </Link>
        </div>

        {/* 1. Desktop View: Comprehensive 8-Column Workshop Table */}
        <div className="desktop-dashboard-jobs-table table-wrap" style={{ marginTop: "14px" }}>
          <table>
            <thead>
              <tr>
                <th>Job / Ticket #</th>
                <th>Phone Model</th>
                <th>IMEI</th>
                <th>Reported Problem</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned Tech</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                    Loading repair activity...
                  </td>
                </tr>
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                    No repair activity found for the selected date range.
                  </td>
                </tr>
              ) : (
                filteredJobs.slice(0, 8).map((job) => {
                  const jobPriority = (job.priority || "normal").toLowerCase();
                  const priorityColor =
                    jobPriority === "urgent"
                      ? "#dc2626"
                      : jobPriority === "high"
                      ? "#ea580c"
                      : "#64748b";

                  const assignedTechs =
                    job.assignments && job.assignments.length > 0
                      ? job.assignments.map((a: any) => a.technician?.full_name || a.technician_name || "Tech").join(", ")
                      : "Unassigned";

                  return (
                    <tr key={job.id}>
                      <td>
                        <b style={{ color: "#0176d3", fontFamily: "monospace" }}>
                          {job.job_number || `JOB-${job.id.slice(0, 6).toUpperCase()}`}
                        </b>
                      </td>
                      <td>
                        <b>{job.device ? `${job.device.brand} ${job.device.model}` : "Unknown Device"}</b>
                      </td>
                      <td>
                        <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#64748b" }}>
                          {job.device?.imei || job.device?.imei1 || "N/A"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "11px", color: "#334155" }}>
                          {job.problem_description || job.complaint || job.diagnosis || "Repair diagnostic"}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            color: priorityColor,
                            textTransform: "uppercase",
                          }}
                        >
                          {job.priority || "Normal"}
                        </span>
                      </td>
                      <td>
                        <span
                          className="tag"
                          style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            background:
                              job.status === "completed"
                                ? "#e8f8f0"
                                : job.status === "in_progress"
                                ? "#fff7ed"
                                : "#f1f5f9",
                            color:
                              job.status === "completed"
                                ? "#15803d"
                                : job.status === "in_progress"
                                ? "#c2410c"
                                : "#475569",
                          }}
                        >
                          {job.status.replace("_", " ")}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "11px", color: "#475569" }}>{assignedTechs}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                          {job.created_at ? new Date(job.created_at).toLocaleDateString() : "Today"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 2. Mobile View: Touch-Friendly Responsive Repair Activity Cards (No Squished Scrollbars) */}
        <div className="mobile-dashboard-jobs-cards" style={{ marginTop: "14px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "24px", color: "#64748b", background: "#f8fafc", borderRadius: "10px", fontSize: "13px" }}>
              Loading repair activity...
            </div>
          ) : filteredJobs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "26px", color: "#64748b", background: "#f8fafc", borderRadius: "10px", fontSize: "13px" }}>
              No repair activity found for the selected date range.
            </div>
          ) : (
            filteredJobs.slice(0, 8).map((job) => {
              const jobPriority = (job.priority || "normal").toLowerCase();
              const priorityBg =
                jobPriority === "urgent" ? "#fef2f2" : jobPriority === "high" ? "#fff7ed" : "#f1f5f9";
              const priorityColor =
                jobPriority === "urgent" ? "#dc2626" : jobPriority === "high" ? "#ea580c" : "#64748b";

              const assignedTechs =
                job.assignments && job.assignments.length > 0
                  ? job.assignments.map((a: any) => a.technician?.full_name || a.technician_name || "Tech").join(", ")
                  : "Unassigned";

              const isCompleted = job.status === "completed";
              const isInProgress = job.status === "in_progress";
              const isQc = job.status === "qc_pending";

              const statusBg = isCompleted ? "#e8f8f0" : isInProgress ? "#fff7ed" : isQc ? "#f1edff" : "#edf5fc";
              const statusColor = isCompleted ? "#15803d" : isInProgress ? "#c2410c" : isQc ? "#7955c7" : "#0176d3";

              const problem = job.problem_description || job.complaint || job.diagnosis;

              return (
                <div
                  key={job.id}
                  style={{
                    background: "#ffffff",
                    border: "1.5px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "13px 14px",
                    boxShadow: "0 2px 6px rgba(15, 23, 42, 0.04)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "9px",
                  }}
                >
                  {/* Top Line: Ticket Code + Status + Date */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontWeight: 800,
                          fontSize: "12.5px",
                          color: "#0176d3",
                          background: "#edf5fc",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          border: "1px solid #d4e7f8",
                        }}
                      >
                        {job.job_number || `JOB-${job.id.slice(0, 6).toUpperCase()}`}
                      </span>
                      <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                        {job.created_at ? new Date(job.created_at).toLocaleDateString("en-IN") : "Today"}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: "10.5px",
                        fontWeight: 700,
                        textTransform: "capitalize",
                        background: statusBg,
                        color: statusColor,
                        padding: "3px 9px",
                        borderRadius: "12px",
                        border: `1px solid ${statusBg}`,
                      }}
                    >
                      {job.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  {/* Device Name & IMEI */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                    <b style={{ fontSize: "14px", color: "#0f172a", fontWeight: 700 }}>
                      {job.device ? `${job.device.brand} ${job.device.model}` : "Unknown Handset"}
                    </b>
                    <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#475569", background: "#f8fafc", padding: "2px 7px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                      IMEI: {job.device?.imei || job.device?.imei1 || "N/A"}
                    </span>
                  </div>

                  {/* Problem Callout Box */}
                  {problem && (
                    <div
                      style={{
                        background: "#f8fafc",
                        borderLeft: "3px solid #0176d3",
                        borderRadius: "0 6px 6px 0",
                        padding: "7px 10px",
                        fontSize: "12px",
                        color: "#334155",
                      }}
                    >
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "2px" }}>
                        Reported Issue / Fault:
                      </span>
                      {problem}
                    </div>
                  )}

                  {/* Footer: Tech + Priority + View Action */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>Tech:</span>
                      <b style={{ fontSize: "11px", color: assignedTechs === "Unassigned" ? "#94a3b8" : "#334155" }}>
                        {assignedTechs}
                      </b>
                      <span
                        style={{
                          fontSize: "9.5px",
                          fontWeight: 700,
                          color: priorityColor,
                          background: priorityBg,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          textTransform: "uppercase",
                        }}
                      >
                        {job.priority || "Normal"}
                      </span>
                    </div>

                    <Link
                      to="/jobs"
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 600,
                        color: "#0176d3",
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px",
                      }}
                    >
                      Open Job →
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
