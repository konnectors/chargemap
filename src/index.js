process.env.SENTRY_DSN =
  process.env.SENTRY_DSN ||
  'https://b27bfb505ab9402f9fc52b8fd48c2287@errors.cozycloud.cc/29'

const {
  BaseKonnector,
  requestFactory,
  log,
  cozyClient
} = require('cozy-konnector-libs')
const { toDate } = require('date-fns')
let jar = require('request').jar()

const models = cozyClient.new.models
const { Qualification } = models.document

const requestJSON = requestFactory({
  debug: false,
  cheerio: false,
  json: true,
  jar
})

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
  await saveFiles.bind(this)($, fields)
}

async function authenticate(username, password) {
  await requestJSON({
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
    const getDate = dates[i].split('du')[1].split('/')
    const day = parseInt(getDate[0]) + 1
    const month = parseInt(getDate[1]) - 1
    const year = parseInt(getDate[2])
    const date = toDate(new Date(year, month, day), 'yyyy-MM-dd')
    await this.saveBills(
      [
        {
          filename: `${dates[i]
            .split('du')[1]
            .replace(/\//g, '-')}_chargemap_facture_${
            vendorRefs[i].split('/')[1]
          }.pdf`,
          filestream: requestJSON(fileurls[i]),
          amount: parseFloat(amounts[i].match(/(\d)*\.(\d)*/g)[0]),
          date: date,
          vendor: 'fr.chargemap.com',
          vendorRef: vendorRefs[i].split('/')[1],
          currency: 'EUR',
          fileAttributes: {
            metadata: {
              contentAuthor: 'fr.chargemap.com',
              issueDate: date,
              datetime: toDate(new Date()),
              datetimeLabel: `issueDate`,
              isSubscription: true,
              carbonCopy: true,
              qualification: Qualification.getByLabel('transport_invoice')
            }
          }
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
