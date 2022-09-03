import { BIKE_AVAILABLE, BIKE_DESTROYED, BIKE_NOT_ACTIVATED, BIKE_UNAVAILABLE, CONFIG_REWARD_BASE, CONFIG_REWARD_DESCRIPTION, CONFIG_REWARD_PICTURE, CONFIG_SAFE_HEALTH, REPAIR_UNHANDLED, SEARCH_RANGE } from "../constant/values"
import { Bike } from "../entities/bo/Bike"
import { BikeSeries, RawBike } from "../entities/dto/RawBike"
import { Malfunction } from "../entities/dto/Malfunction"
import { DestroyRecord, MalfunctionRecord, RepairRecord, RideRecord } from "../entities/dto/RawRecords"
import { ConditionType, DbEntity, DbJoined } from "../entities/entity"
import { listHide } from "../entities/vo/Result"
import { transactionWrapper } from "../utils/db"
import { LogicalError } from "../utils/errors"
import { getConfigValue, cachedMalfunctions, cachedSeriesList, getSeries, decreaseSeriesCount, increaseSeriesCount } from "./constantService"
import { bikeComm } from "../utils/auth"
import { MaintainerSection, Section } from "../entities/dto/Section"
import { ParkingPoint } from "../entities/dto/ParkingPoint"
import { posDecimal } from "../utils/body"
import { RawMaintainer } from "../entities/dto/RawUser"

export function listBikes(lastId: number, size: number = 20, filter?: "danger" | "NA" | "all", sectionId?: number) {
  return transactionWrapper("listBikes", async (connection) => {
    let bikeDb = new DbEntity(RawBike, connection)
    let seriesDb = new DbEntity(BikeSeries, connection)
    let conditions: ConditionType<RawBike>[] = [[['id'], '<', lastId]]
    switch (filter) {
      case "danger":
        conditions.push(
          [['health'], '<', getConfigValue(CONFIG_SAFE_HEALTH)],
          [['status'], '=', BIKE_AVAILABLE],
        )
        break
      case "NA":
        conditions.push([['status'], '=', BIKE_UNAVAILABLE])
        break
      case "all":
        break
      default:
        conditions.push([['status'], '<>', BIKE_DESTROYED])
    }
    if (sectionId) conditions.push([['parking_section_id'], '=', sectionId])
    let joinedDb = new DbJoined(
      bikeDb.asTable(conditions, size, { key: 'id', mode: 'DESC' }),
      seriesDb.asTable(), 
      connection
    )
    return (await joinedDb.list())
      .map(([b, s]) => ({ ...b, series_name: s.name }))
  })
}

export function listBikesAround(posLongitude: number, posLatitude: number, role: number) {
  return transactionWrapper("listBikesAround", async (connection) => {
    let bikeDb = new DbEntity(RawBike, connection)
    let result = await bikeDb.list([
      [['status'], '=', BIKE_AVAILABLE],
      [['health'], '>=', getConfigValue(CONFIG_SAFE_HEALTH)],
      [['p_longitude'], 'BETWEEN',
        [(posLongitude - SEARCH_RANGE).toFixed(6), (posLongitude + SEARCH_RANGE).toFixed(6)]
      ],
      [['p_latitude'], 'BETWEEN',
        [(posLatitude - SEARCH_RANGE).toFixed(6), (posLatitude + SEARCH_RANGE).toFixed(6)]
      ],
    ])
    listHide(result, role)
    return result
  })
}

export function getBike(bikeId: number) {
  transactionWrapper("getBike", async connection => (await new Bike(connection).fetchBike(bikeId)).raw)
}

export function tryUnlockBike(bikeId: number, encrypted: string) {
  return transactionWrapper("tryUnlockBike", async (connection) => {
    let bike = await (new Bike(connection).fetchBike(bikeId))
    return await bike.unlock(encrypted)
  })
}
export function updateWhileRiding(bikeId: number, userId: number, encrypted: string) {
  return transactionWrapper("updateWhileRiding", async (connection) => {
    let bike = await (new Bike(connection).fetchBike(bikeId))
    return await bike.updateWhileRiding(encrypted, userId)
  })
}

