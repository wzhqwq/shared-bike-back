import * as crypto from "crypto"
import { CUSTOMER_USER, MAINTAINER_USER, PASSWORD_SALT, PASSWORD_SECRET } from "../constant/values"
import { RawMaintainer } from "../entities/dto/RawMaintainer"
import { RawManager } from "../entities/dto/RawManager"
import { SignUpRequest } from "../entities/dto/RawRecords"
import RawUser from "../entities/dto/RawUser"
import { DbEntity } from "../entities/entity"
import { signJwt } from "../utils/auth"
import { query, startTransaction, transactionWrapper } from "../utils/db"
import { LogicalError } from "../utils/errors"

const digest = (password: string) => crypto
  .createHmac('sha512', PASSWORD_SECRET)
  .update(password)
  .update(PASSWORD_SALT)
  .digest('base64')

export async function signIn(user: RawUser) {
  return transactionWrapper("signIn", async connection => {
    let db = new DbEntity(RawUser, connection)
    let dbUser = await db.pullBySearching('nickname', user.nickname)
    if (!dbUser) throw new LogicalError("用户不存在")
    if (dbUser.password !== digest(user.password)) throw new LogicalError("密码不正确")
    
    return signJwt(user)
  })
}

export async function signUp(user: RawUser) {
  return transactionWrapper("signUp", async connection => {
    let db = new DbEntity(RawUser, connection)
    if (await db.pullBySearching('nickname', user.nickname)) throw new LogicalError("昵称已被使用")

    user.role = 0
    await db.save(user)
    return signJwt({ id: user.id, role: 0 })
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
    if (isCustomer) {
      await query<null>("UPDATE User SET role = 1 WHERE id = ?", [id], connection)
      await query<null>("INSERT INTO Customer (user_id) VALUES (?)", [id], connection)
      return signJwt({ id, role: 1 })
    }

    let record = (await query<SignUpRequest>(
      "SELECT * FROM SignUpRequest WHERE user_id = ?", [id], connection
    ))[0]
    if (!record) throw new LogicalError("未找到角色分配请求")
    if (record.status == 0) throw new LogicalError("角色分配请求未得到处理")
    if (record.status == 2) throw new LogicalError("角色分配请求被拒绝")

    await query<null>("UPDATE User SET role = ? WHERE id = ?", [MAINTAINER_USER + record.type, id], connection)
    await query<null>(
      "INSERT INTO ?? SET ?",
      [["Maintainer", "Manager"][record.type], { user_id: record.user_id, phone: record.phone, name: record.name }],
      connection,
    )
    return signJwt({ id, role: record.type })
  })
}

export async function requestToBe(request: Omit<SignUpRequest, "id" | "time" | "status">) {
  return transactionWrapper("requestToBe", async (connection) => {
    let record = (await query<{ type: number }>(
      "SELECT type FROM SignUpRequest WHERE user_id = ?", [request.user_id], connection
    ))[0]
    if (record) {
      return !!(await query<null>(
        "UPDATE SignUpRequest SET `status` = 0, `type` = ?, `time` = NOW()", [request.type], connection
      )).affectedRows
    }
    // return !!(await query<null>(
    //   "INSERT INTO SignUpRequest (??, `status`, `time`) VALUES (?, 0, NOW())",
    //   [getInsertColumns(request), getInsertValues(request)],
    //   connection,
    // )).affectedRows
  })
}

// export async function listSignUpRequests(lastId: number, size: number = 20) {
//   return await query<SignUpRequest & RawUser>(
//     "SELECT ?? FROM (SELECT * FROM SignUpRequest WHERE `id` > ? LIMIT ?) " +
//     "AS r INNER LEFT JOIN User AS u ON r.user_id = u.id",
//     [getJoinColumns()]
//   )
// }

export async function handleSignUpRequest(id: number, status: number) {
  return !!(await query<null>(
    "UPDATE SignUpRequest SET status = ? WHERE id = ?", [status, id]
  )).affectedRows
}

export type PartialUser = Partial<RawUser & RawManager & RawMaintainer>
export async function editProfile(user: PartialUser, role: number, id: number) {
  return transactionWrapper("editProfile", async connection => {
    let db = new DbEntity(RawUser, connection)
    if (user.nickname) {
      if (await db.pullBySearching('nickname', user.nickname)) throw new LogicalError("昵称已被使用")
      let dbUser = new RawUser()
      dbUser.nickname = user.nickname
      dbUser.id = id
      await db.save(dbUser)
    }
    if (role > CUSTOMER_USER && (user.name || user.phone)) {
      let row: { name?: string, phone?: string } = {}
      if (user.name) row.name = user.name
      if (user.phone) row.phone = user.phone
      return !!(await query<null>(
        "UPDATE ?? SET ? WHERE id = ?",
        [["Maintainer", "Manager"][role - MAINTAINER_USER], row, id],
        connection,
      )).affectedRows
    }
  })
}
