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
  const documents = await saveFiles.bind(this)($, fields)
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

async function saveFiles($, fields) {
  const numberOfInvoices = $.match(/(<divclass="invoice-line">)/g)
  const vendorRefs = $.match(/invoice\/(\d*)/g)
  const fileurls = $.match(
    /https:\/\/fr\.chargemap\.com\/user\/invoice\/(\d*)/g
  )
  const amounts = $.match(/[\d]*\.[\d]*€/g)
  const dates = $.match(/(Facturedu([\d]{2})\/([\d]{2})\/([\d]{4}))/g)

  for (let i = 0; i < numberOfInvoices.length; i++) {
    log('debug', fileurls[i])
    await this.saveFiles(
      [
        {
          filename: `${dates[i].split('du')[1]}_chargemap_facture_${
            vendorRefs[i].split('/')[1]
          }.pdf`,
          filestream: requestJSON(fileurls[i]),
          amount: parseFloat(amounts[i].match(/(\d)*\.(\d)*/g)[0]),
          date: dates[i].split('du')[1],
          vendor: 'fr.chargemap.com',
          vendorRef: vendorRefs[i].split('/')[1],
          currency: 'EUR'
        }
      ],
      fields,
      {
        fileIdAttribute: ['vendorRef'],
        identifiers: ['ChargeMap'],
        sourceAccount: fields.login,
        sourceAcountIdentifier: fields.login
      }
    )
  }
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