export function listRideRecords(customerId: number, lastId: number, size: number = 20) {
  return transactionWrapper("listRideRecords", async (connection) => {
    return await new DbEntity(RideRecord, connection).list([
      [['customer_id'], '=', customerId],
      [['id'], '<', lastId],
    ], undefined, size, { key: 'id', mode: 'DESC' })
  })
}

export function startMaintaining(bikeId: number) {
  return transactionWrapper("startMaintaining", async (connection) => {
    let bikeDb = new DbEntity(RawBike, connection)
    await bikeDb.update([['status', BIKE_UNAVAILABLE]], [[['id'], '=', bikeId]])
    return null
  })
}

export function finishMaintaining(bikeId: number, posLongitude: string, posLatitude: string) {
  return transactionWrapper("finishMaintaining", async (connection) => {
    let bike = await (new Bike(connection).fetchBike(bikeId))
    await bike.finishMaintaining(posLongitude, posLatitude)
    return bike.raw
  })
}

export function handleMalfunction(repairRecord: RepairRecord) {
  return transactionWrapper("handleMalfunction", async (connection) => {
    let repairDb = new DbEntity(RepairRecord, connection)
    let bikeDb = new DbEntity(RawBike, connection)
    let malfunctionDb = new DbEntity(Malfunction, connection)
    let mRecordDb = new DbEntity(MalfunctionRecord, connection)
    
    if (!await bikeDb.pullBySearching([[['id'], '=', repairRecord.bike_id]]))
      throw new LogicalError("单车不存在")
    if (!await malfunctionDb.pullBySearching([[['id'], '=', repairRecord.malfunction_id]]))
      throw new LogicalError("故障不存在")
    
    let malfunctionRecords = await mRecordDb.list([
      [['status'], '=', REPAIR_UNHANDLED],
      [['bike_id'], '=', repairRecord.bike_id],
      [['malfunction_id'], '=', repairRecord.malfunction_id],
    ], ['id'])
    if (!malfunctionRecords.length) throw new LogicalError("该单车没有待处理的故障")

    await mRecordDb.update([
      ['status', repairRecord.conclusion + 1]
    ], [
      [['status'], '=', REPAIR_UNHANDLED],
      [['bike_id'], '=', repairRecord.bike_id],
      [['malfunction_id'], '=', repairRecord.malfunction_id],
    ])

    await repairDb.append(repairRecord)

    await new DbEntity(RawMaintainer, connection).update([
      ['handle_count', [['handle_count'], '+', 1]]
    ], [
      [['user_id'], '=', repairRecord.maintainer_id]
    ])

    return malfunctionRecords.map(r => r.id)
  })
}

export function reportMalfunction(mRecords: MalfunctionRecord[], customerId: number) {
  return transactionWrapper("reportMalfunction", async (connection) => {
    let malfunctionIds = cachedMalfunctions.map(m => m.id)
    if (mRecords.some(r => !malfunctionIds.includes(r.malfunction_id))) throw new LogicalError("故障ID不存在")

    let rideDb = new DbEntity(RideRecord)
    let rideRecord = await rideDb.pullBySearching([[['id'], '=', mRecords[0].ride_id]])
    if (!rideRecord) throw new LogicalError("骑行日志不存在")
    if (rideRecord.customer_id !== customerId) throw new LogicalError("您与该骑行无关，无法报修")
    let bikeId = rideRecord.bike_id

    let mRecordDb = new DbEntity(MalfunctionRecord, connection)
    await Promise.all(mRecords.map(async r => {
      r.bike_id = bikeId
      return await mRecordDb.append(r)
    }))

    // 计算积分
    let points = getConfigValue(CONFIG_REWARD_BASE)
    if (mRecords.some(r => r.description.length > 10)) points += getConfigValue(CONFIG_REWARD_DESCRIPTION)
    if (mRecords.some(r => r.image_key)) points += getConfigValue(CONFIG_REWARD_PICTURE)
    rideRecord.points_acquired = points

    await rideDb.save(rideRecord)

    return points
  })
}

