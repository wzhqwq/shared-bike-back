import { CheckParamsProperties } from "../../utils/body"

export type Paginator = {
  lastId: string
  size?: string
}

export const paginatorParams: CheckParamsProperties<Paginator>[] = [
  { key: 'lastId', restrictions: ['integer', 'positive'] },
  { key: 'size', restrictions: ['integer', 'positive'], nullable: true, default: '10' },
]