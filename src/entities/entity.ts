import { Connection, QueryOptions } from "mysql";
import { CheckParam, checkProperty, lengthRestriction } from "../utils/body";
import { query } from "../utils/db";
import "reflect-metadata"

const columnsSym = Symbol()
const tableNameSym = Symbol()

export type EntityColumn = CheckParam<any> & {
  isPK: boolean
  FK?: { tableName: string, key: string }
  c: { new (...args: any[]) }
}
export type EntityProperty = {
  column: EntityColumn
  value: any
  modified: boolean
}

export function Entity(tableName: string) {
  return function <T extends { new(...args: any[]) }>(C: T) {
    return class extends C {
      constructor (...args: any[]) {
        super(...args)
        Reflect.defineMetadata(tableNameSym, tableName, this)
        let baseColumns = getColumns(this)
        let instanceProperties: EntityProperty[] = []
        let properties: PropertyDescriptorMap = {}
        baseColumns.map(column => {
          let value = Reflect.get(this, column.key)
          let property = {
            value,
            column,
            modified: false,
          }
          instanceProperties.push(property)
          properties[column.key] = {
            set: (v: any) => {
              checkProperty(column, v)
              property.value = v
              property.modified = true
            },
            get: () => property.value,
            enumerable: true,
          }
          return property
        })
        Object.defineProperties(this, properties)
        Object.defineProperty(this, 'properties', {
          value: instanceProperties,
          enumerable: false,
        }) 
      }
    }
  }
}
export function getColumns<TEntity extends Object>(target: TEntity) {
  let columns = Reflect.getMetadata(columnsSym, target) as EntityColumn[]
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
export const getProperties = (target: Object) => Reflect.get(target, 'properties') as EntityProperty[]

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
    let properties = getProperties(o)
    let tableName = getTableName(o)

    let id = properties.find(k => k.column.isPK)
    let modifiedKeys = properties.filter(k => k.modified)
    if (!id.value || forceInsert) {
      let { insertId } = await query<null>(
        "INSERT INTO ?? (??) VALUES (?)",
        [tableName, modifiedKeys.map(k => k.column.key), modifiedKeys.map(k => k.value)]
      )
      id.value = insertId
    }
    else {
      await query<null>(
        "UPDATE ?? SET ? WHERE ?? = ?",
        [tableName, modifiedKeys.reduce((last, current) => ({ ...last, [current.column.key]: current.value }), {}),
          id.column.key, id.value]
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
      let properties = getProperties(entity)
      properties.forEach(k => k.value = o[k.column.key])
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
    connection?: Connection,
  ) {
    super(connection)
  }

  public async list(conditions: ConditionType<TLeft | TRight>[] = [], limit?: number) {
    let [whereClause, additionalValues] = parseCondition(conditions)

    let LeftC = this.leftTable[2], RightC = this.rightTable[2]
    let leftTableName = getTableName(new LeftC()), rightTableName = getTableName(new RightC())

    let e = getColumns(new LeftC()).find(k => k.FK?.tableName === rightTableName)
    if (!e) throw new Error("没有找到符合条件的外码")
    let leftId = e.key, rightId = e.FK.key

    let q: QueryOptions = {
      sql: `SELECT * FROM (${this.leftTable[0]}) AS left JOIN (${this.rightTable[0]}) AS right ON left.?? = right.??` +
        (whereClause ? ` WHERE ${whereClause}` : '') + (limit ? ` LIMIT ${limit}` : ''),
      nestTables: true
    }
    return (await this.query(q,
      [...this.leftTable[1], ...this.rightTable[1], leftId, rightId, ...additionalValues],
    )).map<[TLeft, TRight]>(o => {
      let left = new LeftC(), right = new RightC()
      let leftProperties = getProperties(left)
      let rightProperties = getProperties(right)
      leftProperties.forEach(k => k.value = o[leftTableName][k.column.key])
      rightProperties.forEach(k => k.value = o[rightTableName][k.column.key])
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

export function Column(type: SupportedConstructor) {
  return function (target: Object, key: string) {
    getColumns(target).push({
      key,
      restrictions: [type === Number ? "number" : "string"],
      isPK: false,
      c: type
    })
  }
}

export function Id(target: Object, key: string) {
  getColumns(target).find(k => k.key === key).isPK = true
}
export function Nullable(target: Object, key: string) {
  getColumns(target).find(k => k.key === key).nullable = true
}
export function Restriction(fn: (o: any) => string) {
  return function (target: Object, key: string) {
    getColumns(target).find(k => k.key === key).restrictions.push(fn)
  }
}
export function Length(min?: number, max?: number) {
  return Restriction(lengthRestriction(min, max))
}
export function Foreign<TEntity extends Object>(EntityC: { new (...args: any[]): TEntity }, foreignKey: keyof TEntity) {
  return function (target: Object, key: string) {
    let o = new EntityC()
    let tableName = getTableName(o)
    getColumns(target).find(k => k.key === key).FK = { tableName, key: foreignKey.toString() }
  }
}

export function getRestrictions<TEntity extends Object>(c: { new (...args: any[]): TEntity }, key: keyof TEntity) {
  return getColumns(new c()).find(k => k.key === key)?.restrictions
}