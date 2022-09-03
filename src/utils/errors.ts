import { MysqlError } from "mysql"

export class LogicalError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'logical'
  }
}

export class PermissionError extends Error {
  constructor (requiredRole: number) {
    super(`只有${['', '客户', '维护者', '管理者'][requiredRole]}可以访问接口`)
    this.name = 'permission'
  }
}

export class DatabaseError extends Error {
  public code: string
  constructor (err: MysqlError) {
    super(err.sqlMessage ?? err.message)
    this.name = 'database'
    this.code = err.code
  }
}