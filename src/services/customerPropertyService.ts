import { DepositRecord, ExchangeRecord, PointRecord, PunishRecord, RechargeRecord } from "../entities/dto/RawRecords";
import { Souvenir } from "../entities/dto/Souvenir";
import { RawCustomer } from "../entities/dto/RawUser";
import { DbEntity, DbJoined } from "../entities/entity";
import { transactionWrapper } from "../utils/db";
import { LogicalError } from "../utils/errors";

export function listDepositChanges(customerId: number, lastId: number, size: number = 20) {
  return transactionWrapper("listDepositChanges", async connection => {
    return await new DbEntity(DepositRecord, connection).list([
      [['customer_id'], '=', customerId],
      [['id'], '<', lastId],
    ], undefined, size, { key: 'id', mode: 'DESC' })
  })
}

export function listPointChanges(customerId: number, lastId: number, size: number = 20) {
  return transactionWrapper("listPointChanges", async connection => {
    return await new DbEntity(PointRecord, connection).list([
      [['customer_id'], '=', customerId],
      [['id'], '<', lastId],
    ], undefined, size, { key: 'id', mode: 'DESC' })
  })
}

export function listExchangeRecords(customerId: number, lastId: number, size: number = 20) {
  return transactionWrapper("listExchangeRecords", async connection => {
    return await new DbJoined(
      new DbEntity(ExchangeRecord).asTable([
        [['customer_id'], '=', customerId],
        [['id'], '<', lastId],
      ], size, { key: 'id', mode: 'DESC' }),
      new DbEntity(Souvenir).asTable()
    ).list()
  })
}

export function recharge(record: RechargeRecord, customerId: number) {
  return transactionWrapper("recharge", async connection => {
    let rechargeDb = new DbEntity(RechargeRecord, connection)
    record.customer_id = customerId
    record.time = new Date()
    await rechargeDb.append(record)

    return record
  })
}

export function exchange(record: ExchangeRecord, customerId: number) {
  return transactionWrapper("exchange", async connection => {
    let customerDb = new DbEntity(RawCustomer, connection)
    let souvenirDb = new DbEntity(Souvenir, connection)
    let customer = await customerDb.pullBySearching([[['user_id'], '=', customerId]])
    let souvenir = await souvenirDb.pullBySearching([[['id'], '=', record.souvenir_id]])
    if (!customer) throw new LogicalError("用户不存在")
    if (!souvenir) throw new LogicalError("纪念品不存在")

    if (souvenir.price * record.amount > customer.points) throw new LogicalError("兑换纪念品的点数不足")
    
    let exchangeDb = new DbEntity(ExchangeRecord, connection)
    record.given = 0
    record.customer_id = customerId
    record.time = new Date()
    await exchangeDb.append(record)

    return record
  })
}

export function punish(record: PunishRecord) {
  return transactionWrapper("punish", async connection => {
    let customerDb = new DbEntity(RawCustomer, connection)
    let customer = await customerDb.pullBySearching([[['user_id'], '=', record.customer_id]])
    if (!customer) throw new LogicalError("用户不存在")

    let punishDb = new DbEntity(PunishRecord, connection)
    record.time = new Date()
    await punishDb.append(record)
    
    return record
  })
}