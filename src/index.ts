import _Vue from 'vue'
import Router, { Route, RouteRecord } from 'vue-router'

const defaultSeqKey = 's~'
function makeSeq() {
    return Date.now().toString(16)
}

function decodeSeq(s: string) {
    try {
        return parseInt(s, 16)
    } catch{
        return 0
    }
}

export type Options = {
    router: Router
    seqKey?: string
}

export interface Entry extends Route {
    seq: number
}

export interface ScopedEntry extends Entry {
    view: RouteRecord
    component: Vue.Component
}

export interface Stack {
    full: Entry[]
    scoped: ScopedEntry[]
}

function getScopedView(instance: Vue, route: Route) {
    while (instance) {
        for (let i = 0; i < route.matched.length; i++) {
            if (route.matched[i].instances.default === instance) {
                return route.matched[i + 1]
            }
        }
        // allow super parent as scope instance
        instance = instance.$parent
    }
}

export default function install(Vue: typeof _Vue, options?: Options) {
    if (!options || !options.router) {
        throw new Error('invalid options')
    }

    const seqKey = options.seqKey || defaultSeqKey

    const router = options.router
    const stack = Vue.observable<{ entries: Entry[] }>({ entries: [] })

    Object.defineProperty(Vue.prototype, '$stack', {
        get(): Stack {
            const instance = this
            return {
                get full() { return stack.entries },
                get scoped() {
                    return stack.entries.map<ScopedEntry>(e => {
                        const view = getScopedView(instance, e)
                        return {
                            ...e,
                            get view() { return view! },
                            get component() {
                                return (view ? view.components.default : undefined) as Vue.Component
                            }
                        }
                    }).filter(e => !!e.view)
                }
            }
        }
    })

    let replacing = true
    const replaceFn = router.replace.bind(router)
    router.replace = <any>((loc: any, onComplete: any, onAbort: any) => {
        replacing = true
        return replaceFn(loc, onComplete, onAbort)
    })

    router.beforeEach((to, from, next) => {
        if (to.query[seqKey]) {
            return next()
        }
        const query = { ...to.query }
        query[seqKey] = makeSeq()
        next({
            ...to,
            name: to.name || undefined,
            query,
            replace: replacing
        })
    })
    router.afterEach((to, from) => {
        const seq = decodeSeq(to.query[seqKey] as string)

        const i = stack.entries.findIndex(e => e.seq >= seq)
        if (i >= 0) {
            stack.entries.splice(i)
        } else if (replacing) {
            stack.entries.pop()
        }
        stack.entries.push({
            ...to,
            seq
        })

        // 
        replacing = false
    })
}

declare module 'vue/types/vue' {
    interface Vue {
        $stack: Stack
    }
}
