import { Connection, PoolConnection, QueryOptions } from "mysql";
import { CheckParam, checkProperty, lengthRestriction } from "../utils/body";
import { query, redisClient } from "../utils/db";
import "reflect-metadata"

const columnsSym = Symbol()
const tableNameSym = Symbol()

export type EntityColumn = CheckParam<any> & {
  isPK: boolean
  FK?: { tableName: string, key: string }
  c: { new (...args: any[]) }
  visibility: number
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

abstract class BaseDb<TEntity extends Object, TCondition = TEntity> {
  constructor(
    private connection?: Connection,
  ) { }

  public query<RowT>(sql: string | QueryOptions, values?: any[]) {
    return query<RowT>(sql, values, this.connection)
  }
  
  public async pullBySearching(conditions: ConditionType<TCondition>[]){
    return (await this.list(conditions))[0]
  }
  abstract list(conditions?: ConditionType<TCondition>[], columns?: (keyof TCondition)[], limit?: number): Promise<TEntity[]>
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
      modifiedKeys = modifiedKeys.filter(k => !k.column.isPK)
      await query<null>(
        "UPDATE ?? SET ? WHERE ?? = ?",
        [tableName, modifiedKeys.reduce((last, current) => ({ ...last, [current.column.key]: current.value }), {}),
          id.column.key, id.value]
      )
    }
    modifiedKeys.forEach(k => { k.modified = false })
  }

  public async update(change: TEntity, conditions: ConditionType<TEntity>[]) {
    if (!conditions.length) throw new Error("怎么能不加条件呢")

    let properties = getProperties(change)
    let tableName = getTableName(change)

    let [whereClause, additionalValues] = parseCondition(conditions)
    let modifiedKeys = properties.filter(k => k.modified && !k.column.isPK)

    return (await query<null>(
      "UPDATE ?? SET ? WHERE " + whereClause,
      [tableName, modifiedKeys.reduce((last, current) => ({ ...last, [current.column.key]: current.value }), {}),
        ...additionalValues
      ]
    )).affectedRows
  }

  public async delete(conditions: ConditionType<TEntity>[]) {
    if (!conditions.length) throw new Error("怎么能不加条件呢")

    let tableName = getTableName(new this.c())
    let [whereClause, additionalValues] = parseCondition(conditions)

    return (await this.query<any>(
      "DELETE FROM ?? WHERE " + whereClause,
      [tableName, ...additionalValues]
    )).affectedRows
  }

  public async list(
    conditions: ConditionType<TEntity>[] = [],
    columns?: (keyof TEntity)[],
    limit?: number,
  ) {
    let tableName = getTableName(new this.c())
    let [whereClause, additionalValues] = parseCondition(conditions)

    return (await this.query<TEntity>(
      "SELECT ?? FROM ??" + (whereClause ? ` WHERE ${whereClause}` : '') + (limit ? ` LIMIT ${limit}` : ''),
      [columns ?? '*', tableName, ...additionalValues],
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

export class DbJoined<TLeft extends Object, TRight extends Object> extends BaseDb<[TLeft, TRight], TLeft & TRight> {
  constructor(
    private leftTable: TableInfo<TLeft>,
    private rightTable: TableInfo<TRight>,
    connection?: Connection,
  ) {
    super(connection)
  }

  public async list(conditions: ConditionType<TLeft & TRight>[] = [], columns?: (keyof (TLeft & TRight))[], limit?: number) {
    let [whereClause, additionalValues] = parseCondition(conditions)
    // LeftC.prototype

    let LeftC = this.leftTable[2], RightC = this.rightTable[2]
    let leftTableName = getTableName(new LeftC()), rightTableName = getTableName(new RightC())

    let e = getColumns(new LeftC()).find(k => k.FK?.tableName === rightTableName)
    if (!e) throw new Error("没有找到符合条件的外码")
    let leftId = e.key, rightId = e.FK.key

    let q: QueryOptions = {
      sql: `SELECT ?? FROM (${this.leftTable[0]}) AS left JOIN (${this.rightTable[0]}) AS right ON left.?? = right.??` +
        (whereClause ? ` WHERE ${whereClause}` : '') + (limit ? ` LIMIT ${limit}` : ''),
      nestTables: true
    }
    return (await this.query(q, [
      columns ?? '*',
      ...this.leftTable[1], ...this.rightTable[1],
      leftId, rightId,
      ...additionalValues,
    ])).map<[TLeft, TRight]>(o => {
      let left = new LeftC(), right = new RightC()
      let leftProperties = getProperties(left)
      let rightProperties = getProperties(right)
      leftProperties.forEach(k => k.value = o[leftTableName][k.column.key])
      rightProperties.forEach(k => k.value = o[rightTableName][k.column.key])
      return [left, right]
    })
  }
}

export type BooleanOperatorType = '=' | '>' | '<' | '>=' | '<=' | '<>' | 'IS' | 'IS NOT'
export type CalculatingOperatorType = '+' | '-' | '*' | '/'
export type AggregationFnType = 'COUNT' | 'SUM' | 'AVG'
export type ExpressionType<TEntity extends Object> = [keyof TEntity] | number | string |
  { fn: AggregationFnType, key: ExpressionType<TEntity> | '*' } |
  [ExpressionType<TEntity>, CalculatingOperatorType, ExpressionType<TEntity>]

export type ConditionType<TEntity extends Object> =
  [ExpressionType<TEntity>, BooleanOperatorType, ExpressionType<TEntity>] |
  [ExpressionType<TEntity>, 'BETWEEN', (ExpressionType<TEntity>)[]]

function parseCondition<TEntity extends Object>(conditions: ConditionType<TEntity>[]): [string, any[]] {
  // let sql = conditions.map(c => `?? ${c[1]} ${c[1] === 'BETWEEN' ? '? AND ?' : '?'}`).join(' AND ')
  // let values = conditions.flatMap(c => [
  //   typeof c[0] === 'object' ? `${c[0].fn}(${c[0].key.toString()})` : c[0].toString(),
  //   ...(c[1] === 'BETWEEN' ? c[2] : [c[2]]),
  // ])
  // return [sql, values]
  let sql: string[] = [], values: any[] = []
  conditions.forEach(c => {
    let l = parseExpression(c[0]);
    let r = (c[1] === 'BETWEEN' ? c[2] : [c[2]]).map(e => parseExpression(e))
    sql.push(`${l[0]} ${c[1]} ${r.map(l => l[0]).join(' AND ')}`)
    values.push(l[0], ...r.map(l => l[1]))
  })
  return [sql.join(' AND '), values]
}
function parseExpression<TEntity extends Object>(expression: ExpressionType<TEntity>): [string, any[]] {
  if (expression instanceof Array) {
    if (expression.length == 1) return ['??', [expression]]
    let l = parseExpression(expression[0])
    let r = parseExpression(expression[2])
    return [`(${l[0]} ${expression[1]} ${r[0]})`, [...l[1], ...r[1]]]
  }
  if (typeof expression == 'object') {
    return [`${expression.fn}(${expression.key.toString()})`, [expression.key.toString()]]
  }
  return ['?', [expression]]
}

type SupportedConstructor = NumberConstructor | StringConstructor | DateConstructor

export class RedisDbEntity<TEntity extends (Object & { id: number })> {
  private db: DbEntity<TEntity>
  private prefix: string
  constructor (
    private C: { new(...args: any[]): TEntity },
    private fetchKey: keyof TEntity = 'id',
    connection?: PoolConnection,
  ) {
    this.db = new DbEntity(C, connection)
    this.prefix = 'bike__' + getTableName(new C()) + '__'
  }

  public async get(keyword: any) {
    let result = await redisClient.getEx(this.prefix + keyword, { EX: 60 })
    if (!result) return await this.db.pullBySearching([[[this.fetchKey], '=', keyword]])
    let o = JSON.parse(result)
    let entity = new this.C()
    let properties = getProperties(entity)
    properties.forEach(k => k.value = o[k.column.key])
    return entity
  }

  public save(entity: TEntity) {
    return Promise.all([
      this.db.save(entity),
      redisClient.setEx(this.prefix + entity[this.fetchKey], 60, JSON.stringify(entity)),
    ])
  }

  public async removeCache(keyword: any) {
    await redisClient.del(this.prefix + keyword)
  }
}

export function Column(type: SupportedConstructor, visibility: number = 0) {
  return function (target: Object, key: string) {
    getColumns(target).push({
      key,
      restrictions: [type === Number ? "number" : "string"],
      isPK: false,
      c: type,
      visibility,
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