import { BIKE_AVAILABLE, BIKE_DESTROYED, BIKE_OCCUPIED, BIKE_UNAVAILABLE, MASTER_BILL_FROM_BIKE, MASTER_BILL_FROM_OTHER, MASTER_BILL_FROM_RIDING, MASTER_BILL_FROM_SOUVENIR } from "../constant/values"
import { BikeSeries } from "../entities/dto/RawBike"
import { BikeBill, ExchangeRecord, ManagerBill, OtherBill, RideRecord, SouvenirBill } from "../entities/dto/RawRecords"
import { Souvenir } from "../entities/dto/Souvenir"
import { RawCustomer, RawUser } from "../entities/dto/RawUser"
import { DbEntity, DbJoined } from "../entities/entity"
import { query, transactionWrapper } from "../utils/db"
import { LogicalError } from "../utils/errors"

export function listSeparatedBill(category: 'bike' | 'souvenir' | 'other', lastId: number, size: number = 20) {
  return transactionWrapper("listSeparatedBill", async connection => {
    let C: { new(...args: any[]): BikeBill | SouvenirBill | OtherBill }
    switch (category) {
      case 'bike':
        C = BikeBill
        break
      case 'souvenir':
        C = SouvenirBill
        break
      case 'other':
        C = OtherBill
        break
      default:
        throw new LogicalError("类别不存在")
    }
    return await new DbEntity(C, connection).list([
      [['id'], '<', lastId],
    ], undefined, size, { key: 'id', mode: 'DESC' })
  })
}

export function listMasterBill(lastId: number, size: number = 20) {
  return transactionWrapper("listMasterBill", async connection => {
    return await new DbEntity(ManagerBill, connection).list([
      [['id'], '<', lastId],
    ], undefined, size, { key: 'id', mode: 'DESC' })
  })
}

export function getBillDetails(type: number, recordId: number) {
  return transactionWrapper("getBillDetails", async connection => {
    let CLeft: { new(...args: any[]): RideRecord | BikeBill | SouvenirBill | OtherBill }
    let CRight: { new(...args: any[]): RawCustomer | BikeSeries | Souvenir }
    switch (type) {
      case MASTER_BILL_FROM_RIDING:
        CLeft = RideRecord
        CRight = RawCustomer
        break
      case MASTER_BILL_FROM_BIKE:
        CLeft = BikeBill
        CRight = BikeSeries
        break
      case MASTER_BILL_FROM_SOUVENIR:
        CLeft = SouvenirBill
        CRight = Souvenir
        break
      case MASTER_BILL_FROM_OTHER:
        CLeft = OtherBill
        break
      default:
        throw new LogicalError("类别不存在")
    }
    let leftDb = new DbEntity(CLeft, connection)
    if (CRight) {
      let rightDb = new DbEntity(CRight, connection)
      let joined = new DbJoined(leftDb.asTable([[['id'], '=', recordId]]), rightDb.asTable(), connection)
      let result = (await joined.list())[0]
      if (!result) throw new LogicalError("记录不存在")

      if (result[1] instanceof RawCustomer) {
        let user = await new DbEntity(RawUser, connection).pullBySearching([[['id'], '=', result[1].user_id]])
        return { ...result[0], ...result[1], nickname: user?.nickname }
      }
      else {
        return { ...result[0], name: result[1].name }
      }
    }
    else {
      let result = await leftDb.pullBySearching([[['id'], '=', recordId]])
      if (!result) throw new LogicalError("记录不存在")
      return result
    }
  })
}

export function purchaseBikes(record: BikeBill, managerId: number) {
  return transactionWrapper("purchaseBikes", async connection => {
    record.manager_id = managerId
    record.time = new Date()
    await new DbEntity(BikeBill, connection).append(record)
    return record
  })
}

export function purchaseSouvenir(record: SouvenirBill, managerId: number) {
  return transactionWrapper("purchaseSouvenir", async connection => {
    record.manager_id = managerId
    record.time = new Date()
    await new DbEntity(SouvenirBill, connection).append(record)
    await new DbEntity(Souvenir, connection).update([
      ['total_amount', [['total_amount'], '+', record.amount]]
    ], [
      [['id'], '=', record.souvenir_id]
    ])
    return record
  })
}

export function recordOtherBill(record: OtherBill, managerId: number) {
  return transactionWrapper("recordOtherBill", async connection => {
    record.manager_id = managerId
    record.time = new Date()
    await new DbEntity(OtherBill, connection).append(record)
    return record
  })
}

export function getBikeStatistics() {
  return transactionWrapper("getBikeStatistics", async connection => {
    let availableCount = (await query<{ c: number }>(
      "SELECT COUNT(*) AS c FROM `Bike` WHERE `status` = ?", [BIKE_AVAILABLE], connection
    ))[0].c
    let occupiedCount = (await query<{ c: number }>(
      "SELECT COUNT(*) AS c FROM `Bike` WHERE `status` = ?", [BIKE_OCCUPIED], connection
    ))[0].c
    let unavailableCount = (await query<{ c: number }>(
      "SELECT COUNT(*) AS c FROM `Bike` WHERE `status` = ?", [BIKE_UNAVAILABLE], connection
    ))[0].c
    let destroyedCount = (await query<{ c: number }>(
      "SELECT COUNT(*) AS c FROM `Bike` WHERE `status` = ?", [BIKE_DESTROYED], connection
    ))[0].c
    return { availableCount, occupiedCount, unavailableCount, destroyedCount }
  })
}

export function listExchanges(customerId: number) {
  return transactionWrapper('listExchanges', async connection =>
    new DbEntity(ExchangeRecord, connection).list([[['customer_id'], '=', customerId]])
  )
}

export function giveSouvenir(recordId: number, managerId: number) {
  return transactionWrapper('listExchanges', async connection =>
    new DbEntity(ExchangeRecord, connection).update([
      ['given', 1],
      ['given_by', managerId],
    ], [
      [['id'], '=', recordId],
    ])
  )
}
