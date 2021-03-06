const axios = require('axios')
const { s, Random } = require('koishi-core')

let APIList = require('./api-list')
APIList.map(item => {
  if ('mapping' in item) item.species = Object.keys(item.mapping)
  if (typeof item.species == 'string') item.species = [item.species]
})

class Config {
  constructor(config) {
    config = { ...config }
    this.inbound = config.inbound ?? false
    this.requestLimit = config.requestLimit ?? 5
  }
}

module.exports.name = 'animal-picture'

module.exports.apply = (ctx, config) => {
  config = new Config(config)
  let logger = ctx.logger('animal-picture')

  if (config.inbound) {
    APIList = APIList.filter(item => item.inbound == true)
  }

  let SpeciesList = new Set()
  APIList.forEach(item => {
    item.species.forEach(species => SpeciesList.add(species))
  })
  SpeciesList = Array.from(SpeciesList).sort()

  const SpeciesAPI = {}
  SpeciesList.forEach(species => SpeciesAPI[species] = [])
  APIList.forEach(item => {
    if ('mapping' in item) {
      for (let [species, value] of Object.entries(item.mapping)) {
        SpeciesAPI[species].push({
          url: item.url.replace('{}', value),
          gif: item.gif ?? '',
          endpoint: item.endpoint
        })
      }
    } else {
      item.species.forEach(species => {
        SpeciesAPI[species].push({
          url: item.url,
          gif: item.gif ?? '',
          endpoint: item.endpoint
        })
      })
    }
  })

  ctx.command('animal <species>', '动物图')
    .usage('可用的 species: ' + SpeciesList.join(', '))
    .option('gif', '-g 试图请求动图（不一定有用）')
    .action(async ({ options }, species) => {
      if (!species) return '未指定物种。'
      if (!SpeciesList.includes(species)) return '没有此物种的图。'

      let apiList = [...SpeciesAPI[species]]
      if (options.gif) {
        let filteredList = apiList.filter(api => api.gif != '')
        if (filteredList) apiList = filteredList
      }

      const api = Random.pick(apiList)
      const apiUrl = api.url + (options.gif ? api.gif : '')

      const reqLimit = config.requestLimit
      try {
        let req, res
        for (req = 0; req < reqLimit; req++) {
          res = (await axios.get(apiUrl)).data
          let endpoint = api.endpoint == '' ? [] : api.endpoint.split('.')

          for (let urlSeg of endpoint) {
            if (urlSeg == '[]') res = res[0]
            else res = res[urlSeg]
          }

          if (res.match(/.(jpe?g|png|gif)$/)) break
        }

        if (req < reqLimit) {
          return s('image', { url: res })
        } else {
          return '没有请求到能够用于发送的图片……'
        }
      } catch (err) {
        logger.warn('Something wrong happened during the request of the image.')
        console.log(err)
        return '发生了神秘错误。'
      }
    })
}
