import { PoolConnection } from "mysql"
import { BIKE_AVAILABLE, BIKE_NOT_ACTIVATED, BIKE_OCCUPIED, BIKE_UNAVAILABLE, CONFIG_CHARGE_MIN_MILAGE, CONFIG_CHARGE_MIN_SECONDS, CONFIG_CHARGE_PER_MINUTE, CONFIG_OUT_OF_PP_PUNISH_POINTS, EXPAND_RATE, REPAIR_FAILED, REPAIR_FIXED } from "../../constant/values"
import { bikeComm } from "../../utils/auth"
import { LogicalError } from "../../utils/errors"
import { RawBike } from "../dto/RawBike"
import { Malfunction } from "../dto/Malfunction"
import { ParkingPoint } from "../dto/ParkingPoint"
import { MalfunctionRecord, RideRecord } from "../dto/RawRecords"
import { Section } from "../dto/Section"
import { DbEntity, DbJoined, RedisDbEntity } from "../entity"
import { getConfigValue, getSeries } from "../../services/constantService"
import { posDecimal } from "../../utils/body"
import { punishAfterwards } from "../../services/customerPropertyService"

export class Bike {
  public raw: RawBike
  private bikeDb: RedisDbEntity<RawBike>
  constructor(private connection: PoolConnection) {
    this.bikeDb = new RedisDbEntity(RawBike, 'id', connection)
  }

  public async fetchBike(id: number) {
    this.raw = await this.bikeDb.get(id)
    if (!this.raw) throw new LogicalError("单车不存在")
    return this
  }

  public async newBike(seriesId: number, posLongitude: string, posLatitude: string, seriesNo: string) {
    this.raw = new RawBike()
    this.raw.series_id = seriesId
    this.raw.series_no = seriesNo
    this.raw.p_longitude = posLongitude
    this.raw.p_latitude = posLatitude
    this.raw.status = BIKE_NOT_ACTIVATED
    await this.bikeDb.append(this.raw)
    return this.raw.id
  }

  public async unlock(s: string) {
    let result = bikeComm.decrypt(s)
    if (result.length !== 2) throw new LogicalError("单车认证失败")
    let [token, id] = result
    if (token.length !== 20) throw new LogicalError("单车认证失败")
    if (parseInt(id) !== this.raw.id) throw new LogicalError("单车信息不匹配")

    if (this.raw.status !== BIKE_AVAILABLE) throw new LogicalError("单车不可用")
    this.raw.token = token
    await this.bikeDb.save(this.raw)

    return bikeComm.encrypt([token])
  }

  public async updateWhileRiding(s: string, userId: number) {
    let result = bikeComm.decrypt(s)
    if (result.length !== 5) throw new LogicalError("数据同步失败")
    let token = result[0], status = parseInt(result[1]), mileage = parseFloat(result[2]),
      posLongitude = result[3], posLatitude = result[4]
    if (isNaN(status) || isNaN(mileage) || !posDecimal.test(posLongitude) || !posDecimal.test(posLatitude))
      throw new LogicalError("同步数据格式错误")
    if (this.raw.token !== token) throw new LogicalError("数据同步失败")

    let recordDb = new RedisDbEntity(RideRecord, 'bike_id', this.connection)
    if (this.raw.status === BIKE_AVAILABLE && status === BIKE_OCCUPIED) {
      // 开锁，开始记录
      let record = new RideRecord()
      record.bike_id = this.raw.id
      record.start_time = new Date()
      record.customer_id = userId
      record.mileage = mileage

      await this.update(status, posLongitude, posLatitude)
      await recordDb.save(record)
      return bikeComm.encrypt([record.id.toString()])
    }
    if (this.raw.status === BIKE_OCCUPIED) {
      await this.update(status, posLongitude, posLatitude)

      let record = await recordDb.get(this.raw.id)
      if (!record) throw new LogicalError("查询记录失败")
      record.mileage = mileage
      let duration = (new Date().valueOf() - record.start_time.valueOf()) / 1000
      let charge = await this.calculateCharge(duration, mileage)
      if (status === BIKE_AVAILABLE) {
        // 关锁成功
        record.end_time = new Date()
        record.charge = charge.toFixed(2)
        if (!this.raw.parking_point_id) {
          // 不在停车点停车扣积分
          punishAfterwards(userId, getConfigValue(CONFIG_OUT_OF_PP_PUNISH_POINTS), '未在停车点停车')
        }
      }

      await recordDb.save(record)
      return `${duration.toFixed(0)},${charge.toFixed(2)}`
    }
    throw new LogicalError("无效更新操作")
  }

