import { Thread, Message, User } from "./types";

/*
  Converts DB rows into objects with the correct types
*/

export const convertThread = (row: any): Thread => ({
  id: row.id,
  users: JSON.parse(row.users),
  title: row.title,
  date_created: row.date_created,
});

export const convertUser = (row: any): User => ({
  id: row.id,
  name: row.name,
  is_physician: !!row.is_physician,
});

export const convertMessage = (row: any): Message => ({
  id: row.id,
  userId: row.userId,
  threadId: row.threadId,
  message: row.message,
  timestamp: row.timestamp,
  msgIndex: row.msgIndex,
});
