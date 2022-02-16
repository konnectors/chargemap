const {
  BaseKonnector,
  requestFactory,
  log,
  createCozyPDFDocument,
  htmlToPDF
} = require('cozy-konnector-libs')
let jar = require('request').jar()
const requestJSON = requestFactory({
  // debug: true,
  cheerio: false,
  json: true,
  jar 
})
const requestHTML = requestFactory({
  // debug: true,
  cheerio: true,
  json: false,
  jar
})

const VENDOR = 'ChargeMap'
const baseUrl = 'https://fr.chargemap.com'

module.exports = new BaseKonnector(start)

async function start(fields, cozyParameters) {
  await requestJSON(`${baseUrl}`)

  log('info', 'Authenticating ...')
  if (cozyParameters) log('debug', 'Found COZY_PARAMETERS')
  await authenticate.bind(this)(fields.login, fields.password)
  log('info', 'Successfully logged in')
  log('info', 'Fetching the list of documents')
  const resp = await requestJSON({
    url: `${baseUrl}/json/user/invoices`,
    method: 'POST',
    form: {
      page: 1
    },
    resolveWithFullResponse: true
  })
  const $ = resp.body.replace(/ /g, '')
  log('info', 'Parsing list of documents')
  const cookies = resp.caseless.dict['set-cookie']
  const documents = await parseBills($, cookies)

  log('info', 'Saving data to Cozy')
  await this.saveBills(documents, fields, {
    fileIdAttribute: ['vendorRef'],
    identifiers: ['ChargeMap'],
    sourceAccount: fields.login,
    sourceAcountIdentifier: fields.login,
    contentType: 'application/pdf'
  })
}

async function authenticate(username, password) {
  const resp = await requestJSON({
    url: `${baseUrl}/json/signin/index`,
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    form: {
      username: username,
      password: password,
      remember: false
    }
  })
}

async function parseBills($, predis) {
  const numberOfInvoices = $.match(/(<divclass="invoice-line">)/g)
  let invoices = []
  const vendorRefs = $.match(/invoice\/(\d*)/g)
  const fileurls = $.match(
    /https:\/\/fr\.chargemap\.com\/user\/invoice\/(\d*)/g
  )
  const amounts = $.match(/[\d]*\.[\d]*€/g)
  const dates = $.match(/(Facturedu([\d]{2})\/([\d]{2})\/([\d]{4}))/g)

  for (let i = 0; i < numberOfInvoices.length; i++) {
    log('debug', fileurls[i])
    const file = await requestJSON(fileurls[i])
    invoices.push({
      // fileurl: fileurls[i],
      filename: `${dates[i].split('du')[1]}_chargemap_facture_${
        vendorRefs[i].split('/')[1]
      }.pdf`,
      filestream: file,
      amount: parseFloat(amounts[i].match(/(\d)*\.(\d)*/g)[0]),
      date: dates[i].split('du')[1],
      vendor: 'fr.chargemap.com',
      vendorRef: vendorRefs[i].split('/')[1],
      currency: 'EUR',
      requestOptions: {
        requestInstance: requestJSON
      }
    })
  }

  return invoices
}

async function generatePDF(entry) {
  log('debug', entry)
  const url = `${entry}`
  const doc = createCozyPDFDocument(
    'Généré automatiquement par le connecteur ChargeMap depuis la page',
    url
  )
  // const $ = await requestJSON(`${url}`)
  // htmlToPDF($, doc, $('body'), {
  //   baseURL: url
  // })
  doc.end()
  log('debug', doc)
  return doc
}