  public async update(status: number, posLongitude?: string, posLatitude?: string) {
    this.raw.status = status
    if (posLongitude)
      this.raw.p_longitude = posLongitude
    else
      posLongitude = this.raw.p_longitude
    if (posLatitude)
      this.raw.p_latitude = posLatitude
    else
      posLatitude = this.raw.p_latitude

    let ppDb = new DbEntity(ParkingPoint, this.connection)
    if (status === BIKE_AVAILABLE) {
      let sectionDb = new DbEntity(Section, this.connection)
      let section = await sectionDb.pullBySearching([
        [posLongitude, 'BETWEEN', [['bl_longitude'], ['tr_longitude']]],
        [posLatitude, 'BETWEEN', [['bl_latitude'], ['tr_latitude']]],
      ])
      let pp = await ppDb.pullBySearching([
        [posLongitude, 'BETWEEN', [
          [['p_longitude'], '-', [['bikes_count'], '*', EXPAND_RATE]],
          [['p_longitude'], '+', [['bikes_count'], '*', EXPAND_RATE]],
        ]],
        [posLatitude, 'BETWEEN', [
          [['p_latitude'], '-', [['bikes_count'], '*', EXPAND_RATE]],
          [['p_latitude'], '+', [['bikes_count'], '*', EXPAND_RATE]],
        ]],
      ])

      if (pp) {
        let ppDb = new DbEntity(ParkingPoint, this.connection)
        await ppDb.update([['bikes_count', [['bikes_count'], '+', 1]]], [[['id'], '=', pp.id]])
      }

      this.raw.parking_point_id = pp?.id ?? null
      this.raw.parking_section_id = section?.id ?? null
      this.raw.health = await this.calculateHealth()
    }
    else {
      if (this.raw.parking_point_id) {
        await ppDb.update([['bikes_count', [['bikes_count'], '-', 1]]], [[['id'], '=', this.raw.parking_point_id]])
      }
    }
    await this.bikeDb.save(this.raw)
  }

  public async finishMaintaining(posLongitude: string, posLatitude: string) {
    await this.update(BIKE_AVAILABLE, posLongitude, posLatitude)
  }

  public async calculateHealth() {
    if (this.raw.mileage > getSeries(this.raw.series_id).mileage_limit) return 0 // 超过报废里程就报废

    let records = await new DbJoined(
      new DbEntity(MalfunctionRecord).asTable([
        [['bike_id'], '=', this.raw.id],
        [['status'], '<', REPAIR_FIXED],
      ]),
      new DbEntity(Malfunction).asTable(),
      this.connection
    ).list([], ['degree', 'damage_degree', 'malfunction_id'])

    let map = new Map<number, { degree: number[], multiplier: number }>()
    records.forEach(([r, m]) => {
      let list = map.get(r.malfunction_id)?.degree
      if (!list) {
        list = []
        map.set(r.malfunction_id, { degree: list, multiplier: m.damage_degree })
      }
      list.push(r.degree)
    })

    let health = 100
    map.forEach(({ degree, multiplier }) => {
      if (degree.length < 3) return
      let sortedDegrees = degree.sort((a, b) => b - a)  // 降序排序
      let avgDegree = sortedDegrees[0] === 10 ? 10 :    // 若出现致命故障直接扣大分
        sortedDegrees.slice(1, -2).reduce((a, b) => a + b) / (degree.length - 2)  // 否则去掉最高分最低分求平均
      health -= avgDegree * multiplier
    })
    
    return Math.floor(health)
  }

  public async calculateCharge(duration: number, milage: number) {
    if (
      duration < getConfigValue(CONFIG_CHARGE_MIN_SECONDS) ||
      milage < getConfigValue(CONFIG_CHARGE_MIN_MILAGE)
    ) return 0
    return duration * CONFIG_CHARGE_PER_MINUTE / 60
  }
}