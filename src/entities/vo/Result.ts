import { getColumns } from "../entity"

export default class Result<T> {
  constructor(
    public status: boolean,
    public data?: T,
    public error?: string,
  ) { }
  
  public static success<T>(data: T) {
    return new Result<T>(true, data)
  }

  public static fail(error: string) {
    return new Result<null>(false, undefined, error)
  }
}

export function hide(o: Object, role: number) {
  let hiddenKey = getColumns(o).filter(k => k.visibility > role).map(k => k.key)
  Object.defineProperties(o, hiddenKey.reduce<PropertyDescriptorMap>((last, key) => 
    ({ ...last, [key]: { enumerable: false }}),
  {}))
}

export function listHide(list: Object[], role: number) {
  if (!list.length) return
  let hiddenKey = getColumns(list[0]).filter(k => k.visibility > role).map(k => k.key)
  let properties = hiddenKey.reduce<PropertyDescriptorMap>((last, key) => 
    ({ ...last, [key]: { enumerable: false }}),
  {})
  list.forEach(o => Object.defineProperties(o, properties))
}