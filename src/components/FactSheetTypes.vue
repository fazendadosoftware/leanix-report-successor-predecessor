<template>
  <div class="outer-container">
    <div v-if="error" class="error-container">
      <span>GraphQL Error!</span>
      {{error}}
    </div>
    <div class="title">Workspace Factsheet Types</div>
    <div class="cards-container">
      <template v-for="(factSheetData, factSheetType) in factSheets">
        <div class="factsheet-card" :key="factSheetType">
          <span class="factsheet-type">{{factSheetType}}</span>
          <div class="factsheet-detail">
            <span class="factsheet-description">{{factSheetData.description}}</span>
            <span class="factsheet-count">{{factSheetData.count}}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
export default {
  data () {
    return {
      error: '',
      factSheets: {}
    }
  },
  methods: {
    fetchFactSheetTypes () {
      return new Promise((resolve, reject) => {
        const query = `{ __schema {types {name interfaces {name} description }}}`
        this.$lx.showSpinner()
        this.$lx.executeGraphQL(query)
          .then(res => {
            this.$lx.hideSpinner()
            const factSheets = res.__schema.types
              .filter(type => type.interfaces instanceof Array && type.interfaces.map(iface => iface.name).indexOf('BaseFactSheet') > -1)
              .reduce((factSheets, factSheet, idx) => {
                if (factSheet.name !== 'FactSheetOfUnknownType') {
                  factSheets[factSheet.name] = { description: factSheet.description, count: 0 }
                }
                return factSheets
              }, {})
            resolve(factSheets)
          })
          .catch(err => {
            this.$lx.hideSpinner()
            reject(err)
          })
      })
    },
    fetchFactSheetCountPerType (factSheets) {
      return new Promise((resolve, reject) => {
        const fragment = `<<factSheetType>>: allFactSheets(factSheetType:<<factSheetType>>) {count: totalCount}`
        const query = Object.keys(factSheets)
          .map(factSheetType => fragment.replace(new RegExp('<<factSheetType>>', 'g'), factSheetType))
          .reduce((query, fragment) => {
            query.splice(1, 0, fragment)
            return query
          }, ['query{', '}']).join(' ')
        this.$lx.showSpinner()
        this.$lx.executeGraphQL(query)
          .then(res => {
            this.$lx.hideSpinner()
            Object.keys(res).forEach(factSheetType => { factSheets[factSheetType]['count'] = res[factSheetType].count })
            resolve(factSheets)
          })
          .catch(err => {
            this.$lx.hideSpinner()
            reject(err)
          })
      })
    }
  },
  mounted () {
    this.fetchFactSheetTypes()
      .then(factSheets => { this.factSheets = factSheets; return this.fetchFactSheetCountPerType(factSheets) })
      .then(res => { this.factSheets = res })
      .catch(err => { this.error = err.message })
  }

}
</script>

<style lang="stylus" scoped>
  @import '~@/stylus/material-color'
  @import '~@/stylus/material-shadows'

  .outer-container
    display flex
    flex-flow column

  .error-container
    align-self center
    padding 1rem
    font-size 0.9rem
    color clr-red-500
    font-weight bold

  .title
    font-size 3rem
    font-weight bold
    align-self center
    margin-bottom 2rem
    color clr-grey-600

  .cards-container
    display flex
    flex-flow row wrap
    justify-content center

  .factsheet-card
    display flex
    flex-flow column
    max-width 250px
    padding 0 1rem
    background #0095da
    margin-top 1rem
    margin-right 1rem
    color #0095da
    background white
    z-depth-6dp()
    cursor default
    transition background 0.2s
    &:hover
      color white
      background #0095da

  @media only screen and (max-width: 600px)
    .factsheet-card
      width 100%
      max-width 100%

  .factsheet-type
    font-size 1.8rem
    font-weight bold
    align-self center
    padding 0.7rem

  .factsheet-detail
    display flex
    flex-flow row
    justify-content center
    align-items center
    margin-bottom 0.7rem

  .factsheet-description
    font-size 0.8rem
    text-align center
    font-style italic

  .factsheet-count
    flex 1 0 36%
    font-size 3.5rem
    font-weight bold
    text-align center

</style>
