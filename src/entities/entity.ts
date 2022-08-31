import { Connection, QueryOptions } from "mysql";
import { CheckParam, checkProperty, lengthRestriction } from "../utils/body";
import { query } from "../utils/db";
import "reflect-metadata"

const columnsSym = Symbol()
const tableNameSym = Symbol()

export type EntityColumn = CheckParam<any> & {
  get: () => any,
  set: (o: any) => void,
  modified: boolean,
  isPK: boolean,
  c: { new (...args: any[]) },
}

export function Entity(tableName: string) {
  return function <T extends { new(...args: any[]) }>(c: T) {
    return class extends c {
      constructor (...args: any[]) {
        super(...args)
        Reflect.defineMetadata(tableNameSym, tableName, this)
        let baseColumns = getColumns(this)
        Object.defineProperty(this, 'columns', {
          value: baseColumns.map(col => {
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
            Object.defineProperty(this, col.key, { set: column.set, get: column.get, enumerable: true })
            return column
          }),
          enumerable: false,
        }) 
      }
    }
  }
}

export function getColumns(target: Object) {
  let columns = Reflect.getMetadata(columnsSym, target) as Omit<EntityColumn, 'get' | 'set' | 'modified'>[]
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

abstract class BaseDb<TEntity extends Object> {
  constructor(
    private connection?: Connection,
  ) { }

  public query<RowT>(sql: string | QueryOptions, values?: any[]) {
    return query<RowT>(sql, values, this.connection)
  }
  
  public async pullBySearching(conditions: ConditionType<any>[]){
    return (await this.list(conditions))[0]
  }
  abstract list(conditions?: ConditionType<any>[], limit?: number): Promise<TEntity[]>
}

type TableInfo<TEntity extends Object> = [string, any[], { new (...args: any[]): TEntity }]
export class DbEntity<TEntity extends Object> extends BaseDb<TEntity> {
  constructor(
    protected c: { new (...args: any[]): TEntity },
    connection?: Connection
  ) {
    super(connection)
  }

  public async save(o: TEntity, forceInsert: boolean = false) {
    let columns = Reflect.get(o, 'columns') as EntityColumn[]
    let tableName = getTableName(o)

    let id = columns.find(k => k.isPK)
    let modifiedKeys = columns.filter(k => k.modified)
    if (!id.get() || forceInsert) {
      let { insertId } = await query<null>(
        "INSERT INTO ?? (??) VALUES (?)",
        [tableName, modifiedKeys.map(k => k.key), modifiedKeys.map(k => k.get())]
      )
      id.set(insertId)
    }
    else {
      await query<null>(
        "UPDATE ?? SET ? WHERE ?? = ?",
        [tableName, modifiedKeys.reduce((last, current) => ({ ...last, [current.key]: current.get() }), {}),
          id.key, id.get()]
      )
    }
    modifiedKeys.forEach(k => { k.modified = false })
  }

  public async list(conditions: ConditionType<TEntity>[] = [], limit?: number) {
    let tableName = getTableName(new this.c())
    let [whereClause, additionalValues] = parseCondition(conditions)

    return (await this.query<any>(
      "SELECT * FROM ??" + (whereClause ? ` WHERE ${whereClause}` : '') + (limit ? ` LIMIT ${limit}` : ''),
      [tableName, ...additionalValues],
    )).map(o => {
      let entity = new this.c()
      let columns = Reflect.get(entity, 'columns') as EntityColumn[]
      columns.forEach(k => k.set(o[k.key]))
      return entity
    })
  }

  public asTable(conditions: ConditionType<TEntity>[] = [], limit?: number): TableInfo<TEntity> {
    let tableName = getTableName(new this.c())
    let [whereClause, additionalValues] = parseCondition(conditions)

    return [
      whereClause && limit ?
        "SELECT * FROM ??" + (whereClause ? ` WHERE ${whereClause}` : '') + (limit ? ` LIMIT ${limit}` : '') :
        "??",
      [tableName, ...additionalValues],
      this.c,
    ]
  }
}

export class DbJoined<TLeft extends Object, TRight extends Object> extends BaseDb<[TLeft, TRight]> {
  constructor(
    private leftTable: TableInfo<TLeft>,
    private rightTable: TableInfo<TRight>,
    private joinColumn: keyof TLeft,
    connection?: Connection,
  ) {
    super(connection)
  }

  public async list(conditions: ConditionType<TLeft | TRight>[] = [], limit?: number) {
    let [whereClause, additionalValues] = parseCondition(conditions)
    let LeftC = this.leftTable[2], RightC = this.rightTable[2]
    let leftId = getColumns(new LeftC()).find(k => k.key === this.joinColumn).key
    let rightId = getColumns(new RightC()).find(k => k.isPK).key
    let leftTableName = getTableName(new LeftC()), rightTableName = getTableName(new RightC())
    let q: QueryOptions = {
      sql: `SELECT * FROM (${this.leftTable[0]}) AS left JOIN (${this.rightTable[0]}) AS right ON left.?? = right.??` +
        (whereClause ? ` WHERE ${whereClause}` : '') + (limit ? ` LIMIT ${limit}` : ''),
      nestTables: true
    }
    return (await this.query(q,
      [...this.leftTable[1], ...this.rightTable[1], leftId, rightId, ...additionalValues],
    )).map<[TLeft, TRight]>(o => {
      let left = new LeftC(), right = new RightC()
      let leftColumns = Reflect.get(left, 'columns') as EntityColumn[]
      let rightColumns = Reflect.get(right, 'columns') as EntityColumn[]
      leftColumns.forEach(k => k.set(o[leftTableName][k.key]))
      rightColumns.forEach(k => k.set(o[rightTableName][k.key]))
      return [left, right]
    })
  }
}

export type OperatorType = '=' | '>' | '<' | '>=' | '<=' | '<>'
export type AggregationFnType = 'COUNT' | 'SUM' | 'AVG'
export type ConditionKeyType<TEntity extends Object> = keyof TEntity | { fn: AggregationFnType, key: keyof TEntity | '*' }
export type ConditionType<TEntity extends Object> = [ConditionKeyType<TEntity>, OperatorType, any]
function parseCondition<TEntity extends Object>(conditions: ConditionType<TEntity>[]): [string, any[]] {
  let sql = conditions.map(c => `?? ${c[1]} ?`).join(' AND ')
  let values = conditions.flatMap(c => [
    typeof c[0] === 'object' ? `${c[0].fn}(${c[0].key.toString()})` : c[0].toString(),
    c[2]
  ])
  return [sql, values]
}

type SupportedConstructor = NumberConstructor | StringConstructor | DateConstructor

export function Column(type: SupportedConstructor, name?: string) {
  return function (target: Object, key: string) {
    getColumns(target).push({
      key: name ?? key,
      restrictions: [type === Number ? "number" : "string"],
      isPK: false,
      c: type
    })
  }
}

export function Id() {
  return function (target: Object, key: string) {
    getColumns(target).find(k => k.key === key).isPK = true
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

export function getRestrictions<TEntity extends Object>(c: { new (...args: any[]): TEntity }, key: keyof TEntity) {
  return getColumns(new c()).find(k => k.key === key)?.restrictions
}