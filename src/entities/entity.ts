import { Connection, PoolConnection, QueryOptions } from "mysql";
import { CheckBodyProperties, checkProperty, lengthRestriction, Restriction } from "../utils/body";
import { query, redisClient } from "../utils/db";
import "reflect-metadata"

const columnsSym = Symbol()
const tableNameSym = Symbol()

export type EntityColumn = CheckBodyProperties<any> & {
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
    Reflect.metadata(tableNameSym, tableName)(C)
    return class extends C {
      constructor (...args: any[]) {
        super(...args)
        let baseColumns = getColumns(C)
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
            configurable: true,
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
export function getColumns<TEntity extends Object>(target: { new(...args: any[]): TEntity }) {
  let columns = Reflect.getOwnMetadata(columnsSym, target) as EntityColumn[]
  if (columns) return columns

  columns = []
  let t = target
  while (t !== Object.getPrototypeOf(Object.getPrototypeOf(t)).constructor) {
    let c = Reflect.getOwnMetadata(columnsSym, Object.getPrototypeOf(t)) as EntityColumn[]
    if (c) columns.push(...c)
    t = Object.getPrototypeOf(Object.getPrototypeOf(t)).constructor
  }
  Reflect.metadata(columnsSym, columns)(target)

  return columns
}
export function getTableName<TEntity extends Object>(target: { new(...args: any[]): TEntity }) {
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
  
  public async pullBySearching(conditions: ConditionType<TCondition>[]): Promise<TEntity | undefined> {
    return (await this.list(conditions))[0]
  }
  abstract list(
    conditions?: ConditionType<TCondition>[],
    columns?: (keyof TCondition)[],
    limit?: number,
    sort?: SortType<TCondition>,
  ): Promise<TEntity[]>
}

type TableInfo<TEntity extends Object> = [string, any[], { new (...args: any[]): TEntity }]
export class DbEntity<TEntity extends Object> extends BaseDb<TEntity> {
  constructor(
    protected C: { new (...args: any[]): TEntity },
    connection?: Connection
  ) {
    super(connection)
  }

  public async save(o: TEntity) {
    let properties = getProperties(o)
    let tableName = getTableName(this.C)

    let id = properties.find(k => k.column.isPK)
    let modifiedKeys = properties.filter(k => k.modified && !k.column.isPK)
    modifiedKeys = modifiedKeys.filter(k => !k.column.isPK)
    await this.query<null>(
      "UPDATE ?? SET ? WHERE ?? = ?",
      [tableName, modifiedKeys.reduce((last, current) => ({ ...last, [current.column.key]: current.value }), {}),
        id.column.key, id.value]
    )
    modifiedKeys.forEach(k => { k.modified = false })
  }

  public async append(o: TEntity, autoIncrease = true) {
    let properties = getProperties(o)
    let tableName = getTableName(this.C)

    let id = properties.find(k => k.column.isPK)
    let modifiedKeys = properties.filter(k => k.modified)
    if (autoIncrease) modifiedKeys = modifiedKeys.filter(k => !k.column.isPK)
    let { insertId } = await this.query<null>(
      "INSERT INTO ?? (??) VALUES (?)",
      [tableName, modifiedKeys.map(k => k.column.key), modifiedKeys.map(k => k.value)]
    )
    modifiedKeys.forEach(k => { k.modified = false })
    id.value = insertId
  }

  public async update(changes: [keyof TEntity, ExpressionType<TEntity>][], conditions: ConditionType<TEntity>[]) {
    if (!conditions.length) throw new Error("怎么能不加条件呢")

    let tableName = getTableName(this.C)

    let [whereClause, additionalValues] = parseCondition(conditions)

    let parsed = changes.map(current => [current[0], parseExpression(current[1])])
    let values = parsed.flatMap(current => [current[0], ...current[1][1]])

    return (await this.query<null>(
      `UPDATE ?? SET ${parsed.map(current => '?? = ' + current[1][0]).join(', ')} WHERE ` + whereClause,
      [tableName, ...values, ...additionalValues]
    )).affectedRows
  }

  public async delete(conditions: ConditionType<TEntity>[]) {
    if (!conditions.length) throw new Error("怎么能不加条件呢")

    let tableName = getTableName(this.C)
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
    sort?: SortType<TEntity>,
  ) {
    let tableName = getTableName(this.C)
    let [whereClause, additionalValues] = parseCondition(conditions)

    return (await this.query<TEntity>(
      `SELECT ${columns ? '??' : '*'} FROM ??` +
        (whereClause ? ` WHERE ${whereClause}` : '') +
        (sort ? ` ORDER BY ${sort.key.toString()} ${sort.mode}` : '') +
        (limit ? ` LIMIT ${limit}` : ''),
      [...(columns ? [columns] : []), tableName, ...additionalValues],
    )).map(o => {
      let entity = new this.C()
      let properties = getProperties(entity)
      properties.forEach(k => k.value = o[k.column.key])
      return entity
    })
  }

  public asTable(conditions: ConditionType<TEntity>[] = [], limit?: number, sort?: SortType<TEntity>): TableInfo<TEntity> {
    let tableName = getTableName(this.C)
    let [whereClause, additionalValues] = parseCondition(conditions)

    return [
      (whereClause || limit || sort) ?
        "(SELECT * FROM ??" +
          (whereClause ? ` WHERE ${whereClause}` : '') +
          (sort ? ` ORDER BY ${sort.key.toString()} ${sort.mode}` : '') +
          (limit ? ` LIMIT ${limit}` : '') + ')' :
        "??",
      [tableName, ...additionalValues],
      this.C,
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

  public async list(
    conditions: ConditionType<TLeft & TRight>[] = [],
    columns?: (keyof (TLeft & TRight))[],
    limit?: number,
    sort?: SortType<TLeft & TRight>,
  ) {
    let [whereClause, additionalValues] = parseCondition(conditions)
    // LeftC.prototype

    let LeftC = this.leftTable[2], RightC = this.rightTable[2]
    let rightTableName = getTableName(RightC)

    let e = getProperties(new LeftC).find(k => k.column.FK?.tableName === rightTableName)
    if (!e) throw new Error("没有找到符合条件的外码")
    let leftId = e.column.key, rightId = e.column.FK.key

    let q: QueryOptions = {
      sql: `SELECT ${columns ? '??' : '*'} FROM ${this.leftTable[0]} AS l JOIN ${this.rightTable[0]} AS r ON l.?? = r.??` +
        (whereClause ? ` WHERE ${whereClause}` : '') +
        (sort ? ` ORDER BY ${sort.key.toString()} ${sort.mode}` : '') +
        (limit ? ` LIMIT ${limit}` : ''),
      nestTables: true
    }
    return (await this.query(q, [
      ...(columns ? [columns] : []),
      ...this.leftTable[1], ...this.rightTable[1],
      leftId, rightId,
      ...additionalValues,
    ])).map<[TLeft, TRight]>(o => {
      let left = new LeftC(), right = new RightC()
      let leftProperties = getProperties(left)
      let rightProperties = getProperties(right)
      leftProperties.forEach(k => k.value = o['l'][k.column.key])
      rightProperties.forEach(k => k.value = o['r'][k.column.key])
      return [left, right]
    })
  }
}

export type BooleanOperatorType = '=' | '>' | '<' | '>=' | '<=' | '<>' | 'IS' | 'IS NOT'
export type CalculatingOperatorType = '+' | '-' | '*' | '/'
export type AggregationFnType = 'COUNT' | 'SUM' | 'AVG'
export type ExpressionType<TEntity extends Object> = [keyof TEntity] | number | string | null | Date |
  { fn: AggregationFnType, key: ExpressionType<TEntity> | '*' } |
  [ExpressionType<TEntity>, CalculatingOperatorType, ExpressionType<TEntity>]

export type ConditionType<TEntity extends Object> =
  [ExpressionType<TEntity>, BooleanOperatorType, ExpressionType<TEntity>] |
  [ExpressionType<TEntity>, 'BETWEEN', (ExpressionType<TEntity>)[]]
export type SortType<TEntity extends Object> = { key: keyof TEntity, mode: 'ASC' | 'DESC' }

function parseCondition<TEntity extends Object>(conditions: ConditionType<TEntity>[]): [string, any[]] {
  let sql: string[] = [], values: any[] = []
  conditions.forEach(c => {
    let l = parseExpression(c[0]);
    let r = (c[1] === 'BETWEEN' ? c[2] : [c[2]]).map(e => parseExpression(e))
    sql.push(`${l[0]} ${c[1]} ${r.map(l => l[0]).join(' AND ')}`)
    values.push(...l[1], ...r.flatMap(l => l[1]))
  })
  return [sql.join(' AND '), values]
}
function parseExpression<TEntity extends Object>(expression: ExpressionType<TEntity>): [string, any[]] {
  if (expression instanceof Array) {
    if (expression.length == 1) return ['??', expression]
    let l = parseExpression(expression[0])
    let r = parseExpression(expression[2])
    return [`(${l[0]} ${expression[1]} ${r[0]})`, [...l[1], ...r[1]]]
  }
  if (typeof expression == 'object' && expression !== null && !(expression instanceof Date)) {
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
    this.prefix = 'bike__' + getTableName(C) + '__'
  }

  public async get(keyword: any) {
    let result = await redisClient.getEx(this.prefix + keyword, { EX: 60 })
    if (!result) return await this.db.pullBySearching([[[this.fetchKey], '=', keyword]])
    let o = JSON.parse(result)
    let entity = new this.C()
    let properties = getProperties(entity)
    properties.forEach(k => {
      k.value = k.column.c === Date ? new Date(o[k.column.key]) : o[k.column.key]
    })
    return entity
  }

  public async save(entity: TEntity) {
    await this.db.save(entity)
    await redisClient.setEx(this.prefix + entity[this.fetchKey], 60, JSON.stringify(entity))
  }

  public async append(entity: TEntity) {
    await this.db.append(entity)
    await redisClient.setEx(this.prefix + entity[this.fetchKey], 60, JSON.stringify(entity))
  }

  public async removeCache(keyword: any) {
    await redisClient.del(this.prefix + keyword)
  }
}

export function Column(type: SupportedConstructor, visibility: number = 0) {
  return function (target: Object, key: string) {
    getColumns(target.constructor as any).push({
      key,
      restrictions: type === Number ? ["number"] : (type === String ? ["string"] : []),
      isPK: false,
      c: type,
      visibility,
    })
  }
}

export function Id(target: Object, key: string) {
  let column = getColumns(target.constructor as any).find(k => k.key === key)
  column.isPK = column.nullable = true
}
export function Readonly(target: Object, key: string) {
  let column = getColumns(target.constructor as any).find(k => k.key === key)
  column.readonly = column.nullable = true
}
export function Nullable(target: Object, key: string) {
  getColumns(target.constructor as any).find(k => k.key === key).nullable = true
}

export function Restriction(...restrictions: Restriction[]) {
  return function (target: Object, key: string) {
    getColumns(target.constructor as any).find(k => k.key === key).restrictions.push(...restrictions)
  }
}
export function Length(min?: number, max?: number) {
  return function (target: Object, key: string) {
    getColumns(target.constructor as any).find(k => k.key === key).restrictions.push(lengthRestriction(min, max))
  }
}
export function Foreign<TEntity extends Object>(EntityC: { new (...args: any[]): TEntity }, foreignKey: keyof TEntity) {
  return function (target: Object, key: string) {
    let tableName = getTableName(EntityC)
    getColumns(target.constructor as any).find(k => k.key === key).FK = { tableName, key: foreignKey.toString() }
  }
}

export function getRestrictions<TEntity extends Object>(C: { new (...args: any[]): TEntity }, key: keyof TEntity) {
  return getProperties(new C).find(k => k.column.key === key)?.column.restrictions
}