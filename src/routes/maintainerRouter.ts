import body = require("koa-body")
import Router = require("@koa/router");
import { MAINTAINER_USER } from "../constant/values";
import { GeoPoint, geoPointParams } from "../entities/dto/Geographical";
import { Paginator, paginatorParams } from "../entities/dto/Paginator";
import { RepairRecord } from "../entities/dto/RawRecords";
import Result from "../entities/vo/Result";
import { activateBike, checkAndPlan, finishMaintaining, getBikeBySeriesNo, handleMalfunction, listBikesInSection, listMalfunctionRecords, listMalfunctionRecordsOfBike, listParkingPointInSection, listRepair, listRepairByDate, listSection, registerBike, startMaintaining } from "../services/bikeService";
import { roleOnly } from "../utils/auth";
import { checkBody, checkBodyAsEntity, checkParams, lengthRestriction } from "../utils/body";

const maintainerRouter = new Router()
maintainerRouter.use(body())
maintainerRouter.use(roleOnly(MAINTAINER_USER))

maintainerRouter.get('/list_sections', async ctx => {
  ctx.body = Result.success(await listSection(ctx.state.user.id))
})

maintainerRouter.get('/list_parking_points', checkParams([
  { key: 'section_id', restrictions: ['integer', 'positive'] },
]), async ctx => {
  ctx.body = Result.success(await listParkingPointInSection(parseInt(ctx.query.section_id as string)))
})

const bikeRouter = new Router()

bikeRouter.get('/list', checkParams([
  { key: 'section_id', restrictions: ['integer', 'positive'] },
]), async ctx => {
  ctx.body = Result.success(await listBikesInSection(parseInt(ctx.query.section_id as string)))
})

bikeRouter.get('/list_to_move', checkParams([
  { key: 'section_id', restrictions: ['integer', 'positive'] },
]), async ctx => {
  ctx.body = Result.success(await checkAndPlan(parseInt(ctx.query.section_id as string)))
})

bikeRouter.get("/find", checkParams([
  { key: "series_no", restrictions: [lengthRestriction(12, 12)] }
]), async ctx => {
  ctx.body = Result.success(await getBikeBySeriesNo(ctx.query.series_no as string, false))
})

bikeRouter.post('/register', checkBody([
  { key: 'encrypted', restrictions: ['string'] },
  { key: 'series_id', restrictions: ['number', 'integer', 'positive'] },
]), async ctx => {
  let body = ctx.request.body as { encrypted: string, series_id: number }
  ctx.body = Result.success(await registerBike(body.encrypted, body.series_id))
})

bikeRouter.post('/activate', checkBody([
  { key: 'encrypted', restrictions: ['string'] },
]), async ctx => {
  let body = ctx.request.body as { encrypted: string }
  ctx.body = Result.success(await activateBike(body.encrypted))
})

maintainerRouter.post('/maintain/start', checkBody([
  { key: 'bike_id', restrictions: ['number', 'integer', 'positive'] },
]), async ctx => {
  let body = ctx.request.body as { bike_id: number }
  ctx.body = Result.success(await startMaintaining(body.bike_id))
})

maintainerRouter.post('/maintain/finish', checkBody<GeoPoint & { bike_id: number }>([
  { key: 'bike_id', restrictions: ['number', 'integer', 'positive'] },
  ...geoPointParams,
]), async ctx => {
  let body = ctx.request.body as GeoPoint & { bike_id: number }
  ctx.body = Result.success(await finishMaintaining(body.bike_id, body.p_longitude, body.p_latitude))
})

maintainerRouter.get("/malfunction/list", checkParams<Paginator & { bike_id: string }>([
  { key: 'bike_id', restrictions: ['integer'] },
  ...paginatorParams,
]), async ctx => {
  let { lastId, size, bike_id } = ctx.query as Paginator & { bike_id: string }
  ctx.body = Result.success(await listMalfunctionRecordsOfBike(parseInt(bike_id), parseInt(lastId), parseInt(size)))
})

maintainerRouter.post('/malfunction/handle', checkBodyAsEntity(RepairRecord), async ctx => {
  ctx.body = Result.success(await handleMalfunction(ctx.request.body))
})

maintainerRouter.get("/repair/list", checkParams(paginatorParams), async ctx => {
  let { lastId, size } = ctx.query as Paginator
  ctx.body = Result.success(await listRepair(ctx.state.user.id, parseInt(lastId), parseInt(size)))
})

maintainerRouter.get("/repair/graph", async ctx => {
  ctx.body = Result.success(await listRepairByDate(ctx.state.user.id))
})

maintainerRouter.use('/bike', bikeRouter.routes())

export default maintainerRouter