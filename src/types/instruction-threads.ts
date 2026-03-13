// src/types/instruction-threads.ts

export type ThreadStatus = "OPEN" | "ANSWERED" | "CLOSED";

export type ThreadAuthor = {
  id: string;
  name: string | null;
  image: string | null;
  role?: string;
};

export type ThreadModule = {
  id: string;
  title: string;
};

export type ThreadCourse = {
  id: string;
  title: string;
  code: string;
  teacherId: string | null;
};

export type ThreadSummary = {
  id: string;
  courseId: string;
  studentId: string;
  moduleId: string | null;
  subject: string;
  status: ThreadStatus;
  isPinned: boolean;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  student: ThreadAuthor;
  module: ThreadModule | null;
  course?: ThreadCourse;
  _count: { messages: number };
};

export type MessageNode = {
  id: string;
  threadId: string;
  parentId: string | null;
  authorId: string;
  body: string;
  isTeacherReply: boolean;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: ThreadAuthor;
  replies: MessageNode[];
};

export type ThreadDetail = {
  id: string;
  courseId: string;
  studentId: string;
  moduleId: string | null;
  subject: string;
  status: ThreadStatus;
  isPinned: boolean;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  student: ThreadAuthor;
  module: ThreadModule | null;
  course: ThreadCourse;
  messages: MessageNode[];
};
