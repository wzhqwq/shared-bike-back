import Router = require("@koa/router")
import { CUSTOMER_USER } from "../constant/values"
import { Paginator, paginatorParams } from "../entities/dto/Paginator"
import { ExchangeRecord, MalfunctionRecord, RechargeRecord } from "../entities/dto/RawRecords"
import Result from "../entities/vo/Result"
import { getBikeBySeriesNo, listBikesAround, listMalfunctionRecords, listRideRecords, reportMalfunction, tryUnlockBike, updateWhileRiding } from "../services/bikeService"
import { listSouvenirs } from "../services/constantService"
import { exchange, listDepositChanges, listExchangeRecords, listPointChanges, listRechargeRecords, recharge } from "../services/customerPropertyService"
import { roleOnly } from "../utils/auth"
import { checkBody, checkBodyAsEntity, checkBodyAsEntityList, checkParams, lengthRestriction } from "../utils/body"

const customerRouter = new Router()
customerRouter.use(roleOnly(CUSTOMER_USER))

const bikeRouter = new Router()

bikeRouter.get("/list", checkParams([
  { key: 'longitude', restrictions: ['geographical'] },
  { key: 'latitude', restrictions: ['geographical'] },
]), async ctx => {
  let { longitude, latitude } = ctx.params as { longitude: string, latitude: string }
  ctx.body = Result.success(await listBikesAround(parseFloat(longitude), parseFloat(latitude), CUSTOMER_USER))
})

bikeRouter.get("/find", checkParams([
  { key: "series_no", restrictions: [lengthRestriction()] }
]), async ctx => {
  ctx.body = Result.success(await getBikeBySeriesNo(ctx.params.series_no))
})

bikeRouter.post("/unlock", checkBody([
  { key: 'bike_id', restrictions: ['integer'] },
  { key: 'encrypted', restrictions: ['string'] },
]), async ctx => {
  let { bike_id, encrypted } = ctx.request.body as { bike_id: number, encrypted: string }
  ctx.body = Result.success(await tryUnlockBike(ctx.state.user.id, bike_id, encrypted))
})

bikeRouter.post("/update", checkBody([
  { key: 'bike_id', restrictions: ['integer'] },
  { key: 'encrypted', restrictions: ['string'] },
]), async ctx => {
  let { bike_id, encrypted } = ctx.request.body as { bike_id: number, encrypted: string }
  ctx.body = Result.success(await updateWhileRiding(bike_id, ctx.state.user.id, encrypted))
})

bikeRouter.post("/report", checkBodyAsEntityList(MalfunctionRecord), async ctx => {
  ctx.body = Result.success(await reportMalfunction(ctx.request.body, ctx.state.user.id))
})

bikeRouter.get("/record/list/ride", checkParams(paginatorParams), async ctx => {
  let { lastId, size } = ctx.params as Paginator
  ctx.body = Result.success(await listRideRecords(ctx.state.user.id, parseInt(lastId), parseInt(size)))
})

bikeRouter.get("/record/list/malfunction", checkParams([
  { key: 'ride_id', restrictions: ['integer'] },
]), async ctx => {
  ctx.body = Result.success(await listMalfunctionRecords(ctx.state.user.id, parseInt(ctx.params.ride_id)))
})

let propertyRouter = new Router()

propertyRouter.get("/list/:type", checkParams(paginatorParams), async ctx => {
  let { lastId, size } = ctx.params as Paginator
  let type = ctx.params.type as "points" | "deposit" | "recharge"
  switch(type) {
    case 'points':
      ctx.body = Result.success(await listPointChanges(ctx.state.user.id, parseInt(lastId), parseInt(size)))
      break
    case 'deposit':
      ctx.body = Result.success(await listDepositChanges(ctx.state.user.id, parseInt(lastId), parseInt(size)))
      break
    case 'recharge':
      ctx.body = Result.success(await listRechargeRecords(ctx.state.user.id, parseInt(lastId), parseInt(size)))
      break
  }
})

propertyRouter.post("/recharge", checkBodyAsEntity(RechargeRecord), async ctx => {
  ctx.body = Result.success(await recharge(ctx.request.body, ctx.state.user.id))
})

let souvenirRouter = new Router()

souvenirRouter.get("/items/list", async ctx => {
  ctx.body = Result.success(await listSouvenirs())
})

souvenirRouter.get("/exchanged/list", checkParams(paginatorParams), async ctx => {
  let { lastId, size } = ctx.params as Paginator
  ctx.body = Result.success(await listExchangeRecords(ctx.state.user.id, parseInt(lastId), parseInt(size)))
})

souvenirRouter.post("/exchange", checkBodyAsEntity(ExchangeRecord), async ctx => {
  ctx.body = Result.success(await exchange(ctx.request.body, ctx.state.user.id))
})

customerRouter.use('/bike', bikeRouter.routes())
customerRouter.use('/property', propertyRouter.routes())
customerRouter.use('/souvenir', souvenirRouter.routes())

export default customerRouter