export function listMalfunctionRecords(customerId: number, rideId: number) {
  return transactionWrapper("listMalfunctionRecords", async (connection) => {
    let rideDb = new DbEntity(RideRecord, connection)
    let rideRecord = await rideDb.pullBySearching([[['id'], '=', rideId]])
    if (!rideRecord) throw new LogicalError("骑行记录不存在")
    if (rideRecord.customer_id !== customerId) throw new LogicalError("您与该骑行无关")

    return await new DbEntity(MalfunctionRecord, connection).list([[['ride_id'], '=', rideId]])
  })
}

export function registerBike(encrypted: string, seriesId: number) {
  return transactionWrapper("registerBike", async (connection) => {
    if (!cachedSeriesList.some(s => s.id === seriesId)) throw new LogicalError("单车型号不存在")

    let messages = bikeComm.decrypt(encrypted)
    if (messages.length !== 3) throw new LogicalError("单车识别失败")
    let [token, posLongitude, posLatitude] = messages
    if (token.length !== 20 || !posDecimal.test(posLongitude) || !posDecimal.test(posLatitude))
      throw new LogicalError("单车识别失败")

    let bikeId = await new Bike(connection).newBike(seriesId, posLongitude, posLatitude)
    return bikeComm.encrypt([token, bikeId.toString()])
  })
}

export function activateBike(encrypted: string) {
  return transactionWrapper("registerBike", async (connection) => {
    let bikeId = parseInt(bikeComm.decrypt(encrypted)[0])
    if (isNaN(bikeId)) throw new LogicalError("单车激活失败")

    let bike = await (new Bike(connection).fetchBike(bikeId))
    if (!bike) throw new LogicalError("激活了不存在的单车")
    if (bike.raw.status !== BIKE_NOT_ACTIVATED) throw new LogicalError("单车被激活过了")

    await bike.update(BIKE_AVAILABLE)
    await increaseSeriesCount(bike.raw.series_id, connection)

    return bike.raw
  })
}

export function destroyBike(record: DestroyRecord, managerId: number) {
  return transactionWrapper("destroyBike", async connection => {
    let bike = await (new Bike(connection).fetchBike(record.bike_id))
    if (!bike) throw new LogicalError("单车不存在")
    if (bike.raw.status === BIKE_DESTROYED) throw new LogicalError("单车已经报废过了")

    await bike.update(BIKE_DESTROYED)
    let recordDb = new DbEntity(DestroyRecord)
    record.manager_id = managerId
    record.time = new Date()
    await recordDb.append(record)

    await decreaseSeriesCount(bike.raw.series_id, connection)

    return record
  })
}

export function listSection() {
  return transactionWrapper("listSection", async (connection) => new DbEntity(Section, connection).list())
}

export function createSection(section: Section) {
  return transactionWrapper("createSection", async (connection) => {
    let sectionDb = new DbEntity(Section, connection)
    await sectionDb.append(section)
    
    // 更新管理区内单车
    let bikeDb = new DbEntity(RawBike, connection)
    await bikeDb.update([
      ['parking_section_id', section.id]
    ], [
      [['parking_section_id'], 'IS', null],
      [['p_longitude'], 'BETWEEN', [section.bl_longitude, section.tr_longitude]],
      [['p_latitude'], 'BETWEEN', [section.bl_latitude, section.tr_latitude]],
    ])

    // 更新管理区内停车点
    let ppDb = new DbEntity(ParkingPoint, connection)
    await ppDb.update([
      ['section_id', section.id]
    ], [
      [['section_id'], 'IS', null],
      [['p_longitude'], 'BETWEEN', [section.bl_longitude, section.tr_longitude]],
      [['p_latitude'], 'BETWEEN', [section.bl_latitude, section.tr_latitude]],
    ])

    return null
  })
}

