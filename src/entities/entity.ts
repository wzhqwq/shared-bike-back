import { Connection } from "mysql";
import { CheckParam, checkProperty, lengthRestriction } from "../utils/body";
import { query } from "../utils/db";
import "reflect-metadata"

const columnsSym = Symbol()
const tableNameSym = Symbol()

export type EntityColumn = CheckParam<any> & {
  get: () => any,
  set: (o: any) => void,
  modified: boolean,
}

export function Entity(tableName: string) {
  return function <T extends { new(...args: any[]) }>(c: T) {
    return class extends c {
      private columns: EntityColumn[]
      constructor (...args: any[]) {
        super(...args)
        Reflect.defineMetadata(tableNameSym, tableName, this)
        let baseColumns = getColumns(this)
        this.columns = baseColumns.map(col => {
          let value = Reflect.get(this, col.key)
          let column = {
            ...col,
            set: (v: any) => {
              checkProperty(col, v)
              if (value === v) return
              value = v
              column.modified = true
            },
            get: () => value,
            modified: false,
          }
          Object.defineProperty(this, col.key, { set: column.set, get: column.get })
          return column
        })
      }
    }
  }
}

export function getColumns(target: Object) {
  let columns = Reflect.getMetadata(columnsSym, target) as CheckParam<any>[]
  if (!columns) {
    columns = []
    Reflect.defineMetadata(columnsSym, columns, target)
  }
  return columns
}
export function getTableName(target: Object) {
  let tableName = Reflect.getMetadata(tableNameSym, target) as string
  if (!tableName) throw new Error("对象的类没有加@Entity装饰器：" + JSON.stringify(target))
  return tableName
}

export class DbEntity<TEntity extends Object> {
  constructor(
    private c: { new (...args: any[]): TEntity },
    private connection?: Connection,
  ) { }

  public query<RowT>(sql: string, values?: any[]) {
    return query<RowT>(sql, values, this.connection)
  }

  public async save(o: TEntity) {
    let columns = Reflect.get(o, 'columns') as EntityColumn[]
    let tableName = getTableName(o)

    let id = columns.find(k => k.key === 'id')
    let modifiedKeys = columns.filter(k => k.modified)
    if (!id.get()) {
      let { insertId } = await query<null>(
        "INSERT INTO ?? (??) VALUES (?)",
        [tableName, modifiedKeys.map(k => k.key), modifiedKeys.map(k => k.get())]
      )
      id.set(insertId)
    }
    else {
      await query<null>(
        "UPDATE ?? SET ?? WHERE `id` = ?",
        [tableName, modifiedKeys.reduce((last, current) => ({ ...last, [current.key]: current.get() }), {}), id.get()]
      )
    }
    modifiedKeys.forEach(k => { k.modified = false })
  }

  public async pullBySearching(column: keyof TEntity | 'id', value: any) {
    let entity = new this.c()
    let columns = Reflect.get(entity, 'columns') as EntityColumn[]
    let tableName = getTableName(entity)

    let o = (await this.query<any>(
      "SELECT ?? FROM ?? WHERE ?? = ?",
      [columns.map(k => k.key), tableName, column, value],
    ))[0]
    if (!o) return undefined
    columns.forEach(k => k.set(o[k.key]))
    return entity
  }

  public pullById(id: number) {
    return this.pullBySearching('id', id)
  }
}

type SupportedConstructor = NumberConstructor | StringConstructor

export function Column(type: SupportedConstructor, name?: string) {
  return function (target: Object, key: string) {
    getColumns(target).push({
      key: name ?? key,
      restrictions: [type === Number ? "number" : "string"],
    })
  }
}

export function Nullable() {
  return function (target: Object, key: string) {
    getColumns(target).find(k => k.key === key).nullable = true
  }
}
export function Restriction(fn: (o: any) => string) {
  return function (target: Object, key: string) {
    getColumns(target).find(k => k.key === key).restrictions.push(fn)
  }
}
export function Length(min?: number, max?: number) {
  return Restriction(lengthRestriction(min, max))
}
