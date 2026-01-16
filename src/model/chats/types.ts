export interface Message {
  id: string;
  text: string | null;
  fromId: string;
  date: number;
  service: number | null;
  index: number;
}

export interface ChatRecord {
  id: string;
  creatorId?: string;
  name: string;
  joinedUsers: string[];
  messages: Message[];
}

export type ChatInfo = Pick<ChatRecord, 'name' | 'creatorId'> & { joinedCount: number };
