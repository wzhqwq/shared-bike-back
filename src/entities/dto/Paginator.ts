import { CheckParam } from "../../utils/body"

export type Paginator = {
  lastId: number
  size?: number
}

export const paginatorParams: CheckParam<Paginator>[] = [
  { key: 'lastId', restrictions: ['integer', n => n > 0 ? '' : '必须为正数'] },
  { key: 'size', restrictions: ['integer', n => n > 0 ? '' : '必须为正数'], nullable: true },
]