import { useEffect, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { useAgencyStore, type Task, type Campaign } from "../store/useAgencyStore";
import { api } from "../lib/api";
import { Sidebar } from "../components/layout/Sidebar";
import { useBreakpoint } from "../hooks/useBreakpoint";

const COLUMNS: { id: Task["status"]; label: string }[] = [
  { id: "open",        label: "Teendő" },
  { id: "in_progress", label: "Folyamatban" },
  { id: "done",        label: "Kész" },
  { id: "blocked",     label: "Blokkolt" },
];

function TaskCard({ task, isDragging = false }: { task: Task; isDragging?: boolean }) {
  return (
    <div style={{
      background: "var(--parchment)",
      border: "1px solid var(--rule)",
      borderRadius: 6,
      padding: "10px 12px",
      opacity: isDragging ? 0.5 : 1,
      cursor: "grab",
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-1)", marginBottom: 4 }}>
        {task.title}
      </div>
      <div className="caption" style={{ color: "var(--ink-3)" }}>
        {task.assignedTo}
      </div>
    </div>
  );
}

function DroppableColumn({ status, label, tasks }: { status: Task["status"]; label: string; tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <div className="caption" style={{ padding: "0 4px 8px", color: "var(--ink-2)" }}>
        {label} ({tasks.length})
      </div>
      <div
        ref={setNodeRef}
        style={{
          minHeight: 120,
          background: isOver ? "var(--primary-soft)" : "var(--surface)",
          borderRadius: 6,
          padding: 8,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          transition: "background 0.15s",
        }}
      >
        {tasks.map((t) => <DraggableCard key={t.id} task={t} />)}
      </div>
    </div>
  );
}

function DraggableCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}>
      <TaskCard task={task} isDragging={isDragging} />
    </div>
  );
}

export function TasksView() {
  const { tasks, setTasks, upsertTask } = useAgencyStore();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignFilter, setCampaignFilter] = useState<string>("");
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const { isMobile } = useBreakpoint();

  useEffect(() => {
    api.tasks.list().then(setTasks).catch(console.error);
  }, [setTasks]);

  useEffect(() => {
    api.campaigns.list().then(setCampaigns).catch(() => {});
  }, []);

  function onDragStart(evt: DragStartEvent) {
    const task = tasks.find((t) => t.id === evt.active.id);
    if (task) setActiveTask(task);
  }

  async function onDragEnd(evt: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = evt;
    if (!over || active.id === over.id) return;
    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;
    const newStatus = over.id as Task["status"];
    if (task.status === newStatus) return;

    const optimistic = { ...task, status: newStatus };
    upsertTask(optimistic);
    try {
      await api.tasks.patch(task.id, { status: newStatus, current_version: task.version });
      const refreshed = await api.tasks.list();
      setTasks(refreshed);
    } catch {
      upsertTask(task); // rollback
    }
  }

  const filteredTasks = campaignFilter
    ? tasks.filter((t) => t.campaignId === campaignFilter)
    : tasks;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar activeNav="tasks" />
      <main style={{ flex: 1, padding: isMobile ? "20px 12px 88px" : "28px 32px", overflow: "auto" }}>
        <h1 className="heading" style={{ marginBottom: 24 }}>Feladatok</h1>
        {campaigns.length > 0 && (
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            style={{
              marginBottom: 16,
              padding: "4px 8px",
              border: "1px solid var(--rule)",
              borderRadius: 4,
              background: "var(--parchment)",
              fontSize: 12,
              color: "var(--ink-2)",
            }}
          >
            <option value="">Összes kampány</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        )}
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div style={{ display: "flex", gap: 16 }}>
            {COLUMNS.map((col) => (
              <DroppableColumn
                key={col.id}
                status={col.id}
                label={col.label}
                tasks={filteredTasks.filter((t) => t.status === col.id)}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask && <TaskCard task={activeTask} />}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
}
