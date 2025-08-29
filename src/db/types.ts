export interface Message {
  id: string;
  userId: string;
  threadId: string;
  message: string;
  timestamp: number;
  msgIndex: number;
}

export interface Thread {
  id: string;
  users: string[];
  title: string;
  date_created: number;
}

export interface User {
  id: string;
  name: string;
  is_physician: boolean;
}
