import FlakeId = require('flake-idgen')
import AlipaySdk from 'alipay-sdk'

export async function getBizAndSign(amount: string, userId: number) {
  const gen = new FlakeId({ id: userId })

  const alipaySdk = new AlipaySdk({
    appId: "",
    privateKey: "",
  })

  const biz = await new Promise(res => {
    gen.next((err, id) => {
      let key = id.toString('hex')
      res({
        total_amount: amount,
        subject: '充值押金',
        out_trade_no: key,
      })
    })
  })
  const sign = await alipaySdk.exec('alipay.trade.app.pay', biz)
  return {
    app_id: '2021000121665089',
    biz_content: JSON.stringify(biz),
    sign
  }
}