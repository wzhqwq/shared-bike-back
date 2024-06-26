import Application = require("koa")
import Router = require("@koa/router")
import log4js = require("log4js")
import authRouter from "./routes/authRouter"
import { jwtMiddleware } from "./utils/auth"
import Result from "./entities/vo/Result"
import cors = require("@koa/cors")
import customerRouter from "./routes/customerRouter"
import { initializeCache } from "./services/constantService"
import maintainerRouter from "./routes/maintainerRouter"
import managerRouter from "./routes/managerRouter"
import imageRouter from "./routes/imageRouter"
import fs = require("fs/promises")
import path = require("path")
import { initializeFs } from "./services/imageService"
import sharedRouter from "./routes/sharedRouter"

process.env.TZ = 'Asia/Shanghai'

log4js.configure({
  appenders: {
    error: { type: "stdout", layout: { type: "basic" } },
    all: { type: "file", filename: "full.log" },
  },
  categories: {
    default: { appenders: ["error"], level: "error" },
    'default.all': { appenders: ["all"], level: "debug" },
  },
})

const app = new Application()
app.use((ctx, next) =>
  next().catch(err => {
    if (err.status === 401) {
      ctx.status = 401
      ctx.body = '需要登录'
    }
    else {
      switch (err.name) {
        case "database":
          ctx.status = 500
          ctx.body = '数据库发生了错误'
          break
        case "logical":
          ctx.status = 200
          ctx.body = Result.fail(err.message)
          break
        case "permission":
          ctx.status = 403
          ctx.body = err.message
          break
        default:
          throw err
      }
    }
  })
)
app.use(cors({ origin: "*" }))
app.use(jwtMiddleware.unless({ path: ['/auth/sign_in', '/auth/sign_up', '/image/show'] }))

let root = new Router()
root.get("/", async ctx => {
  ctx.body = "テスト、テスト"
})
root.use("/auth", authRouter.routes())
root.use("/customer", customerRouter.routes())
root.use("/maintainer", maintainerRouter.routes())
root.use("/manager", managerRouter.routes())
root.use("/shared", sharedRouter.routes())

root.use("/image", imageRouter.routes())

root.get('/encryption/public_key', async ctx => {
  let publicPath = path.resolve(__dirname, '../constant/public.key')
  ctx.body = await fs.readFile(publicPath)
})

app.use(root.routes())

initializeCache().then(initializeFs).then(() => {
  app.listen(80, () => {
    console.log("启动啦")
  })
})
