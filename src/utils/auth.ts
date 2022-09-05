import jwt = require("koa-jwt")
import fs = require("fs/promises")
import path = require("path")
import { sign } from "jsonwebtoken"
import crypto from 'crypto-es'
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
  public encrypt(values: string[]) {
    return crypto.AES.encrypt(values.join('$'), 'bike').toString()
  }
  public decrypt(encrypted: string) {
    return crypto.AES.decrypt(encrypted, 'bike').toString().split('$')
  }
}

export const bikeComm = new BikeCommunication()