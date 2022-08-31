import Router = require("@koa/router")
import { EntityColumn } from "../entities/entity"

type BuiltInRestriction = "string" | "number" | "integer"

const allRestrictions: { [key in BuiltInRestriction]: (o: any) => string } = {
  string: o => typeof o === "string" ? '' : '应为字符串',
  number: o => typeof o === "number" ? '' : '应为数字',
  integer: o => typeof o === "number" && Number.isInteger(o) ? '' : '应为整数'
}

export type CheckParam<T> = { key: keyof T, restrictions: (BuiltInRestriction | ((o: any) => string))[], nullable?: boolean }

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
  let errors = param.restrictions
    .map(r => typeof r === "string" ? allRestrictions[r](value) : r(value))
    .filter(Boolean)
  if (errors.length) throw new Error(`字段${param.key.toString()}${errors.join('、')}`)
}

export function checkBodyAsEntity<T extends Object>(constructor: { new (...args: any[]): T }): Router.Middleware {
  return async (ctx, next) => {
    let o = ctx.request.body
    try {
      let entity = new constructor()
      let params = Reflect.get(entity, 'columns') as EntityColumn[]
      params.forEach(param => param.set(o[param.key]))
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

export function lengthRestriction(min: number = 1, max: number = 20) {
  return (o: String) => o.length < min ? `长度不应小于${min}` : (o.length > max ? `长度不应大于${max}` : '')
}