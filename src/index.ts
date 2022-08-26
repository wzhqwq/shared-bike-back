import { json } from "express"
import * as express from "express"

const app = express()
app.use(json())

app.get("/", (req, res) => {
  res.send("テスト、テスト")
})

app.listen(80)