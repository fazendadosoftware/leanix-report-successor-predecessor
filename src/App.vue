<template>
  <div id="app">
    <img class="logo" src="./assets/logo.svg">
    <fact-sheet-types/>
  </div>
</template>

<script>
import FactSheetTypes from './components/FactSheetTypes'

export default {
  name: 'App',
  components: {
    FactSheetTypes
  },
  mounted () {
    this.$lx.init()
      .then(setup => {
        this.$lx.ready({})
      })
  }
}
</script>

<style lang="stylus" scoped>
  @import './stylus/main'

  #app
    display flex
    flex-flow column
    justify-content center
    align-items center

  .logo
    width 250px
    margin 2rem
    align-self flex-end
</style>
