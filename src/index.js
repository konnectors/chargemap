const {
  BaseKonnector,
  requestFactory,
  log,
} = require('cozy-konnector-libs')
const request = requestFactory({
  cheerio: true,
  json: false,
  jar: true
})

const VENDOR = 'ChargeMap'
const baseUrl = 'https://fr.chargemap.com'

module.exports = new BaseKonnector(start)

async function start(fields, cozyParameters) {
  log('info', 'Authenticating ...')
  if (cozyParameters) log('debug', 'Found COZY_PARAMETERS')
  await authenticate.bind(this)(fields.login, fields.password)
  log('info', 'Successfully logged in')
  log('info', 'Fetching the list of documents')
  const $ = await request(`${baseUrl}/index.html`)
  log('info', 'Parsing list of documents')
  const documents = await parseDocuments($)

  log('info', 'Saving data to Cozy')
  await this.saveBills(documents, fields, {
    identifiers: ['ChargeMap']
  })
}

function authenticate(username, password) {
  return this.signin()
}

function parseDocuments($) {
  
}

