import * as crypto from "crypto"
import { CUSTOMER_USER, MAINTAINER_USER, PASSWORD_SALT, PASSWORD_SECRET } from "../constant/values"
import { SignUpRequest } from "../entities/dto/RawRecords"
import { RawUser, RawMaintainer, RawManager, RawCustomer } from "../entities/dto/RawUser"
import { DbEntity, DbJoined } from "../entities/entity"
import { signJwt } from "../utils/auth"
import { query, transactionWrapper } from "../utils/db"
import { LogicalError } from "../utils/errors"

const digest = (password: string) => crypto
  .createHmac('sha512', PASSWORD_SECRET)
  .update(password)
  .update(PASSWORD_SALT)
  .digest('base64')

export async function signIn(user: RawUser) {
  return transactionWrapper("signIn", async connection => {
    let db = new DbEntity(RawUser, connection)
    let dbUser = await db.pullBySearching([['nickname', '=', user.nickname]])
    if (!dbUser) throw new LogicalError("用户不存在")
    if (dbUser.password !== digest(user.password)) throw new LogicalError("密码不正确")
    
    return signJwt(user)
  })
}

export async function signUp(user: RawUser) {
  return transactionWrapper("signUp", async connection => {
    let db = new DbEntity(RawUser, connection)
    if (await db.pullBySearching([['nickname', '=', user.nickname]])) throw new LogicalError("昵称已被使用")

    user.role = 0
    await db.save(user)
    return signJwt(user)
  })
}

export function createSpecificUser(id: number, isCustomer: boolean) {
  return transactionWrapper("createSpecificUser", async (connection) => {
    let matchedUsers = await query<any>("SELECT * FROM (" + 
      "(SELECT user_id FROM Customer WHERE user_id = ?) UNION " +
      "(SELECT user_id FROM Maintainer WHERE user_id = ?) UNION " +
      "(SELECT user_id FROM Manager WHERE user_id = ?)" +
    ") AS Mixed", [id, id, id], connection)
    if (matchedUsers.length) throw new LogicalError("用户已经被分配了角色")
    let user = new RawUser()
    user.id = id
    if (isCustomer) {
      user.role = CUSTOMER_USER
      let customer = new RawCustomer()
      customer.user_id = id

      let customerDb = new DbEntity(RawCustomer, connection)
      await customerDb.save(customer, true)
    }
    else {
      let recordDb = new DbEntity(SignUpRequest, connection)
      let record = await recordDb.pullBySearching([['user_id', '=', id]])
      if (!record) throw new LogicalError("未找到角色分配请求")
      if (record.status == 0) throw new LogicalError("角色分配请求未得到处理")
      if (record.status == 2) throw new LogicalError("角色分配请求被拒绝")

      user.role = MAINTAINER_USER + record.type

      let mixedUser = record.type === 0 ? new RawMaintainer() : new RawManager()
      mixedUser.user_id = record.user_id
      mixedUser.phone = record.phone
      mixedUser.name = record.name

      let mixedDb = new DbEntity(record.type === 0 ? RawMaintainer : RawManager)
      await mixedDb.save(mixedUser, true)
    }
    let userDb = new DbEntity(RawUser, connection)
    await userDb.save(user)

    return signJwt(user)
  })
}

export async function requestToBe(request: SignUpRequest) {
  return transactionWrapper("requestToBe", async (connection) => {
    let recordDb = new DbEntity(SignUpRequest, connection)
    let requestInDb = await recordDb.pullBySearching([['user_id', '=', request.user_id]])
    if (requestInDb) {
      requestInDb.type = request.type
    }
    else {
      requestInDb = request
      requestInDb.id = undefined
    }
    requestInDb.status = 0
    requestInDb.time = new Date()
    await recordDb.save(requestInDb)
  })
}

export async function listSignUpRequests(lastId: number, size: number = 20) {
  return transactionWrapper("listSignUpRequests", async (connection) => {
    let recordDb = new DbEntity(SignUpRequest, connection)
    let userDb = new DbEntity(RawUser, connection)
    let joinedDb = new DbJoined(recordDb.asTable([['id', '>', lastId]], size), userDb.asTable(), connection)
    return (await joinedDb.list()).map(([r, u]) => ({ ...r, nickname: u.nickname }))
  })
}

export async function handleSignUpRequest(id: number, status: number) {
  return transactionWrapper("listSignUpRequests", async (connection) => {
    let recordDb = new DbEntity(SignUpRequest, connection)
    let record = await recordDb.pullBySearching([['id', '=', id]])
    if (!record) throw new LogicalError("未找到角色分配请求")
    if (record.status === status) return
    record.status = status
    await recordDb.save(record)
  })
}

export async function editProfile(name: string, phone: string, id: number, role: number) {
  return transactionWrapper("editProfile", async connection => {
    if (role > CUSTOMER_USER) {
      let db = new DbEntity(role === MAINTAINER_USER ? RawMaintainer: RawManager, connection)
      let user = role === MAINTAINER_USER ? new RawMaintainer() : new RawManager()
      user.name = name
      user.phone = phone
      user.user_id = id
      await db.save(user)
      return user
    }
  })
}

export async function editNickname(nickname: string, id: number) {
  return transactionWrapper("editNickname", async connection => {
    let db = new DbEntity(RawUser, connection)
    if (await db.pullBySearching([['nickname', '=', nickname], ['id', '<>', id]])) throw new LogicalError("昵称已被使用")
    let user = new RawUser()
    user.nickname = nickname
    user.id = id
    await db.save(user)
    return user
  })
}

export async function editPassword(password: string, oldPassword: string, id: number) {
  return transactionWrapper("editProfile", async connection => {
    let db = new DbEntity(RawUser, connection)
    let user = await db.pullBySearching([['id', '=', id]])
    if (digest(oldPassword) !== user.password) throw new LogicalError("旧密码不正确")
    user.password = digest(password)
    await db.save(user)
  })
}
