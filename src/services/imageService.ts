import * as fs from 'fs/promises'
import { IMAGE_BASE } from '../constant/values'
import { LogicalError } from '../utils/errors'

export async function putImage(form: FormData) {
  console.log(form.get('image'))

  return '123'
}

export async function fetchImage(key: string) {
  try {
    return await fs.readFile(IMAGE_BASE + '/img_' + key)
  }
  catch (e) {
    throw new LogicalError("图片不存在")
  }
}

export async function initializeFs() {
  try {
    await fs.access(IMAGE_BASE)
  }
  catch (e) {
    await fs.mkdir(IMAGE_BASE)
  }
}