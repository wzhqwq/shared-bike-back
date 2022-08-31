import { RawUser } from "./RawUser";

export type RawMaintainer = RawUser & {
  name: string
  phone: string
  handle_count: number
}