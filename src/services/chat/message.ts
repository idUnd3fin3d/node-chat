import { nanoid } from 'nanoid';
import moment from 'moment';

export const SERVICE_TYPES = {
  CHAT_CREATED: 0,
  CHAT_JOINED: 1,
  CHAT_LEFT: 2,
};

export class Message {
  id: string;
  text: string | null;
  fromId: string;
  date: number;
  service: number | null;
  index: number;

  constructor(text: string | null, fromId: string, service?: number) {
    this.id = nanoid();
    this.text = text;
    this.fromId = fromId;
    this.service = service ?? null;
    this.date = moment().valueOf();
    this.index = -1;
  }

  setIndex(index: number) {
    this.index = index;

    return this;
  }
}
