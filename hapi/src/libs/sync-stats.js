#!/usr/bin/env node
const { JsonRpc } = require('eosjs')
const fetch = require('node-fetch')
const { massiveDB } = require('../config')

const HAPI_EOS_API_ENDPOINT = process.env.HAPI_EOS_API_ENDPOINT || 'https://jungle.eosio.cr'
const HAPI_RATING_CONTRACT = process.env.HAPI_RATING_CONTRACT || 'rateproducer'

const getRatingsStats = async () => {
  const eos = new JsonRpc(HAPI_EOS_API_ENDPOINT, { fetch })

  try {
    const ratings = await eos.get_table_rows({
      json: true,
      code: HAPI_RATING_CONTRACT,
      scope: HAPI_RATING_CONTRACT,
      table: 'stats',
      limit: 1000,
      reverse: false,
      show_payer: false
    })
    
    return ratings
  } catch (err) { 
    console.log(`Database connection error ${err}`)
    return []
  }
}

const updateRatingsStats = async () => {
  console.log('==== Updating ratings stats ====')
  const ratingsStats = await getRatingsStats()

  ratingsStats.rows.forEach(async (rating) => {
    try {
      const resultRatingStatsSave = await (await massiveDB).ratings_stats.save(rating)
      const dbResult = resultRatingStatsSave ? resultRatingStatsSave : await (await massiveDB).ratings_stats.insert(rating)
      console.log(`Save or insert of ${rating.bp} was ${dbResult ? 'SUCCESSFULL' : 'UNSUCCESSFULL'}`)
    } catch (err) { console.log(`Error: ${err}`) }
  })
}

updateRatingsStats()
