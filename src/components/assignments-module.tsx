"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Role } from "@prisma/client";

type CourseOption = {
  id: string;
  code: string;
  title: string;
  teacherId: string | null;
};

type AssignmentItem = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  maxPoints: number;
  createdAt: string;
  updatedAt: string;
  course: CourseOption;
};

type Props = {
  role: Role;
};

const toDateInput = (value: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
};

export function AssignmentsModule({ role }: Props) {
  const canManage = role === Role.SUPER_ADMIN || role === Role.TEACHER;

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [createCourseId, setCreateCourseId] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createDueAt, setCreateDueAt] = useState("");
  const [createMaxPoints, setCreateMaxPoints] = useState("100");
  const [createPending, setCreatePending] = useState(false);

  const [editId, setEditId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueAt, setEditDueAt] = useState("");
  const [editMaxPoints, setEditMaxPoints] = useState("100");
  const [editPending, setEditPending] = useState(false);
  const [deletePendingId, setDeletePendingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/assignments", { method: "GET" });
      const raw = await response.text();
      const result = raw
        ? (JSON.parse(raw) as { courses?: CourseOption[]; assignments?: AssignmentItem[]; error?: string })
        : {};

      if (!response.ok) {
        setError(result.error ?? "Unable to load assignments.");
        setCourses([]);
        setAssignments([]);
        return;
      }

      const nextCourses = result.courses ?? [];
      setCourses(nextCourses);
      setAssignments(result.assignments ?? []);

      setCreateCourseId((prev) => prev || nextCourses[0]?.id || "");
    } catch {
      setError("Unable to load assignments.");
      setCourses([]);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!editId) return;
    const selected = assignments.find((item) => item.id === editId);
    if (!selected) return;
    setEditTitle(selected.title);
    setEditDescription(selected.description ?? "");
    setEditDueAt(toDateInput(selected.dueAt));
    setEditMaxPoints(String(selected.maxPoints));
  }, [assignments, editId]);

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatePending(true);
    setError("");
    try {
      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: createCourseId,
          title: createTitle,
          description: createDescription,
          dueAt: createDueAt || null,
          maxPoints: createMaxPoints,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to create assignment.");
        return;
      }
      setCreateTitle("");
      setCreateDescription("");
      setCreateDueAt("");
      setCreateMaxPoints("100");
      await load();
    } catch {
      setError("Unable to create assignment.");
    } finally {
      setCreatePending(false);
    }
  };

  const onUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editId) return;
    setEditPending(true);
    setError("");
    try {
      const response = await fetch("/api/assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: editId,
          title: editTitle,
          description: editDescription,
          dueAt: editDueAt || null,
          maxPoints: editMaxPoints,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to update assignment.");
        return;
      }
      setEditId("");
      await load();
    } catch {
      setError("Unable to update assignment.");
    } finally {
      setEditPending(false);
    }
  };

  const onDelete = async (assignmentId: string) => {
    if (!window.confirm("Delete this assignment?")) return;
    setDeletePendingId(assignmentId);
    setError("");
    try {
      const response = await fetch("/api/assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to delete assignment.");
        return;
      }
      await load();
    } catch {
      setError("Unable to delete assignment.");
    } finally {
      setDeletePendingId("");
    }
  };

  return (
    <section className="grid gap-4">
      <section className="brand-card p-5">
        <p className="brand-section-title">Assignment List</p>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="brand-muted mt-3 text-sm">Loading assignments...</p> : null}

        {!loading && assignments.length ? (
          <table className="mt-3 min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#d2e4fb] text-[#285f9f]">
                <th className="px-3 py-2 font-semibold">Course</th>
                <th className="px-3 py-2 font-semibold">Title</th>
                <th className="px-3 py-2 font-semibold">Due</th>
                <th className="px-3 py-2 font-semibold">Max Points</th>
                {canManage ? <th className="px-3 py-2 font-semibold">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {assignments.map((item) => (
                <tr key={item.id} className="border-b border-[#e7f0fc] text-[#0d3f80]">
                  <td className="px-3 py-2">{item.course.code} - {item.course.title}</td>
                  <td className="px-3 py-2">
                    <p>{item.title}</p>
                    {item.description ? <p className="mt-1 text-xs text-[#3768ac]">{item.description}</p> : null}
                  </td>
                  <td className="px-3 py-2">{formatDate(item.dueAt)}</td>
                  <td className="px-3 py-2">{item.maxPoints}</td>
                  {canManage ? (
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                          onClick={() => setEditId(item.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-700"
                          disabled={deletePendingId === item.id}
                          onClick={() => void onDelete(item.id)}
                        >
                          {deletePendingId === item.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {!loading && !assignments.length ? <p className="brand-muted mt-3 text-sm">No assignments found.</p> : null}
      </section>

      {canManage ? (
        <section className="brand-card p-5">
          <p className="brand-section-title">Create Assignment</p>
          <form className="mt-3 grid gap-3" onSubmit={onCreate}>
            <select className="brand-input" value={createCourseId} onChange={(event) => setCreateCourseId(event.currentTarget.value)} required>
              <option value="">Select course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.code} - {course.title}</option>
              ))}
            </select>
            <input className="brand-input" placeholder="Assignment title" value={createTitle} onChange={(event) => setCreateTitle(event.currentTarget.value)} required />
            <textarea className="brand-input min-h-[84px]" placeholder="Description" value={createDescription} onChange={(event) => setCreateDescription(event.currentTarget.value)} />
            <div className="grid gap-3 md:grid-cols-2">
              <input className="brand-input" type="date" value={createDueAt} onChange={(event) => setCreateDueAt(event.currentTarget.value)} />
              <input className="brand-input" type="number" min="1" step="0.01" value={createMaxPoints} onChange={(event) => setCreateMaxPoints(event.currentTarget.value)} />
            </div>
            <button className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold" disabled={createPending}>
              {createPending ? "Creating..." : "Create Assignment"}
            </button>
          </form>
        </section>
      ) : null}

      {canManage && editId ? (
        <section className="brand-card p-5">
          <p className="brand-section-title">Edit Assignment</p>
          <form className="mt-3 grid gap-3" onSubmit={onUpdate}>
            <input className="brand-input" value={editTitle} onChange={(event) => setEditTitle(event.currentTarget.value)} required />
            <textarea className="brand-input min-h-[84px]" value={editDescription} onChange={(event) => setEditDescription(event.currentTarget.value)} />
            <div className="grid gap-3 md:grid-cols-2">
              <input className="brand-input" type="date" value={editDueAt} onChange={(event) => setEditDueAt(event.currentTarget.value)} />
              <input className="brand-input" type="number" min="1" step="0.01" value={editMaxPoints} onChange={(event) => setEditMaxPoints(event.currentTarget.value)} />
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-brand-secondary px-4 py-2 text-sm font-semibold" disabled={editPending}>
                {editPending ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" className="rounded-md border border-[#9bbfed] px-4 py-2 text-sm font-semibold text-[#1f518f]" onClick={() => setEditId("")}>Cancel</button>
            </div>
          </form>
        </section>
      ) : null}
    </section>
  );
}
