// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import App from './App'
import LeanixVuePlugin from './plugins/LeanixVuePlugin'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faSyncAlt, faToggleOn, faToggleOff, faExpand } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

library.add(faSyncAlt)
library.add(faToggleOn)
library.add(faToggleOff)
library.add(faExpand)

Vue.component('font-awesome-icon', FontAwesomeIcon)

Vue.use(LeanixVuePlugin)

Vue.config.productionTip = false

/* eslint-disable no-new */
new Vue({
  el: '#app',
  components: { App },
  template: '<App/>'
})
