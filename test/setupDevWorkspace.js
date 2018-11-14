const Queries = require('../src/helpers/queries')
const assert = require('chai').assert
const ProgressBar = require('progress')
const lxr = require('../lxr.json')
const leanixjs = require('leanix-js')

const dataset = require('./devDataset.json')

const { Authenticator, GraphQLClient } = leanixjs
const authenticator = new Authenticator(lxr.host, lxr.apitoken)
const graphql = new GraphQLClient(authenticator)

const queries = new Queries(graphql)

describe('The queries', () => {
  let tagGroup
  let businessCapabilities
  before(async () => {
    await authenticator.start()
  })
  after(async () => {
    await authenticator.stop()
  })

  it('should delete all workspace factsheets', async () => {
    const query = '{allFactSheets{edges{node{id}}}}'
    let ids = await graphql
      .executeGraphQL(query)
      .then(res => res.allFactSheets.edges.map(edge => edge.node.id))
    const bar = new ProgressBar(
      `Archiving ${ids.length} factSheets [:bar] :rate/fps :percent :etas - :errors errors`,
      { total: ids.length, renderThrottle: 100 }
    )
    let errors = []
    for (let id of ids) {
      const query = `mutation($id:ID!,$patches:[Patch]!){updateFactSheet(id:$id,comment:"Delete FS",patches:$patches,validateOnly:false){factSheet{id}}}`
      const variables = {
        id,
        patches: [{ op: 'add', path: '/status', value: 'ARCHIVED' }]
      }
      await graphql
        .executeGraphQL(query, variables)
        .catch(() => errors.push(id))
      bar.tick({ errors: errors.length })
    }
    assert(errors.length === 0, 'All factsheets should have been deleted')
  })

  it('should find the tagGroup "transition phase" and, if existing, delete it and tags ', async () => {
    try {
      const tagGroup = await queries.fetchTransitionPhaseTagGroup(dataset.tagGroup)
      if (tagGroup) await queries.deleteTransitionPhaseTagGroupAndTags(tagGroup)
    } catch (err) {
      assert.isNull(err)
    }
  })

  it('should create the tag group and tags in the workspace', async () => {
    try {
      tagGroup = await queries.createTransitionPhaseTagGroupAndTags(dataset.tagGroup)
      assert.isObject(tagGroup)
      assert.isString(tagGroup.id)
      assert.isArray(tagGroup.tags)
      assert.lengthOf(tagGroup.tags, dataset.tagGroup.tags.length)
    } catch (err) {
      assert.isNull(err)
    }
  })

  it('should create the business capabilities in the workspace', async () => {
    try {
      businessCapabilities = await queries.createBusinessCapabilities(dataset.businessCapabilities)
      businessCapabilities = businessCapabilities.reduce((accumulator, bc) => { accumulator[bc.name] = bc; return accumulator }, {})
      assert.isObject(businessCapabilities)
      assert.hasAllKeys(businessCapabilities, dataset.businessCapabilities.map(bc => bc.name))
    } catch (err) {
      assert.isNull(err)
    }
  })
})
