import * as jwt from "koa-jwt"
import { sign } from "jsonwebtoken"

import { JWT_SECRET } from "../constant/values"
import { Middleware } from "koa"
import { PermissionError } from "./errors"

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