export function deleteSection(sectionId: number) {
  return transactionWrapper("deleteSection", async (connection) => {
    await new DbEntity(Section, connection).delete([[['id'], '=', sectionId]])
    return null
  })
}

export function grantSectionTo(pair: MaintainerSection) {
  return transactionWrapper("revokeSectionFrom", async (connection) => {
    let db = new DbEntity(MaintainerSection, connection)
    await db.append(pair)

    return null
  })
}

export function revokeSectionFrom(sectionId: number, maintainerId: number) {
  return transactionWrapper("revokeSectionFrom", async (connection) => {
    await new DbEntity(MaintainerSection, connection).delete([
      [['section_id'], '=', sectionId], [['maintainer_id'], '=', maintainerId]
    ])
    return null
  })
}

export function listParkingPoint() {
  return transactionWrapper("listParkingPoint", async (connection) => new DbEntity(ParkingPoint, connection).list())
}

export function createParkingPoint(pp: ParkingPoint) {
  return transactionWrapper("createParkingPoint", async (connection) => {
    let ppDb = new DbEntity(ParkingPoint, connection)
    await ppDb.append(pp)
    return null
  })
}

export function deleteParkingPoint(ppId: number) {
  return transactionWrapper("deleteParkingPoint", async (connection) => {
    await new DbEntity(ParkingPoint, connection).delete([[['id'], '=', ppId]])
    return null
  })
}

export function checkAndPlan(sectionId: number) {
  return transactionWrapper("checkAndPlan", async (connection) => {
    let ppDb = new DbEntity(ParkingPoint, connection)
    let bikeDb = new DbEntity(RawBike, connection)
    let lackOfBikePoints = await ppDb.list([
      [['bikes_count'], '<', ['minimum_count']],
      [['section_id'], '=', sectionId],
    ])
    let lackOfBikePointIds = lackOfBikePoints.map(p => p.id)
    let needed = lackOfBikePoints.reduce((sum, p) => sum + p.minimum_count - p.bikes_count, 0)

    let bikesInSection = (await bikeDb.list([
      [['parking_section_id'], '=', sectionId],
      [['status'], '=', BIKE_AVAILABLE],
      [['health'], '>=', getConfigValue(CONFIG_SAFE_HEALTH)]
    ], ['id', 'p_latitude', 'p_longitude', 'parking_point_id']))
      .map(b => ({ id: b.id, p_latitude: b.p_latitude, p_longitude: b.p_longitude, parking_point_id: b.parking_point_id }))
    if (bikesInSection.length < needed) {
      return { lacks: lackOfBikePoints, solution: null }
    }

    let notInPointBike = bikesInSection.filter(b => !b.parking_point_id)
    if (notInPointBike.length >= needed) {
      return { lacks: lackOfBikePoints, solution: notInPointBike.slice(0, needed) }
    }

    let parkingPoints = new Map<number, { id: number, p_latitude: string, p_longitude: string, parking_point_id: number }[]>()
    bikesInSection.forEach(b => {
      let id = b.parking_point_id
      if (!id || lackOfBikePointIds.includes(id)) return
      let list = parkingPoints.get(id)
      if (!list) {
        list = []
        parkingPoints.set(id, list)
      }
      list.push(b)
    })
    let alternativePoints = (await ppDb.list([
      [['bikes_count'], '>', ['minimum_count']],
      [['section_id'], '=', sectionId],
    ])).map(p => ({ id: p.id, exceeded: p.bikes_count - p.minimum_count })).sort((a, b) => b.exceeded - a.exceeded)

    let result = notInPointBike
    needed -= notInPointBike.length
    for (let p of alternativePoints) {
      if (p.exceeded >= needed) {
        result.push(...parkingPoints.get(p.id).slice(0, needed))
        break
      }
      else {
        result.push(...parkingPoints.get(p.id).slice(0, p.exceeded))
        needed -= p.exceeded
      }
    }
    return { lacks: lackOfBikePoints, solution: result }
  })
}