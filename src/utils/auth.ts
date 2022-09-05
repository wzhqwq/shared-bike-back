import jwt = require("koa-jwt")
import fs = require("fs/promises")
import path = require("path")
import { sign } from "jsonwebtoken"
import crypto = require("crypto")
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
  private privateKey: crypto.KeyObject

  constructor() {
    let privatePath = path.resolve(__dirname, '../constant/private.key')
    fs.access(privatePath).then(() => {
      fs.readFile(privatePath).then(buf => {
        this.privateKey = crypto.createPrivateKey(buf)
      }).catch(() => {
        logger.error("未配置私钥")
      })
    })
  }

  public encrypt(values: string[]) {
    return crypto.privateEncrypt(this.privateKey, Buffer.from(values.join('$'), 'ascii')).toString('base64')
  }
  public decrypt(encrypted: string) {
    return crypto.privateDecrypt(this.privateKey, Buffer.from(encrypted, 'base64')).toString('ascii').split('$')
  }
}

export const bikeComm = new BikeCommunication()