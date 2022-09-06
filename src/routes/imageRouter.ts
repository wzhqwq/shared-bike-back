import Router = require("@koa/router");
import Result from "../entities/vo/Result";
import { fetchImage, putImage } from "../services/imageService";
import { checkParams, lengthRestriction } from "../utils/body";

const imageRouter = new Router()

imageRouter.get('/show', checkParams([
  { key: 'key', restrictions: [lengthRestriction(1, 50), 'imageKey'] }
]), async ctx => {
  try {
    let image = await fetchImage(ctx.query.key as string)
    ctx.type = 'image'
    ctx.body = image
  }
  catch (e) {
    ctx.status = 404
    ctx.response.body = ''
  }
})

imageRouter.put('/upload', async ctx => {
  await putImage(ctx.req)
  ctx.body = Result.success(null)
})

export default imageRouter