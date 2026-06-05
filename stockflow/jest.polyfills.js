import { TextDecoder, TextEncoder } from 'util'
import 'whatwg-fetch'

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

if (typeof global.Request === 'undefined' && typeof Request !== 'undefined') {
  global.Request = Request
}

if (typeof global.Response === 'undefined' && typeof Response !== 'undefined') {
  global.Response = Response
}

if (typeof global.Headers === 'undefined' && typeof Headers !== 'undefined') {
  global.Headers = Headers
}

if (typeof global.fetch === 'undefined' && typeof fetch !== 'undefined') {
  global.fetch = fetch
}
