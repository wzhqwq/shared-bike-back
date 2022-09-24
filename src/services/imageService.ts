import * as fs from 'fs'
import * as http from 'http'
import { IMAGE_BASE } from '../constant/values'
import FlakeId = require('flake-idgen')

const gen = new FlakeId()

export function putImage(req: http.IncomingMessage): Promise<string> {
  return new Promise(res => {
    gen.next((err, id) => {
      let key = id.toString('hex')
      req.pipe(fs.createWriteStream(IMAGE_BASE + '/img_' + key)).on('close', () => {
        res(key)
      })
    })
  })
}

export function fetchImage(key: string) {
  return fs.promises.readFile(IMAGE_BASE + '/img_' + key)
}

export async function initializeFs() {
  try {
    await fs.promises.access(IMAGE_BASE)
  }
  catch (e) {
    await fs.promises.mkdir(IMAGE_BASE)
  }
}