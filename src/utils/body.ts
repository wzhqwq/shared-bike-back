import Router = require("@koa/router")
import { EntityColumn, getColumns } from "../entities/entity"

type BuiltInRestriction = "string" | "number" | "integer" | "positive" | "geographical" | "price"

export const posDecimal = /^[+-]?\d{,3}\.\d{6}$/
export const priceDecimal = /^\d{,8}\.\d{2}$/

const allRestrictions: { [key in BuiltInRestriction]: (o: any) => string } = {
  string: o => typeof o === "string" ? '' : '应为字符串',
  number: o => typeof o === "number" ? '' : '应为数字',
  integer: o => Number.isInteger(o) ? '' : '应为整数',
  positive: o => o > 0 ? '' : '应为正数',
  geographical: o => posDecimal.test(o) ? '' : '小数位错误',
  price: o => priceDecimal.test(o) ? '' : '小数位错误'
}

export type Restriction = (BuiltInRestriction | ((o: any) => string))
export type CheckParam<T> = { key: keyof T, restrictions: Restriction[], nullable?: boolean, readonly?: boolean }

export function checkBody<T>(params: CheckParam<T>[]): Router.Middleware {
  return async (ctx, next) => {
    let o = ctx.request.body
    try {
      ctx.request.body = params.reduce((last, param) => {
        let v = o[param.key]
        checkProperty(param, v)
        return { ...last, [param.key]: v }
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

export function checkProperty(param: CheckParam<any>, value: any) {
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
      let params = getColumns(entity)
      params.forEach(param => entity[param.key] = o[param.key])
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
        let params = getColumns(entity)
        params.forEach(param => entity[param.key] = o[param.key])
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