# vue-router-stack

A Vue plugin provides router stack. It helps SPA/mobile app easily manage page navigation, by mapping router stack to real working pages.

# Installation

```sh
npm install vue-router-stack
```

initialize the plugin

```javascript
import VueRouterStack from 'vue-router-stack'

Vue.use(VueRouterStack, {
    router, // the instance of vue-router
    seqKey: 's~' // optional 
})
```

now, the full router stack can be visited like:

```javascript
this.$stack.full
```

or visit the scoped stack, which is bound to current component instance

```javascript
this.$stack.scoped
```

# Typical use case

defines routes as usual

```javascript

const routers = [
    {
        path: '/',
        component: IndexPage,
        children: [
            {
                path: '/foo',
                component: FooPage
            },
            {
                path: '/bar',
                component: BarPage
            }
        ]
    }
]
```

replace second level `<route-view>` tag with

```html
<router-view>
    <component
    v-for="entry in $stack.scoped"
    :key="entry.fullPath"
    :is="entry.component"
    />
</router-view>
```
