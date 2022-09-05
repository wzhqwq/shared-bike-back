import Router = require("@koa/router");
import { MAINTAINER_USER } from "../constant/values";
import { GeoPoint, geoPointParams } from "../entities/dto/Geographical";
import { RepairRecord } from "../entities/dto/RawRecords";
import Result from "../entities/vo/Result";
import { activateBike, checkAndPlan, finishMaintaining, handleMalfunction, listBikesInSection, listSection, registerBike, startMaintaining } from "../services/bikeService";
import { roleOnly } from "../utils/auth";
import { checkBody, checkBodyAsEntity, checkParams } from "../utils/body";

const maintainerRouter = new Router()
maintainerRouter.use(roleOnly(MAINTAINER_USER))

maintainerRouter.get('/list_sections', async ctx => {
  ctx.body = Result.success(await listSection(ctx.state.user.id))
})

maintainerRouter.get('/list_bikes', checkParams([
  { key: 'section_id', restrictions: ['integer', 'positive'] },
]), async ctx => {
  ctx.body = Result.success(await listBikesInSection(parseInt(ctx.params.section_id)))
})

maintainerRouter.get('/bikes_to_move', checkParams([
  { key: 'section_id', restrictions: ['integer', 'positive'] },
]), async ctx => {
  ctx.body = Result.success(await checkAndPlan(parseInt(ctx.params.section_id)))
})

maintainerRouter.post('/start_maintain', checkBody([
  { key: 'bike_id', restrictions: ['number', 'integer', 'positive'] },
]), async ctx => {
  let body = ctx.request.body as { bike_id: number }
  ctx.body = Result.success(await startMaintaining(body.bike_id))
})

maintainerRouter.post('/finish_maintain', checkBody<GeoPoint & { bike_id: number }>([
  { key: 'bike_id', restrictions: ['number', 'integer', 'positive'] },
  ...geoPointParams,
]), async ctx => {
  let body = ctx.request.body as GeoPoint & { bike_id: number }
  ctx.body = Result.success(await finishMaintaining(body.bike_id, body.p_longitude, body.p_latitude))
})

maintainerRouter.post('/handle_malfunction', checkBodyAsEntity(RepairRecord), async ctx => {
  ctx.body = Result.success(await handleMalfunction(ctx.request.body))
})

maintainerRouter.post('/register_bike', checkBody([
  { key: 'encrypted', restrictions: ['string'] },
  { key: 'series_id', restrictions: ['number', 'integer', 'positive'] },
]), async ctx => {
  let body = ctx.request.body as { encrypted: string, series_id: number }
  ctx.body = Result.success(await registerBike(body.encrypted, body.series_id))
})

maintainerRouter.post('/activate_bike', checkBody([
  { key: 'encrypted', restrictions: ['string'] },
]), async ctx => {
  let body = ctx.request.body as { encrypted: string }
  ctx.body = Result.success(await activateBike(body.encrypted))
})

export default maintainerRouter