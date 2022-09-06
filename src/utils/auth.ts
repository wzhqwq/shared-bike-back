import jwt = require("koa-jwt")
import { sign } from "jsonwebtoken"
const crypto = import('crypto-es')
import { getLogger } from "log4js"

import { JWT_SECRET } from "../constant/values"
import { Middleware } from "koa"
import { PermissionError } from "./errors"

const logger = getLogger()

export const jwtMiddleware = jwt({ secret: JWT_SECRET, algorithms: ["HS256"] })

export const roleOnly = (role: number): Middleware => (ctx, next) => {
  if (ctx.state.user.role !== role) throw new PermissionError(role)
  return next()
}

export type JwtPayload = { role: number, id: number }

declare module "koa" {
  interface ExtendableContext extends BaseContext {
    state: { user: JwtPayload }
  }
}

export const signJwt = (payload: JwtPayload) => sign(
  { role: ['unlinked', 'customer', 'maintainer', 'manager'][payload.role], id: payload.id },
  JWT_SECRET,
  { algorithm: "HS256" }
)

class BikeCommunication {
  public async encrypt(values: string[]) {
    return (await crypto).default.AES.encrypt(values.join('$'), 'bike').toString()
  }
  public async decrypt(encrypted: string) {
    return (await crypto).default.AES.decrypt(encrypted, 'bike').toString().split('$')
  }
}

export const bikeComm = new BikeCommunication()