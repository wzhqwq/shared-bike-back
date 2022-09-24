import FlakeId = require('flake-idgen')

export async function getBizAndSign(amount: string, userId: number) {
  const gen = new FlakeId({ id: userId })

  return new Promise(res => {
    gen.next((err, id) => {
      let key = id.toString('hex')
      const biz = {
        total_amount: amount,
        subject: '充值押金',
        out_trade_no: key,
      }
      const sign = await alipaySdk.exec('alipay.trade.app.pay', biz)
      res({
        app_id: '2021000121665089',
        biz_content: JSON.stringify(biz),
        sign
      })
    })
  })
}