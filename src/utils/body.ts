import Router = require("@koa/router")
import { getProperties } from "../entities/entity"

type BuiltInRestriction = "string" | "number" | "integer" | "positive" | "geographical" | "price" | "imageKey"
type BuiltInParamRestriction = "integer" | "positive" | "geographical" | "imageKey"

export const posDecimal = /^[+-]?\d{,3}\.\d{6}$/
export const priceDecimal = /^\d{,8}\.\d{2}$/
export const imageKeyName = /^[0-9a-z]*$/

const allRestrictions: { [key in BuiltInRestriction]: (o: any) => string } = {
  string: o => typeof o === "string" ? '' : '应为字符串',
  number: o => typeof o === "number" ? '' : '应为数字',
  integer: o => Number.isInteger(o) ? '' : '应为整数',
  positive: o => o > 0 ? '' : '应为正数',
  geographical: o => posDecimal.test(o) ? '' : '小数位错误',
  price: o => priceDecimal.test(o) ? '' : '小数位错误',
  imageKey: o => imageKeyName.test(o) ? '' : '编号格式错误'
}

const allParamRestrictions: { [key in BuiltInParamRestriction]: (o: any) => string } = {
  integer: o => !isNaN(parseInt(o)) ? '' : '应为整数',
  positive: o => parseInt(o) > 0 ? '' : '应为正数',
  geographical: o => posDecimal.test(o) ? '' : '小数位错误',
  imageKey: o => imageKeyName.test(o) ? '' : '编号格式错误'
}

export type Restriction<T = BuiltInRestriction> = (T | ((o: any) => string))
export type CheckBodyProperties<T> = { key: keyof T, restrictions: Restriction<BuiltInRestriction>[], nullable?: boolean, readonly?: boolean }
export type CheckParamsProperties<T> = { key: keyof T, restrictions: Restriction<BuiltInParamRestriction>[], nullable?: boolean, default?: string }

export function checkBody<T>(params: CheckBodyProperties<T>[]): Router.Middleware {
  return async (ctx, next) => {
    let o = ctx.request.body
    try {
      ctx.request.body = params.reduce((last, param) => {
        let v = o[param.key.toString()]
        checkProperty(param, v)
        return { ...last, [param.key.toString()]: v }
      }, {})
    }
    catch (e) {
      ctx.status = 400
      ctx.body = e.message
      return
    }
    await next()
  }
}

export function checkParams<T>(params: CheckParamsProperties<T>[]): Router.Middleware {
  return async (ctx, next) => {
    let o = ctx.query
    try {
      params.forEach(param => {
        let v = o[param.key.toString()]
        if (typeof v === 'undefined' || v === null) {
          if (param.nullable) {
            if (param.default) o[param.key.toString()] = param.default
            return
          }
          throw new Error(`字段${param.key.toString()}未提供`)
        }
        
        let errors = param.restrictions
          .map(r => typeof r === "string" ? allParamRestrictions[r](v) : r(v))
          .filter(Boolean)
        if (errors.length) throw new Error(`字段${param.key.toString()}${errors.join('、')}`)
      }, {})
    }
    catch (e) {
      ctx.status = 400
      ctx.body = e.message
      return
    }
    await next()
  }
}

export function checkProperty(param: CheckBodyProperties<any>, value: any) {
  if (typeof value === 'undefined' || value === null) {
    if (param.nullable) return
    throw new Error(`字段${param.key.toString()}未提供`)
  }
  else if (param.readonly) throw new Error(`不可以设置字段${param.key.toString()}`)
  
  let errors = param.restrictions
    .map(r => typeof r === "string" ? allRestrictions[r](value) : r(value))
    .filter(Boolean)
  if (errors.length) throw new Error(`字段${param.key.toString()}${errors.join('、')}`)
}

export function checkBodyAsEntity<T extends Object>(C: { new (...args: any[]): T }): Router.Middleware {
  return async (ctx, next) => {
    let o = ctx.request.body
    try {
      let entity = new C()
      let params = getProperties(entity)
      params.forEach(param => entity[param.column.key] = o[param.column.key])
      ctx.request.body = entity
    }
    catch (e) {
      ctx.status = 400
      ctx.body = e.message
      return
    }
    await next()
  }
}

export function checkBodyAsEntityList<T extends Object>(C: { new (...args: any[]): T }): Router.Middleware {
  return async (ctx, next) => {
    let list = ctx.request.body
    try {
      if (!(list instanceof Array)) throw new Error("应提供数组")
      ctx.request.body = list.map(o => {
        let entity = new C()
        let params = getProperties(entity)
        params.forEach(param => entity[param.column.key] = o[param.column.key])
        return entity
      })
    }
    catch (e) {
      ctx.status = 400
      ctx.body = e.message
      return
    }
    await next()
  }
}

export function lengthRestriction(min: number = 1, max: number = 20) {
  return (o: String) => o.length < min ? `长度不应小于${min}` : (o.length > max ? `长度不应大于${max}` : '')
}