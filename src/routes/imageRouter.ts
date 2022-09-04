import Router = require("@koa/router");
import Result from "../entities/vo/Result";
import { fetchImage, putImage } from "../services/imageService";
import { checkBody, lengthRestriction } from "../utils/body";
import { LogicalError } from "../utils/errors";

const imageRouter = new Router()

imageRouter.get('/show', checkBody([
  { key: 'key', restrictions: ['string', lengthRestriction(1, 50), 'imageKey'] }
]), async ctx => {
  ctx.type = 'image'
  ctx.body = await fetchImage(ctx.request.body.key)
})

imageRouter.put('/upload', async ctx => {
  let body = ctx.request.body
  if (!(body instanceof FormData)) throw new LogicalError('请求格式错误')
  ctx.body = Result.success(await putImage(body))
})

export default imageRouter