# vue-router-stack

A Vue plugin provides router stack. It helps SPA/mobile app easily manage page navigation, by mapping router stack to real working pages.

# Installation

```
npm install vue-router-stack
```

initialize the plugin

```
import VueRouterStack from 'vue-router-stack'

Vue.use(VueRouterStack, {
    router, // the instance of vue-router
    seqKey: 's~' // optional 
})
```

now, the router stack can be visited like:

```
this.$routerStack.items
```

# Typical use case

defines routes with the dummy page, but put working pages in meta:

```
const DummyPage = Vue.extend({
    name: 'DummyPage',
    render: c => c('div')
})

const routers = [
    {
        path: '/',
        component: DummyPage
        meta: {
            component : IndexPage
        }
    },
    {
        path: '/foo',
        component: DummyPage,
        meta: {
            component: FooPage
        }
    }
]
```

then working pages stack can be rendered as:
```
<component v-for="item in $routerStack.items" :key="item.fullPath" :is="item.meta.component">
</component>
```
