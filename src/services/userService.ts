import crypto = require("crypto")
import { CUSTOMER_USER, MAINTAINER_USER, MANAGER_USER, PASSWORD_SALT, PASSWORD_SECRET, REQUEST_REJECTED, REQUEST_UNHANDLED } from "../constant/values"
import { SignUpRequest } from "../entities/dto/RawRecords"
import { RawUser, RawMaintainer, RawManager, RawCustomer } from "../entities/dto/RawUser"
import { DbEntity, DbJoined } from "../entities/entity"
import { hide } from "../entities/vo/Result"
import { signJwt } from "../utils/auth"
import { query, transactionWrapper } from "../utils/db"
import { LogicalError } from "../utils/errors"

const digest = (password: string) => crypto
  .createHmac('sha512', PASSWORD_SECRET)
  .update(password)
  .update(PASSWORD_SALT)
  .digest('base64')

export function signIn(user: RawUser) {
  return transactionWrapper("signIn", async connection => {
    let db = new DbEntity(RawUser, connection)
    let dbUser = await db.pullBySearching([[['nickname'], '=', user.nickname]])
    if (!dbUser) throw new LogicalError("用户不存在")
    if (dbUser.password !== digest(user.password)) throw new LogicalError("密码不正确")
    
    return signJwt(user)
  })
}

export function signUp(user: RawUser) {
  return transactionWrapper("signUp", async connection => {
    let db = new DbEntity(RawUser, connection)
    if (await db.pullBySearching([[['nickname'], '=', user.nickname]])) throw new LogicalError("昵称已被使用")

    user.role = 0
    await db.append(user)
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
    let role: number
    if (isCustomer) {
      role = CUSTOMER_USER
      let customer = new RawCustomer()
      customer.user_id = id

      let customerDb = new DbEntity(RawCustomer, connection)
      await customerDb.append(customer)
    }
    else {
      let recordDb = new DbEntity(SignUpRequest, connection)
      let record = await recordDb.pullBySearching([[['user_id'], '=', id]])
      if (!record) throw new LogicalError("未找到角色分配请求")
      if (record.status == REQUEST_UNHANDLED) throw new LogicalError("角色分配请求未得到处理")
      if (record.status == REQUEST_REJECTED) throw new LogicalError("角色分配请求被拒绝")

      role = MAINTAINER_USER + record.type

      let mixedUser = role === MAINTAINER_USER ? new RawMaintainer() : new RawManager()
      mixedUser.user_id = record.user_id
      mixedUser.phone = record.phone
      mixedUser.name = record.name

      let mixedDb = new DbEntity(role === MAINTAINER_USER ? RawMaintainer : RawManager)
      await mixedDb.append(mixedUser)
    }
    let userDb = new DbEntity(RawUser, connection)
    await userDb.update([['role', role]], [[['id'], '=', id]])

    return signJwt({ id, role })
  })
}

export function requestToBe(request: SignUpRequest) {
  return transactionWrapper("requestToBe", async (connection) => {
    let recordDb = new DbEntity(SignUpRequest, connection)
    let requestInDb = await recordDb.pullBySearching([[['user_id'], '=', request.user_id]])
    if (requestInDb) {
      requestInDb.type = request.type
    }
    else {
      requestInDb = request
    }
    requestInDb.status = REQUEST_UNHANDLED
    requestInDb.time = new Date()
    await recordDb.append(requestInDb)
    return null
  })
}

export function listSignUpRequests(lastId: number, size: number = 20) {
  return transactionWrapper("listSignUpRequests", async (connection) => {
    let recordDb = new DbEntity(SignUpRequest, connection)
    let userDb = new DbEntity(RawUser, connection)
    let joinedDb = new DbJoined(
      recordDb.asTable([[['id'], '<', lastId]], size, { key: 'id', mode: 'DESC' }),
      userDb.asTable(),
      connection
    )
    return (await joinedDb.list()).map(([r, u]) => ({ ...r, nickname: u.nickname }))
  })
}

export function handleSignUpRequest(id: number, status: number) {
  return transactionWrapper("listSignUpRequests", async (connection) => {
    let recordDb = new DbEntity(SignUpRequest, connection)
    let record = await recordDb.pullBySearching([[['id'], '=', id]])
    if (!record) throw new LogicalError("未找到角色分配请求")
    if (record.status === status) return
    record.status = status
    await recordDb.save(record)
  })
}

export function editProfile(name: string, phone: string, id: number, role: number) {
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

export function editNickname(nickname: string, id: number) {
  return transactionWrapper("editNickname", async connection => {
    let db = new DbEntity(RawUser, connection)
    if (await db.pullBySearching([[['nickname'], '=', nickname], [['id'], '<>', id]]))
      throw new LogicalError("昵称已被使用")
    await db.update([['nickname', nickname]], [[['id'], '=', id]])
    return null
  })
}

export function editAvatar(key: string, id: number) {
  return transactionWrapper("editAvatar", async connection => {
    let db = new DbEntity(RawUser, connection)
    await db.update([['avatar_key', key]], [[['id'], '=', id]])
    return null
  })
}

export function editPassword(password: string, oldPassword: string, id: number) {
  return transactionWrapper("editPassword", async connection => {
    let db = new DbEntity(RawUser, connection)
    let user = await db.pullBySearching([[['id'], '=', id]])
    if (digest(oldPassword) !== user.password) throw new LogicalError("旧密码不正确")
    user.password = digest(password)
    await db.save(user)
    return null
  })
}

export function mixUser(base: RawUser, extended: RawCustomer | RawMaintainer | RawManager) {
  hide(base, 1)
  return { ...base, extended }
}

export function listUsers(role: 'customer' | 'manager' | 'maintainer', lastId: number, size: number = 20) {
  return transactionWrapper("listUsers", async connection => {
    let C: { new(...args: any[]): RawCustomer | RawMaintainer | RawManager }
    switch (role) {
      case 'customer':
        C = RawCustomer
        break
      case 'maintainer':
        C = RawMaintainer
        break
      case 'manager':
        C = RawManager
        break
      default:
        throw new LogicalError("参数无效")
    }
    let db = new DbJoined(
      new DbEntity(C).asTable([[['user_id'], '<', lastId]], size, { key: 'user_id', mode: 'DESC' }),
      new DbEntity(RawUser).asTable(),
      connection
    )
    return (await db.list()).map(([x, u]) => mixUser(u, x))
  })
}

export function getUser(userId: number) {
  return transactionWrapper("getUser", async connection => {
    let userDb = new DbEntity(RawUser, connection)
    let user = await userDb.pullBySearching([[['id'], '=', userId]])
    if (!user) throw new LogicalError("用户不存在")
    
    let C: { new(...args: any[]): RawCustomer | RawMaintainer | RawManager }
    switch (user.role) {
      case CUSTOMER_USER:
        C = RawCustomer
        break
      case MAINTAINER_USER:
        C = RawMaintainer
        break
      case MANAGER_USER:
        C = RawManager
        break
      default:
        throw new LogicalError("未注册用户")
    }

    let extendedDb = new DbEntity(C, connection)
    let extendedUser = await extendedDb.pullBySearching([[['user_id'], '=', userId]])
    if (!extendedUser) throw new LogicalError("未找到用户的详细记录")
    
    return mixUser(user, extendedUser)
  })
}

export function liftTheBanOfCustomer(customerId: number) {
  return transactionWrapper("liftTheBanOfCustomer", async connection => {
    return await new DbEntity(RawCustomer, connection)
      .update([['ban_time', null]], [[['user_id'], '=', customerId]])
  })
}