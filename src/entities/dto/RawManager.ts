import { RawUser } from "./RawUser";

export type RawManager = RawUser & {
  name: string
  phone: string
}